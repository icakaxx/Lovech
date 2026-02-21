'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReportWithPhotos } from '@/lib/types';
import type { Map as LMap, Marker as LMarker, LeafletMouseEvent } from 'leaflet';
import type { MarkerClusterGroup } from 'leaflet';
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
  const clusterGroupRef = useRef<{ clearLayers: () => void; addLayer: (m: LMarker) => void } | null>(null);
  const markersRunIdRef = useRef(0);
  const [reports, setReports] = useState<ReportWithPhotos[]>([]);
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null);
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
          setReports((prev) => {
            const apiIds = new Set(list.map((r: ReportWithPhotos) => r.id));
            const missingFromApi = prev.filter((r) => !apiIds.has(r.id));
            return missingFromApi.length ? [...missingFromApi, ...list] : list;
          });
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
        // Don't open report modal if clicking on a marker or cluster
        const target = e.originalEvent?.target as HTMLElement;
        if (target?.closest('.custom-marker') || target?.closest('.marker-cluster')) {
          return;
        }
        // Show confirmation first, not the full report modal
        setPendingLatLng({ lat: e.latlng.lat, lng: e.latlng.lng });
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
      clusterGroupRef.current = null;
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

    Promise.all([import('leaflet'), import('leaflet.markercluster')]).then(([LMod]) => {
      const L = LMod.default;
      if (thisRunId !== markersRunIdRef.current) {
        console.log('[Map] Skipping stale markers run', thisRunId);
        return;
      }
      const map = mapRef.current;
      if (!map) {
        console.log('[Map] Map ref is null, skipping markers');
        return;
      }

      // Remove old cluster group
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current as unknown as L.Layer);
      }
      markersRef.current = [];

      const clusterGroup = (L as typeof L & { markerClusterGroup: (opts?: object) => L.Layer }).markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
      });
      clusterGroupRef.current = clusterGroup;
      map.addLayer(clusterGroup);

      const colors: Record<1 | 2 | 3, string> = {
        1: '#22c55e',
        2: '#eab308',
        3: '#ef4444',
      };

      let addedCount = 0;
      reportsToShow.forEach((report) => {
        const lat = Number(report.lat);
        const lng = Number(report.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          console.warn('[Map] Invalid coordinates for report', report.id);
          return;
        }
        const color = colors[report.severity as 1 | 2 | 3] ?? '#64748b';
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<span style="background:${color};width:24px;height:24px;border-radius:50%;display:block;border:3px solid #0f172a;box-shadow:0 2px 8px rgba(0,0,0,0.5);cursor:pointer;"></span>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const marker = L.marker([lat, lng], { icon });
        marker.bindPopup('', {
          maxWidth: 320,
          minWidth: 280,
        });
        marker.on('popupopen', () => {
          const popup = marker.getPopup();
          if (popup) popup.setContent(getPopupContent(report, BUCKET_URL ?? ''));
        });
        clusterGroup.addLayer(marker);
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
    // Ensure report has valid coords (fallback to click position if API returns missing/invalid)
    const safeReport = {
      ...report,
      lat: Number.isFinite(Number(report.lat)) ? Number(report.lat) : (clickLatLng?.lat ?? report.lat),
      lng: Number.isFinite(Number(report.lng)) ? Number(report.lng) : (clickLatLng?.lng ?? report.lng),
    };
    setReports((prev) => [safeReport, ...prev]);
  };

  const handleSubmitSuccess = (lat: number, lng: number) => {
    setClickLatLng(null);
    // Pan map to the new report so the user can see it
    if (mapRef.current) {
      mapRef.current.flyTo([lat, lng], 16, { duration: 0.5 });
    }
    const doRefetch = () => {
      fetch(`/api/reports?t=${Date.now()}`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => {
          if (!Array.isArray(data?.reports)) return;
          setReports((prev) => {
            const apiIds = new Set(data.reports.map((r: ReportWithPhotos) => r.id));
            const missingFromApi = prev.filter((r) => !apiIds.has(r.id));
            return [...missingFromApi, ...data.reports];
          });
        })
        .catch(() => {});
    };
    // Refetch immediately and again after 1.5s (DB propagation)
    doRefetch();
    setTimeout(doRefetch, 1500);
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

      {/* Location confirmation dialog */}
      {pendingLatLng && !clickLatLng && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
          <div className="rounded-t-2xl sm:rounded-2xl bg-white border border-slate-200 shadow-xl w-full sm:max-w-sm p-5 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Подаване на сигнал</h3>
            <p className="text-sm text-slate-600 mb-4">
              Искате ли да подадете сигнал за дупка на това място?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPendingLatLng(null)}
                className="flex-1 py-3 sm:py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-smooth text-base sm:text-sm"
              >
                Не
              </button>
              <button
                type="button"
                onClick={() => {
                  setClickLatLng(pendingLatLng);
                  setPendingLatLng(null);
                }}
                className="flex-1 py-3 sm:py-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white font-medium transition-smooth text-base sm:text-sm"
              >
                Да, продължи
              </button>
            </div>
          </div>
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

