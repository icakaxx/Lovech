import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * DELETE /api/cron/cleanup
 * Deletes unverified reports older than 48 hours.
 * Call from Vercel Cron (cron.json) or external cron with CRON_SECRET.
 *
 * Vercel: add to vercel.json:
 *   "crons": [{ "path": "/api/cron/cleanup", "schedule": "0 * * * *" }]
 * Then set CRON_SECRET in env and send: Authorization: Bearer <CRON_SECRET>
 */
const MAX_AGE_HOURS = 48;

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - MAX_AGE_HOURS);
    const cutoffIso = cutoff.toISOString();

    const { data: old } = await supabase
      .from('reports')
      .select('id')
      .eq('verified', false)
      .lt('created_at', cutoffIso);

    if (!old?.length) {
      return NextResponse.json({ deleted: 0 });
    }

    const ids = old.map((r) => r.id);

    const { data: photos } = await supabase
      .from('report_photos')
      .select('storage_path')
      .in('report_id', ids);

    const bucket = 'pothole-photos';
    for (const p of photos || []) {
      await supabase.storage.from(bucket).remove([p.storage_path]);
    }

    await supabase.from('report_photos').delete().in('report_id', ids);
    const { error } = await supabase.from('reports').delete().in('id', ids);

    if (error) {
      console.error('cleanup error', error);
      return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
    }

    return NextResponse.json({ deleted: ids.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
