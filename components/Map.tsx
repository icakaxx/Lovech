'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReportWithPhotos } from '@/lib/types';
import type { Map as LMap, Marker as LMarker, LeafletMouseEvent } from 'leaflet';
import { ReportModal } from '@/components/ReportModal';
import { getPopupContent } from '@/components/MarkerPopup';

// Lovech, Bulgaria bounds (lock initial view)
const LOVECH_CENTER: [number, number] = [43.1332, 24.7151];
const LOVECH_BOUNDS: [[number, number], [number, number]] = [
  [43.08, 24.62],
  [43.18, 24.82],
];

const BUCKET_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/pothole-photos`;

export function Map() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const markersRef = useRef<LMarker[]>([]);
  const markersRunIdRef = useRef(0);
  const [reports, setReports] = useState<ReportWithPhotos[]>([]);
  const [clickLatLng, setClickLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  // Fetch reports on load (no cache + cache-buster so reload always gets fresh data)
  useEffect(() => {
    const url = `/api/reports?t=${Date.now()}`;
    console.log('[Map] Fetching reports from:', url);
    fetch(url, { cache: 'no-store', headers: { Pragma: 'no-cache' } })
      .then((res) => {
        console.log('[Map] Response status:', res.status);
        return res.json();
      })
      .then((data) => {
        console.log('[Map] Response data:', data);
        const list = data?.reports;
        if (Array.isArray(list)) {
          console.log('[Map] Setting reports, count:', list.length);
          setReports(list);
        } else if (list === undefined && data?.error) {
          console.warn('[Map] API returned error:', data.error);
          setReports(Array.isArray(data.reports) ? data.reports : []);
        } else {
          console.warn('[Map] Unexpected response format:', data);
        }
      })
      .catch((err) => {
        console.error('[Map] Fetch error:', err);
        setReports([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Initialize Leaflet map (client-only)
  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;
    if (mapRef.current) return;

    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled) return;
      if (mapRef.current || !containerRef.current) return;

      const map = L.default.map(containerRef.current).setView(LOVECH_CENTER, 14);
      // OSM standard: blue rivers/water, green parks and nature (no API key)
      L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      map.setMaxBounds(LOVECH_BOUNDS);
      map.setMinZoom(12);
      map.setMaxZoom(18);

      map.on('click', (e: LeafletMouseEvent) => {
        setClickLatLng({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      mapRef.current = map;

      requestAnimationFrame(() => {
        if (cancelled) return;
        map.invalidateSize();
        setMapReady(true);
      });
    });

    return () => {
      cancelled = true;
      setMapReady(false);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = [];
    };
  }, []);

  // Update markers when reports change or when map becomes ready
  useEffect(() => {
    console.log('[Map] Markers effect - mapReady:', mapReady, 'reports count:', reports.length);
    if (!mapReady || !mapRef.current || typeof window === 'undefined') return;

    markersRunIdRef.current += 1;
    const thisRunId = markersRunIdRef.current;
    const reportsToShow = [...reports];
    console.log('[Map] Will render markers for', reportsToShow.length, 'reports, runId:', thisRunId);

    import('leaflet').then((L) => {
      if (thisRunId !== markersRunIdRef.current) {
        console.log('[Map] Skipping stale markers run', thisRunId);
        return;
      }
      const map = mapRef.current;
      if (!map) {
        console.log('[Map] Map ref is null, skipping markers');
        return;
      }

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const colors: Record<1 | 2 | 3, string> = {
        1: '#22c55e',
        2: '#eab308',
        3: '#ef4444',
      };

      let addedCount = 0;
      reportsToShow.forEach((report) => {
        const lat = Number(report.lat);
        const lng = Number(report.lng);
        console.log('[Map] Processing report:', report.id, 'lat:', lat, 'lng:', lng, 'severity:', report.severity);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          console.warn('[Map] Invalid coordinates for report', report.id);
          return;
        }
        const color = colors[report.severity as 1 | 2 | 3] ?? '#64748b';
        const icon = L.default.divIcon({
          className: 'custom-marker',
html: `<span style="background:${color};width:14px;height:14px;border-radius:50%;display:block;border:2px solid #0f172a;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></span>`,
                iconSize: [14, 14],
                iconAnchor: [7, 7],
        });
        const marker = L.default
          .marker([lat, lng], { icon })
          .addTo(map);
        marker.bindPopup('', {
          maxWidth: 320,
          minWidth: 280,
        });
        marker.on('popupopen', () => {
          const popup = marker.getPopup();
          if (popup) popup.setContent(getPopupContent(report, BUCKET_URL ?? ''));
        });
        markersRef.current.push(marker);
        addedCount++;
      });
      console.log('[Map] Added', addedCount, 'markers to map');
    });
  }, [reports, mapReady]);

  const handleCloseModal = () => setClickLatLng(null);

  const refetchReports = () => {
    fetch(`/api/reports?t=${Date.now()}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.reports)) setReports(data.reports);
      })
      .catch(() => {});
  };

  const handleReportSubmitted = (report: ReportWithPhotos) => {
    setReports((prev) => [report, ...prev]);
  };

  const handleSubmitSuccess = () => {
    setClickLatLng(null);
    // Don't refetch here – the new report was already added optimistically.
    // Refetch would overwrite state and can make the new marker disappear if the API response is delayed or different.
  };

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />

      {loading && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <span className="text-slate-700">Зареждане на картата...</span>
        </div>
      )}

      {!loading && mapReady && reports.length === 0 && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[400] pointer-events-none">
          <p className="text-slate-700 text-sm text-center px-4 py-2 rounded-lg bg-white/95 backdrop-blur border border-slate-200 shadow-md">
            Няма потвърдени сигнали. Кликни на картата, за да подадеш нов.
          </p>
        </div>
      )}

      {clickLatLng && (
        <ReportModal
          lat={clickLatLng.lat}
          lng={clickLatLng.lng}
          onClose={handleCloseModal}
          onSuccess={handleSubmitSuccess}
          onReportSubmitted={handleReportSubmitted}
        />
      )}
    </div>
  );
}

