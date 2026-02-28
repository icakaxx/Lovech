'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReportWithPhotos, ReportCategory } from '@/lib/types';
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  SETTLEMENTS_LOVECH,
  SETTLEMENT_CENTERS_LOVECH,
  MUNICIPALITY_CENTER_LOVECH,
  SETTLEMENT_LABELS_BG,
} from '@/lib/types';
import type { Map as LMap, Marker as LMarker, LeafletMouseEvent } from 'leaflet';
import type { MarkerClusterGroup } from 'leaflet';
import { ReportModal } from '@/components/ReportModal';
import { getPopupContent } from '@/components/MarkerPopup';

// Lovech, Bulgaria initial view (bounds moved to MUNICIPALITY_BOUNDS_LOVECH in lib/types.ts)
const LOVECH_CENTER: [number, number] = [43.1332, 24.7151];

const BUCKET_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/pothole-photos`;

export function Map() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const markersRef = useRef<LMarker[]>([]);
  const clusterGroupRef = useRef<{ clearLayers: () => void; addLayer: (m: LMarker) => void } | null>(null);
  const draggableMarkerRef = useRef<LMarker | null>(null);
  const markersRunIdRef = useRef(0);
  const highlightMarkerRef = useRef<LMarker | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const pendingMoveEndHandlerRef = useRef<((...args: any[]) => void) | null>(null);
  const lastGoToTargetRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isDraggingRef = useRef(false);
  const blockClicksUntilRef = useRef(0);
  const [reports, setReports] = useState<ReportWithPhotos[]>([]);
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [draggingLatLng, setDraggingLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [clickLatLng, setClickLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [filterSettlement, setFilterSettlement] = useState<string>('');
  const [locating, setLocating] = useState(false);

  const clearHighlight = () => {
    if (highlightTimerRef.current != null) {
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
    if (highlightMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(highlightMarkerRef.current);
    }
    highlightMarkerRef.current = null;
  };

  const showHighlightAt = async (lat: number, lng: number) => {
    clearHighlight();
    if (!mapRef.current) return;
    const { default: L } = await import('leaflet');
    const icon = L.divIcon({
      className: 'pulse-marker',
      html: '<div class="pulse-marker"><div class="ring"></div><div class="pin"></div></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    const marker = L.marker([lat, lng], {
      icon,
      interactive: false,
      keyboard: false,
    });
    marker.addTo(mapRef.current);
    highlightMarkerRef.current = marker;
    const timer = window.setTimeout(() => {
      clearHighlight();
    }, 5000);
    highlightTimerRef.current = timer;
  };

  // Build API URL with optional filters
  const reportsUrl = () => {
    const params = new URLSearchParams();
    params.set('t', String(Date.now()));
    if (filterSettlement) params.set('settlement', filterSettlement);
    return `/api/reports?${params.toString()}`;
  };

  // Fetch reports (refetch when filters change)
  useEffect(() => {
    const url = reportsUrl();
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
  }, [filterSettlement]);

  const handleGoToSettlement = (value: string) => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;

    let target: { lat: number; lng: number; zoom: number } | null = null;
    if (value === '') {
      target = {
        lat: MUNICIPALITY_CENTER_LOVECH.lat,
        lng: MUNICIPALITY_CENTER_LOVECH.lng,
        zoom: MUNICIPALITY_CENTER_LOVECH.zoom,
      };
    } else if (SETTLEMENT_CENTERS_LOVECH[value]) {
      const { lat, lng, zoom } = SETTLEMENT_CENTERS_LOVECH[value];
      target = { lat, lng, zoom };
    } else if (process.env.NODE_ENV !== 'production' && value) {
      console.warn('[Map] No center found for settlement', value);
    }

    if (!target) return;
    lastGoToTargetRef.current = target;

    if (pendingMoveEndHandlerRef.current && mapRef.current) {
      mapRef.current.off('moveend', pendingMoveEndHandlerRef.current as any);
      pendingMoveEndHandlerRef.current = null;
    }

    map.flyTo([target.lat, target.lng], target.zoom, { duration: 0.8 });

    const handler = () => {
      if (!mapRef.current) return;
      if (pendingMoveEndHandlerRef.current) {
        mapRef.current.off('moveend', pendingMoveEndHandlerRef.current as any);
        pendingMoveEndHandlerRef.current = null;
      }
      const last = lastGoToTargetRef.current;
      if (last) {
        void showHighlightAt(last.lat, last.lng);
      }
    };

    pendingMoveEndHandlerRef.current = handler;
    map.on('moveend', handler);
  };

  const handleBackToMunicipality = () => {
    if (!mapRef.current) return;
    setFilterSettlement('');
    const map = mapRef.current;
    const target = {
      lat: MUNICIPALITY_CENTER_LOVECH.lat,
      lng: MUNICIPALITY_CENTER_LOVECH.lng,
      zoom: MUNICIPALITY_CENTER_LOVECH.zoom,
    };
    lastGoToTargetRef.current = target;

    if (pendingMoveEndHandlerRef.current) {
      map.off('moveend', pendingMoveEndHandlerRef.current as any);
      pendingMoveEndHandlerRef.current = null;
    }

    map.flyTo([target.lat, target.lng], target.zoom, { duration: 0.6 });

    const handler = () => {
      if (!mapRef.current) return;
      if (pendingMoveEndHandlerRef.current) {
        mapRef.current.off('moveend', pendingMoveEndHandlerRef.current as any);
        pendingMoveEndHandlerRef.current = null;
      }
      const last = lastGoToTargetRef.current;
      if (last) {
        void showHighlightAt(last.lat, last.lng);
      }
    };

    pendingMoveEndHandlerRef.current = handler;
    map.on('moveend', handler);
  };

  // Initialize Leaflet map (client-only)
  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;
    if (mapRef.current) return;

    let cancelled = false;

    let handlePointerDown: ((ev: any) => void) | null = null;
    let handlePointerMove: ((ev: any) => void) | null = null;
    let handlePointerUp: (() => void) | null = null;
    let handleMoveStart: (() => void) | null = null;
    let handleZoomStart: (() => void) | null = null;

    import('leaflet').then((L) => {
      if (cancelled) return;
      if (mapRef.current || !containerRef.current) return;

      const map = L.default.map(containerRef.current).setView(LOVECH_CENTER, 14);
      // OSM standard: blue rivers/water, green parks and nature (no API key)
      L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      map.setMinZoom(12);
      map.setMaxZoom(18);

      const container = map.getContainer();

      const getPoint = (ev: any) => {
        const e = ev?.touches?.[0] || ev?.changedTouches?.[0] || ev;
        return e && typeof e.clientX === 'number' && typeof e.clientY === 'number'
          ? { x: e.clientX as number, y: e.clientY as number }
          : null;
      };

      handlePointerDown = (ev: any) => {
        const pt = getPoint(ev);
        if (!pt) return;
        pointerStartRef.current = { x: pt.x, y: pt.y, time: Date.now() };
        isDraggingRef.current = false;
      };

      handlePointerMove = (ev: any) => {
        if (!pointerStartRef.current) return;
        const pt = getPoint(ev);
        if (!pt) return;
        const dx = pt.x - pointerStartRef.current.x;
        const dy = pt.y - pointerStartRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 10) {
          isDraggingRef.current = true;
        }
      };

      handlePointerUp = () => {
        pointerStartRef.current = null;
      };

      container.addEventListener('pointerdown', handlePointerDown, { passive: true });
      container.addEventListener('pointermove', handlePointerMove, { passive: true });
      container.addEventListener('pointerup', handlePointerUp, { passive: true });
      container.addEventListener('touchstart', handlePointerDown, { passive: true });
      container.addEventListener('touchmove', handlePointerMove, { passive: true });
      container.addEventListener('touchend', handlePointerUp, { passive: true });

      handleMoveStart = () => {
        blockClicksUntilRef.current = Date.now() + 250;
      };
      handleZoomStart = () => {
        blockClicksUntilRef.current = Date.now() + 250;
      };

      map.on('movestart', handleMoveStart);
      map.on('zoomstart', handleZoomStart);

      map.on('click', (e: LeafletMouseEvent) => {
        // Don't open report modal if clicking on a marker, cluster, or draggable pin
        const target = e.originalEvent?.target as HTMLElement;
        if (target?.closest('.custom-marker') || target?.closest('.marker-cluster') || target?.closest('.draggable-pin')) {
          return;
        }
        const now = Date.now();
        if (now < blockClicksUntilRef.current) return;
        if (isDraggingRef.current) return;
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
        if (pendingMoveEndHandlerRef.current) {
          mapRef.current.off('moveend', pendingMoveEndHandlerRef.current as any);
          pendingMoveEndHandlerRef.current = null;
        }
        const container = mapRef.current.getContainer();
        if (handlePointerDown) {
          container.removeEventListener('pointerdown', handlePointerDown as any);
          container.removeEventListener('touchstart', handlePointerDown as any);
        }
        if (handlePointerMove) {
          container.removeEventListener('pointermove', handlePointerMove as any);
          container.removeEventListener('touchmove', handlePointerMove as any);
        }
        if (handlePointerUp) {
          container.removeEventListener('pointerup', handlePointerUp as any);
          container.removeEventListener('touchend', handlePointerUp as any);
        }
        if (handleMoveStart) {
          mapRef.current.off('movestart', handleMoveStart as any);
        }
        if (handleZoomStart) {
          mapRef.current.off('zoomstart', handleZoomStart as any);
        }
        mapRef.current.remove();
        mapRef.current = null;
      }
      clearHighlight();
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
        const category = (report.category ?? 'pothole') as ReportCategory;
        const emoji = CATEGORY_ICONS[category] ?? '🕳️';
        const color = colors[report.severity as 1 | 2 | 3] ?? '#64748b';
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<span style="background:${color};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #0f172a;box-shadow:0 2px 8px rgba(0,0,0,0.5);cursor:pointer;font-size:14px;line-height:1;">${emoji}</span>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
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

  // Manage draggable marker for precise location selection
  useEffect(() => {
    if (!mapReady || !mapRef.current || typeof window === 'undefined') return;
    
    const map = mapRef.current;
    
    // If no dragging position, remove existing marker
    if (!draggingLatLng) {
      if (draggableMarkerRef.current) {
        map.removeLayer(draggableMarkerRef.current);
        draggableMarkerRef.current = null;
      }
      return;
    }
    
    import('leaflet').then((L) => {
      if (!mapRef.current) return;
      
      // Remove existing marker if any
      if (draggableMarkerRef.current) {
        map.removeLayer(draggableMarkerRef.current);
      }
      
      // Create draggable pin icon - animation on inner div to avoid overwriting Leaflet's transform
      const pinIcon = L.default.divIcon({
        className: 'draggable-pin',
        html: `
          <div class="pin-inner">
            <div style="position:relative;width:40px;height:52px;">
              <svg width="40" height="52" viewBox="0 0 40 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 0C8.95 0 0 8.95 0 20C0 35 20 52 20 52S40 35 40 20C40 8.95 31.05 0 20 0Z" fill="#ef4444"/>
                <circle cx="20" cy="20" r="8" fill="white"/>
              </svg>
              <div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:#0f172a;color:white;padding:2px 8px;border-radius:4px;font-size:11px;white-space:nowrap;font-weight:500;">
                Плъзни ме
              </div>
            </div>
          </div>
        `,
        iconSize: [40, 52],
        iconAnchor: [20, 52],
      });
      
      const marker = L.default.marker([draggingLatLng.lat, draggingLatLng.lng], {
        icon: pinIcon,
        draggable: true,
        autoPan: true,
      });
      
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setDraggingLatLng({ lat: pos.lat, lng: pos.lng });
      });
      
      marker.addTo(map);
      draggableMarkerRef.current = marker;
      
      // Center map on the pin
      map.panTo([draggingLatLng.lat, draggingLatLng.lng]);
    });
    
    return () => {
      if (draggableMarkerRef.current && mapRef.current) {
        mapRef.current.removeLayer(draggableMarkerRef.current);
        draggableMarkerRef.current = null;
      }
    };
  }, [draggingLatLng, mapReady]);

  const handleCloseModal = () => setClickLatLng(null);
  
  const handleCancelDragging = () => {
    setDraggingLatLng(null);
    setLocating(false);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setDraggingLatLng({ lat, lng });
        setLocating(false);
        if (mapRef.current) {
          mapRef.current.panTo([lat, lng]);
        }
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };
  
  const handleConfirmLocation = () => {
    if (draggingLatLng) {
      setClickLatLng(draggingLatLng);
      setDraggingLatLng(null);
    }
  };

  const refetchReports = () => {
    fetch(reportsUrl(), { cache: 'no-store' })
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
      fetch(reportsUrl(), { cache: 'no-store' })
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

      {/* Filters: settlement — on PC (md+) pushed below header so it doesn't hide it */}
      {mapReady && (
        <div className="absolute top-20 md:top-24 left-2 right-2 z-[1000] flex justify-center pt-[env(safe-area-inset-top)]">
          <div className="w-full max-w-md md:max-w-xl rounded-2xl bg-white/95 backdrop-blur border border-slate-200 shadow-lg p-2 md:p-3">
            <div className="flex flex-row flex-wrap items-center gap-2">
              {/** Sorted settlement options by Bulgarian label */}
              {(() => {
                const settlementOptions = SETTLEMENTS_LOVECH
                  .filter((s) => s !== 'Друго' && s !== 'Other')
                  .slice()
                  .sort((a, b) =>
                    (SETTLEMENT_LABELS_BG[a] ?? a).localeCompare(
                      SETTLEMENT_LABELS_BG[b] ?? b,
                      'bg',
                    ),
                  );
                return (
                  <select
                    value={filterSettlement}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFilterSettlement(value);
                      handleGoToSettlement(value);
                    }}
                    className="min-w-0 flex-1 h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  >
                    <option value="">Всички населени места</option>
                    {settlementOptions.map((s) => (
                      <option key={s} value={s}>{SETTLEMENT_LABELS_BG[s] ?? s}</option>
                    ))}
                  </select>
                );
              })()}
              <button
                type="button"
                onClick={handleBackToMunicipality}
                disabled={!mapReady}
                title="Върни към Община Ловеч"
                className="shrink-0 h-11 rounded-xl border border-slate-200 bg-slate-900 text-white text-sm shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/50 disabled:opacity-60 disabled:cursor-not-allowed px-4"
              >
                Към Община Ловеч
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <span className="text-slate-700">Зареждане на картата...</span>
        </div>
      )}

      {/* Location confirmation dialog */}
      {pendingLatLng && !clickLatLng && !draggingLatLng && (
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
                  setDraggingLatLng(pendingLatLng);
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

      {/* Draggable pin mode - bottom controls */}
      {draggingLatLng && !clickLatLng && (
        <div className="fixed bottom-0 left-0 right-0 z-[2000] p-4 pb-6 sm:pb-4 bg-gradient-to-t from-white via-white to-transparent">
          <div className="max-w-sm mx-auto">
            <p className="text-center text-sm text-slate-600 mb-3">
              Плъзнете маркера до точното място на дупката
            </p>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locating}
              className="w-full py-2.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 active:bg-sky-200 disabled:opacity-60 disabled:cursor-not-allowed transition-smooth text-sm font-medium mb-3 flex items-center justify-center gap-2"
            >
              {locating ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                  Определяне на местоположение...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Моето местоположение
                </>
              )}
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancelDragging}
                className="flex-1 py-3 sm:py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-smooth text-base sm:text-sm shadow-md"
              >
                Отказ
              </button>
              <button
                type="button"
                onClick={handleConfirmLocation}
                className="flex-1 py-3 sm:py-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white font-medium transition-smooth text-base sm:text-sm shadow-md"
              >
                Потвърди
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

