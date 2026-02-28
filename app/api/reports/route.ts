import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_CATEGORIES = ['pothole', 'fallen_tree', 'road_marking', 'street_light', 'traffic_sign', 'hazard'] as const;

/**
 * GET /api/reports
 * Returns only verified reports with their photos.
 * Query params: category, settlement, municipality (optional filters).
 */
export async function GET(req: NextRequest) {
  noStore();
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const settlement = searchParams.get('settlement');
  const municipality = searchParams.get('municipality');

  console.log('[API] GET /api/reports called', { category, settlement, municipality });
  try {
    let supabase;
    try {
      supabase = getSupabaseAdmin();
    } catch (configError) {
      console.warn('Supabase not configured:', (configError as Error).message);
      return NextResponse.json({ reports: [] });
    }

    let query = supabase
      .from('reports')
      .select('id, city, lat, lng, severity, comment, first_name, last_name, created_at, municipality, settlement, category, status, updated_at, resolved_at, metadata')
      .eq('verified', true);

    if (category && VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
      query = query.eq('category', category);
    }
    if (settlement?.trim()) {
      query = query.eq('settlement', settlement.trim());
    }
    if (municipality?.trim()) {
      query = query.eq('municipality', municipality.trim());
    }

    const { data: reports, error: reportsError } = await query
      .order('created_at', { ascending: false })
      .limit(1000);

    if (reportsError) {
      console.error('GET /api/reports – Supabase error:', reportsError.message, reportsError.code);
      return NextResponse.json(
        { error: 'Failed to load reports', reports: [] },
        { status: 500 }
      );
    }

    const list = reports ?? [];
    console.log('[API] Found', list.length, 'verified reports');
    if (list.length === 0) {
      return NextResponse.json({ reports: [] });
    }

    const { data: photos, error: photosError } = await supabase
      .from('report_photos')
      .select('report_id, storage_path')
      .in('report_id', list.map((r) => r.id));

    if (photosError) {
      console.warn('GET /api/reports – photos error (returning reports without photos):', photosError.message);
    }

    const photosByReport = (photos || []).reduce<Record<string, { storage_path: string }[]>>(
      (acc, p) => {
        if (!acc[p.report_id]) acc[p.report_id] = [];
        acc[p.report_id].push({ storage_path: p.storage_path });
        return acc;
      },
      {}
    );

    const reportsWithPhotos = list.map((r) => ({
      ...r,
      photos: photosByReport[r.id] || [],
    }));

    console.log('[API] Returning', reportsWithPhotos.length, 'reports with photos');
    return NextResponse.json(
      { reports: reportsWithPhotos },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
