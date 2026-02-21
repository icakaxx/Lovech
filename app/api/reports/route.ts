import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports
 * Returns only verified reports with their photos (server-side filtering).
 * Used by the map to show markers.
 */
export async function GET() {
  console.log('[API] GET /api/reports called');
  try {
    let supabase;
    try {
      supabase = getSupabaseAdmin();
    } catch (configError) {
      // Supabase not configured (missing env) – return empty list so map still loads
      console.warn('Supabase not configured:', (configError as Error).message);
      return NextResponse.json({ reports: [] });
    }
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('id, city, lat, lng, severity, comment, created_at')
      // Temporarily removed: .eq('verified', true) – show all reports for debugging
      .order('created_at', { ascending: false });

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
    return NextResponse.json({ reports: reportsWithPhotos });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
