# Extracted Code and Findings for signalilovech / Lovech

MAP PROVIDER: **leaflet** (with leaflet.markercluster and OpenStreetMap tiles)

---

## 1) Map provider evidence

**Dependencies (from `Lovech/package.json`):**
- `leaflet`: ^1.9.4
- `leaflet.markercluster`: ^1.5.3
- `react-leaflet`: ^4.2.1
- `@types/leaflet`, `@types/leaflet.markercluster` (devDependencies)

**Map component imports (from `components/Map.tsx`):**
```ts
import type { Map as LMap, Marker as LMarker, LeafletMouseEvent } from 'leaflet';
import type { MarkerClusterGroup } from 'leaflet';
```

**Runtime usage:** Map is created with `L.default.map(containerRef.current)`, tiles from `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, markers via `L.marker` + `L.divIcon`, clustering via `markerClusterGroup()`. No MapContainer/react-leaflet components — imperative Leaflet API.

---

## 2) Full file contents

### FILE: `Lovech/components/Map.tsx`

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReportWithPhotos, ReportCategory } from '@/lib/types';
import { CATEGORY_ICONS, CATEGORY_LABELS, SETTLEMENTS_LOVECH } from '@/lib/types';
import type { Map as LMap, Marker as LMarker, LeafletMouseEvent } from 'leaflet';
import type { MarkerClusterGroup } from 'leaflet';
import { ReportModal } from '@/components/ReportModal';
import { getPopupContent } from '@/components/MarkerPopup';

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
  const draggableMarkerRef = useRef<LMarker | null>(null);
  const markersRunIdRef = useRef(0);
  const [reports, setReports] = useState<ReportWithPhotos[]>([]);
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [draggingLatLng, setDraggingLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [clickLatLng, setClickLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [filterCategory, setFilterCategory] = useState<ReportCategory | ''>('');
  const [filterSettlement, setFilterSettlement] = useState<string>('');

  const reportsUrl = () => {
    const params = new URLSearchParams();
    params.set('t', String(Date.now()));
    if (filterCategory) params.set('category', filterCategory);
    if (filterSettlement) params.set('settlement', filterSettlement);
    return `/api/reports?${params.toString()}`;
  };

  useEffect(() => {
    const url = reportsUrl();
    fetch(url, { cache: 'no-store', headers: { Pragma: 'no-cache' } })
      .then((res) => res.json())
      .then((data) => {
        const list = data?.reports;
        if (Array.isArray(list)) {
          setReports((prev) => {
            const apiIds = new Set(list.map((r: ReportWithPhotos) => r.id));
            const missingFromApi = prev.filter((r) => !apiIds.has(r.id));
            return missingFromApi.length ? [...missingFromApi, ...list] : list;
          });
        } else if (list === undefined && data?.error) {
          setReports(Array.isArray(data.reports) ? data.reports : []);
        }
      })
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [filterCategory, filterSettlement]);

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;
    if (mapRef.current) return;
    let cancelled = false;
    import('leaflet').then((L) => {
      if (cancelled) return;
      if (mapRef.current || !containerRef.current) return;
      const map = L.default.map(containerRef.current).setView(LOVECH_CENTER, 14);
      L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      map.setMaxBounds(LOVECH_BOUNDS);
      map.setMinZoom(12);
      map.setMaxZoom(18);
      map.on('click', (e: LeafletMouseEvent) => {
        const target = e.originalEvent?.target as HTMLElement;
        if (target?.closest('.custom-marker') || target?.closest('.marker-cluster') || target?.closest('.draggable-pin')) return;
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
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      markersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || typeof window === 'undefined') return;
    markersRunIdRef.current += 1;
    const thisRunId = markersRunIdRef.current;
    const reportsToShow = [...reports];
    Promise.all([import('leaflet'), import('leaflet.markercluster')]).then(([LMod]) => {
      const L = LMod.default;
      if (thisRunId !== markersRunIdRef.current) return;
      const map = mapRef.current;
      if (!map) return;
      if (clusterGroupRef.current) map.removeLayer(clusterGroupRef.current as unknown as L.Layer);
      markersRef.current = [];
      const clusterGroup = (L as typeof L & { markerClusterGroup: (opts?: object) => L.Layer }).markerClusterGroup({
        maxClusterRadius: 50, spiderfyOnMaxZoom: true, showCoverageOnHover: false, zoomToBoundsOnClick: true,
      });
      clusterGroupRef.current = clusterGroup;
      map.addLayer(clusterGroup);
      const colors: Record<1 | 2 | 3, string> = { 1: '#22c55e', 2: '#eab308', 3: '#ef4444' };
      reportsToShow.forEach((report) => {
        const lat = Number(report.lat);
        const lng = Number(report.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const category = (report.category ?? 'pothole') as ReportCategory;
        const emoji = CATEGORY_ICONS[category] ?? '🕳️';
        const color = colors[report.severity as 1 | 2 | 3] ?? '#64748b';
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<span style="background:${color};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #0f172a;box-shadow:0 2px 8px rgba(0,0,0,0.5);cursor:pointer;font-size:14px;line-height:1;">${emoji}</span>`,
          iconSize: [28, 28], iconAnchor: [14, 14],
        });
        const marker = L.marker([lat, lng], { icon });
        marker.bindPopup('', { maxWidth: 320, minWidth: 280 });
        marker.on('popupopen', () => {
          const popup = marker.getPopup();
          if (popup) popup.setContent(getPopupContent(report, BUCKET_URL ?? ''));
        });
        clusterGroup.addLayer(marker);
        markersRef.current.push(marker);
      });
    });
  }, [reports, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || typeof window === 'undefined') return;
    const map = mapRef.current;
    if (!draggingLatLng) {
      if (draggableMarkerRef.current) { map.removeLayer(draggableMarkerRef.current); draggableMarkerRef.current = null; }
      return;
    }
    import('leaflet').then((L) => {
      if (!mapRef.current) return;
      if (draggableMarkerRef.current) map.removeLayer(draggableMarkerRef.current);
      const pinIcon = L.default.divIcon({
        className: 'draggable-pin',
        html: `<div class="pin-inner"><div style="position:relative;width:40px;height:52px;"><svg width="40" height="52" viewBox="0 0 40 52" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 0C8.95 0 0 8.95 0 20C0 35 20 52 20 52S40 35 40 20C40 8.95 31.05 0 20 0Z" fill="#ef4444"/><circle cx="20" cy="20" r="8" fill="white"/></svg><div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:#0f172a;color:white;padding:2px 8px;border-radius:4px;font-size:11px;white-space:nowrap;font-weight:500;">Плъзни ме</div></div></div>`,
        iconSize: [40, 52], iconAnchor: [20, 52],
      });
      const marker = L.default.marker([draggingLatLng.lat, draggingLatLng.lng], { icon: pinIcon, draggable: true, autoPan: true });
      marker.on('dragend', () => { const pos = marker.getLatLng(); setDraggingLatLng({ lat: pos.lat, lng: pos.lng }); });
      marker.addTo(map);
      draggableMarkerRef.current = marker;
      map.panTo([draggingLatLng.lat, draggingLatLng.lng]);
    });
    return () => {
      if (draggableMarkerRef.current && mapRef.current) { mapRef.current.removeLayer(draggableMarkerRef.current); draggableMarkerRef.current = null; }
    };
  }, [draggingLatLng, mapReady]);

  const handleCloseModal = () => setClickLatLng(null);
  const handleCancelDragging = () => setDraggingLatLng(null);
  const handleConfirmLocation = () => {
    if (draggingLatLng) { setClickLatLng(draggingLatLng); setDraggingLatLng(null); }
  };
  const handleReportSubmitted = (report: ReportWithPhotos) => {
    const safeReport = { ...report, lat: Number.isFinite(Number(report.lat)) ? Number(report.lat) : (clickLatLng?.lat ?? report.lat), lng: Number.isFinite(Number(report.lng)) ? Number(report.lng) : (clickLatLng?.lng ?? report.lng) };
    setReports((prev) => [safeReport, ...prev]);
  };
  const handleSubmitSuccess = (lat: number, lng: number) => {
    setClickLatLng(null);
    if (mapRef.current) mapRef.current.flyTo([lat, lng], 16, { duration: 0.5 });
    const doRefetch = () => fetch(reportsUrl(), { cache: 'no-store' }).then((res) => res.json()).then((data) => {
      if (!Array.isArray(data?.reports)) return;
      setReports((prev) => { const apiIds = new Set(data.reports.map((r: ReportWithPhotos) => r.id)); const missingFromApi = prev.filter((r) => !apiIds.has(r.id)); return [...missingFromApi, ...data.reports]; });
    }).catch(() => {});
    doRefetch();
    setTimeout(doRefetch, 1500);
  };

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      {mapReady && (
        <div className="absolute top-2 left-2 right-2 z-[1000] flex flex-wrap gap-2">
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as ReportCategory | '')} className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-sm text-slate-800 shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500/50">
            <option value="">Всички категории</option>
            {(Object.keys(CATEGORY_LABELS) as ReportCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_ICONS[c]} {CATEGORY_LABELS[c]}</option>)}
          </select>
          <select value={filterSettlement} onChange={(e) => setFilterSettlement(e.target.value)} className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-sm text-slate-800 shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500/50">
            <option value="">Всички населени места</option>
            {SETTLEMENTS_LOVECH.filter((s) => s !== 'Друго').map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}
      {loading && <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/80 backdrop-blur-sm"><span className="text-slate-700">Зареждане на картата...</span></div>}
      {!loading && mapReady && reports.length === 0 && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[400] pointer-events-none">
          <p className="text-slate-700 text-sm text-center px-4 py-2 rounded-lg bg-white/95 backdrop-blur border border-slate-200 shadow-md">Няма потвърдени сигнали. Кликни на картата, за да подадеш нов.</p>
        </div>
      )}
      {pendingLatLng && !clickLatLng && !draggingLatLng && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
          <div className="rounded-t-2xl sm:rounded-2xl bg-white border border-slate-200 shadow-xl w-full sm:max-w-sm p-5 text-center">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Подаване на сигнал</h3>
            <p className="text-sm text-slate-600 mb-4">Искате ли да подадете сигнал за дупка на това място?</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setPendingLatLng(null)} className="flex-1 py-3 sm:py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">Не</button>
              <button type="button" onClick={() => { setDraggingLatLng(pendingLatLng); setPendingLatLng(null); }} className="flex-1 py-3 sm:py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium">Да, продължи</button>
            </div>
          </div>
        </div>
      )}
      {draggingLatLng && !clickLatLng && (
        <div className="fixed bottom-0 left-0 right-0 z-[2000] p-4 pb-6 sm:pb-4 bg-gradient-to-t from-white via-white to-transparent">
          <div className="max-w-sm mx-auto">
            <p className="text-center text-sm text-slate-600 mb-3">Плъзнете маркера до точното място на дупката</p>
            <div className="flex gap-3">
              <button type="button" onClick={handleCancelDragging} className="flex-1 py-3 sm:py-2 rounded-lg border border-slate-300 bg-white text-slate-700">Отказ</button>
              <button type="button" onClick={handleConfirmLocation} className="flex-1 py-3 sm:py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium">Потвърди</button>
            </div>
          </div>
        </div>
      )}
      {clickLatLng && <ReportModal lat={clickLatLng.lat} lng={clickLatLng.lng} onClose={handleCloseModal} onSuccess={handleSubmitSuccess} onReportSubmitted={handleReportSubmitted} />}
    </div>
  );
}
```

---

### FILE: `Lovech/components/ReportModal.tsx`

(Full content — category/settlement state, form fields, FormData build, submit to `/api/reports/submit`. Omitted here for length; see repo file.)

---

### FILE: `Lovech/app/api/reports/submit/route.ts`

- **Supabase insert object (exact):**
```ts
await supabase.from('reports').insert({
  city: settlement,
  lat,
  lng,
  severity,
  comment,
  first_name: firstName,
  last_name: lastName,
  email_hash: emailHash,
  verify_token_hash: null,
  verified: true,
  municipality,
  settlement,
  category,
  status: 'new',
  metadata: {},
})
.select('id, city, lat, lng, severity, comment, first_name, last_name, created_at, municipality, settlement, category, status')
.single();
```

---

### FILE: `Lovech/app/api/reports/route.ts`

- **GET:** `req.url` → `searchParams.get('category')`, `searchParams.get('settlement')`, `searchParams.get('municipality')`. Query built with `.eq('verified', true)` and optional `.eq('category', category)`, `.eq('settlement', settlement)`, `.eq('municipality', municipality)`. Select includes: `id, city, lat, lng, severity, comment, first_name, last_name, created_at, municipality, settlement, category, status, updated_at, resolved_at`. Photos fetched separately and merged.

---

### FILE: `Lovech/lib/types.ts`

- **Types:** `Severity`, `ReportCategory`, `ReportStatus`, `Report`, `ReportPhoto`, `ReportWithPhotos`.
- **Constants:** `SEVERITY_LABELS`, `CATEGORY_LABELS`, `STATUS_LABELS`, `CATEGORY_ICONS`, `SETTLEMENTS_LOVECH` (Lovech, Bahovitsa, Aleksandrovo, Slavyani, Vladinya, Goran, Malinovo, Radochina, Skobelevo, Yoglav, Друго).

---

## 3) Additional extractions

### Where selectedSettlement / selectedCategory state is stored

- **ReportModal (submit form):**  
  `const [category, setCategory] = useState<ReportCategory>('pothole');`  
  `const [settlement, setSettlement] = useState('Lovech');`  
  `const [settlementOther, setSettlementOther] = useState('');`
- **Map (filters):**  
  `const [filterCategory, setFilterCategory] = useState<ReportCategory | ''>('');`  
  `const [filterSettlement, setFilterSettlement] = useState<string>('');`

### Payload sent on submit (FormData fields)

- `lat`, `lng`, `category`, `settlement`, `municipality`, `severity`, `comment`, `first_name`, `last_name`, `images` (multiple files).

### Exact Supabase insert object (submit route)

- See block under `Lovech/app/api/reports/submit/route.ts` above.

### Map fetch URL + query params

- **URL builder (Map.tsx):**
```ts
const reportsUrl = () => {
  const params = new URLSearchParams();
  params.set('t', String(Date.now()));
  if (filterCategory) params.set('category', filterCategory);
  if (filterSettlement) params.set('settlement', filterSettlement);
  return `/api/reports?${params.toString()}`;
};
```
- **Fetch:** `fetch(reportsUrl(), { cache: 'no-store', headers: { Pragma: 'no-cache' } })` in a `useEffect` with deps `[filterCategory, filterSettlement]`.

---

*Generated for use with another assistant; paths and code match the Lovech project.*
