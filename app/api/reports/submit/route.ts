import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hashString } from '@/lib/hash';

const RATE_LIMIT_MINUTES = 5;
const RATE_LIMIT_KEY = 'dupkite-submit';

/** In-memory rate limit: IP -> last submit timestamp. Use Redis/Vercel KV in production. */
const rateLimitMap = new Map<string, number>();

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function isRateLimited(ip: string): boolean {
  const last = rateLimitMap.get(ip);
  if (!last) return false;
  const windowMs = RATE_LIMIT_MINUTES * 60 * 1000;
  if (Date.now() - last < windowMs) return true;
  rateLimitMap.delete(ip);
  return false;
}

function setRateLimit(ip: string): void {
  rateLimitMap.set(ip, Date.now());
}

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB (images are compressed client-side)
const BUCKET = 'pothole-photos';

/**
 * POST /api/reports/submit
 * Creates report (verified=true, no email verification). Rate limit: 1 per 5 min per IP.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Твърде много опити. Опитайте след няколко минути.' },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const lat = parseFloat(formData.get('lat') as string);
  const lng = parseFloat(formData.get('lng') as string);
  const severity = parseInt(formData.get('severity') as string, 10);
  const comment = (formData.get('comment') as string)?.trim() || null;
  const firstName = (formData.get('first_name') as string)?.trim() || '';
  const lastName = (formData.get('last_name') as string)?.trim() || '';

  if (!firstName || !lastName || !Number.isFinite(lat) || !Number.isFinite(lng) || ![1, 2, 3].includes(severity)) {
    return NextResponse.json(
      { error: 'Липсват задължителни полета или невалидни данни.' },
      { status: 400 }
    );
  }

  const images = formData.getAll('images') as File[];
  if (!images.length || images.length > MAX_IMAGES) {
    return NextResponse.json(
      { error: 'Добавете между 1 и 5 снимки.' },
      { status: 400 }
    );
  }
  for (const f of images) {
    if (f.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: 'Снимката е твърде голяма. Моля, използвайте по-малка снимка.' },
        { status: 400 }
      );
    }
  }

  const emailHash = hashString(`${firstName}|${lastName}`);

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (configError) {
    console.warn('Supabase not configured:', (configError as Error).message);
    return NextResponse.json(
      { error: 'Сървърът не е конфигуриран. Добавете Supabase ключовете в .env.local.' },
      { status: 503 }
    );
  }

  const { data: report, error: insertError } = await supabase
    .from('reports')
    .insert({
      city: 'Lovech',
      lat,
      lng,
      severity,
      comment,
      first_name: firstName,
      last_name: lastName,
      email_hash: emailHash,
      verify_token_hash: null,
      verified: true,
    })
    .select('id, city, lat, lng, severity, comment, first_name, last_name, created_at')
    .single();

  if (insertError || !report) {
    console.error('report insert error', insertError);
    return NextResponse.json(
      { error: 'Грешка при запис. Опитайте отново.' },
      { status: 500 }
    );
  }

  const basePath = `${report.id}`;
  const paths: string[] = [];

  // Ensure bucket exists (create if missing, e.g. first deploy)
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.name === BUCKET);
  if (!bucketExists) {
    const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: '4MB',
      allowedMimeTypes: ['image/*'],
    });
    if (createErr) {
      console.error('bucket create error', createErr);
      await supabase.from('reports').delete().eq('id', report.id);
      return NextResponse.json(
        { error: 'Грешка при създаване на хранилище за снимки. Създайте bucket "pothole-photos" в Supabase Dashboard → Storage.' },
        { status: 500 }
      );
    }
  }

  for (let i = 0; i < images.length; i++) {
    const file = images[i];
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const safeExt = ext || 'jpg';
    const path = `${basePath}/${Date.now()}-${i}.${safeExt}`;
    const contentType = file.type || 'image/jpeg';
    let body: ArrayBuffer | Blob = file;
    if (typeof file.arrayBuffer === 'function') {
      body = await file.arrayBuffer();
    }
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, body, { contentType, upsert: false });
    if (uploadError) {
      console.error('upload error', uploadError);
      await supabase.from('reports').delete().eq('id', report.id);
      return NextResponse.json(
        {
          error:
            uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')
              ? 'Създайте bucket "pothole-photos" в Supabase → Storage и опитайте отново.'
              : 'Грешка при качване на снимки.',
        },
        { status: 500 }
      );
    }
    paths.push(path);
  }

  for (const storage_path of paths) {
    await supabase.from('report_photos').insert({
      report_id: report.id,
      storage_path,
    });
  }

  setRateLimit(ip);

  const reportWithPhotos = {
    ...report,
    photos: paths.map((storage_path) => ({ storage_path })),
  };
  return NextResponse.json({ success: true, id: report.id, report: reportWithPhotos });
}
