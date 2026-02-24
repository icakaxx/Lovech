# DEBUG: Map flies to settlement then snaps back to Lovech — Diagnosis

## 1) Exact flyTo useEffect code (full block)

**Location:** `Lovech/components/Map.tsx` (lines 78–95)

```tsx
  // Auto flyTo when user changes the settlement filter (not on initial mount)
  const prevFilterSettlementRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    if (prevFilterSettlementRef.current === undefined) {
      prevFilterSettlementRef.current = filterSettlement;
      return;
    }
    if (prevFilterSettlementRef.current === filterSettlement) return;
    prevFilterSettlementRef.current = filterSettlement;
    const map = mapRef.current;
    if (filterSettlement === '') {
      map.flyTo([MUNICIPALITY_CENTER_LOVECH.lat, MUNICIPALITY_CENTER_LOVECH.lng], MUNICIPALITY_CENTER_LOVECH.zoom, { duration: 0.8 });
    } else if (SETTLEMENT_CENTERS_LOVECH[filterSettlement]) {
      const { lat, lng, zoom } = SETTLEMENT_CENTERS_LOVECH[filterSettlement];
      map.flyTo([lat, lng], zoom, { duration: 0.8 });
    }
  }, [filterSettlement, mapReady]);
```

- **Dependency array:** `[filterSettlement, mapReady]`
- **Skip-first-run logic:** `prevFilterSettlementRef` is used. On first run, `prevFilterSettlementRef.current === undefined`, so we set `prevFilterSettlementRef.current = filterSettlement` and return without calling `flyTo`. On later runs we only `flyTo` when `prevFilterSettlementRef.current !== filterSettlement`, then update the ref to the current `filterSettlement`.

---

## 2) All places in Map.tsx where map position is changed

| Pattern | Location | When it runs |
|--------|----------|---------------|
| **map.setView** | Map init effect | Once when the Leaflet map is created (client-only, empty deps). |
| **map.setMaxBounds** | Map init effect | Once at init; constrains view, does not move center. |
| **map.flyTo** (settlement) | flyTo useEffect | When `filterSettlement` or `mapReady` change and the “skip first run” logic allows it. |
| **map.panTo** | Draggable-pin effect | When `draggingLatLng` is set and the draggable marker is added; centers map on the pin. |
| **map.flyTo** (submit success) | handleSubmitSuccess | When user closes the report modal after a successful submit; flies to the new report. |
| **autoPan: true** | Draggable marker options | Leaflet option on the draggable marker; pans map when user drags the pin (not on filter change). |

### Snippets with context

**A) setView + setMaxBounds (map init, ~lines 98–117)**

```tsx
  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;
    if (mapRef.current) return;
    let cancelled = false;
    import('leaflet').then((L) => {
      // ...
      const map = L.default.map(containerRef.current).setView(LOVECH_CENTER, 14);
      // ...
      map.setMaxBounds(LOVECH_BOUNDS);
      map.setMinZoom(12);
      map.setMaxZoom(18);
      // ...
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
      // ...
    };
  }, []);
```

Runs once on mount. Sets initial view to `LOVECH_CENTER` (43.1332, 24.7151) zoom 14, then sets `mapReady` to `true`.

**B) flyTo in settlement effect**  
Already shown in section 1. Runs when `filterSettlement` or `mapReady` change (and skip-first-run allows it).

**C) panTo + autoPan (draggable pin, ~lines 238–287)**

```tsx
  useEffect(() => {
    if (!mapReady || !mapRef.current || typeof window === 'undefined') return;
    const map = mapRef.current;
    if (!draggingLatLng) {
      if (draggableMarkerRef.current) {
        map.removeLayer(draggableMarkerRef.current);
        draggableMarkerRef.current = null;
      }
      return;
    }
    import('leaflet').then((L) => {
      // ...
      const marker = L.default.marker([draggingLatLng.lat, draggingLatLng.lng], {
        icon: pinIcon,
        draggable: true,
        autoPan: true,
      });
      // ...
      marker.addTo(map);
      draggableMarkerRef.current = marker;
      map.panTo([draggingLatLng.lat, draggingLatLng.lng]);
    });
    // ...
  }, [draggingLatLng, mapReady]);
```

Runs when `draggingLatLng` or `mapReady` change. Only applies when the user is placing a report (pin on map); not when changing the settlement filter.

**D) flyTo in handleSubmitSuccess (~lines 324–335)**

```tsx
  const handleSubmitSuccess = (lat: number, lng: number) => {
    setClickLatLng(null);
    if (mapRef.current) {
      mapRef.current.flyTo([lat, lng], 16, { duration: 0.5 });
    }
    const doRefetch = () => { ... };
    doRefetch();
    setTimeout(doRefetch, 1500);
  };
```

Runs only when the user successfully submits a report and the modal calls `onSuccess(lat, lng)`. Not triggered by the settlement dropdown.

---

## 3) filterSettlement state changes

**Settlement `<select>` and handler:**

```tsx
          <select
            value={filterSettlement}
            onChange={(e) => setFilterSettlement(e.target.value)}
            className="..."
          >
            <option value="">Всички населени места</option>
            {SETTLEMENTS_LOVECH.filter((s) => s !== 'Друго' && s !== 'Other').map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
```

- **Handler:** `onChange={(e) => setFilterSettlement(e.target.value)}` — only this updates `filterSettlement` from the UI.
- **Repo search for `setFilterSettlement(`:**
  - **Lovech/components/Map.tsx** (line 372): `onChange={(e) => setFilterSettlement(e.target.value)}` — the only call site in app code.
  - **Lovech/EXTRACTED-CODE-AND-FINDINGS.md**: documentation only, no second call site.

So nothing else in the app calls `setFilterSettlement`; only the settlement `<select>` does.

---

## 4) Can the flyTo effect re-run due to other state changes?

- **Dependency array:** `[filterSettlement, mapReady]`
- **Other state in Map:** `reports`, `loading`, `pendingLatLng`, `draggingLatLng`, `clickLatLng`, `filterCategory`. None of these are in the flyTo effect’s dependency array.

So the effect runs only when:

1. **filterSettlement** changes (e.g. user selects a settlement or “Всички населени места”).
2. **mapReady** changes (only in map init: from `false` to `true`, and in init cleanup: to `false`).

After the user selects a settlement:

- Fetch effect runs (it depends on `filterSettlement`), then `setReports(...)` and `setLoading(false)` run. That does **not** change `filterSettlement` or `mapReady`, so it does **not** by itself re-run the flyTo effect.
- If the flyTo effect runs again and the map snaps back to Lovech, then either:
  - **filterSettlement** has changed again (e.g. back to `''`), or
  - **mapReady** has changed (e.g. init cleanup + re-run setting it back to `true`), or
  - The component remounted (state reset: `filterSettlement === ''`, so first “real” run of the effect would fly to municipality).

So: the effect can re-run and cause a snap-back **only** if `filterSettlement` or `mapReady` (or both) change again after the user’s selection, or if the component remounts.

---

## 5) Exact keys for settlement constants

**SETTLEMENTS_LOVECH** (from `lib/types.ts`):

- `'Lovech'`
- `'Bahovitsa'`
- `'Aleksandrovo'`
- `'Slavyani'`
- `'Vladinya'`
- `'Goran'`
- `'Malinovo'`
- `'Radochina'`
- `'Skobelevo'`
- `'Yoglav'`
- `'Друго'`

**SETTLEMENT_CENTERS_LOVECH keys** (from `lib/types.ts`):

- `'Lovech'`, `'Bahovitsa'`, `'Aleksandrovo'`, `'Slavyani'`, `'Vladinya'`, `'Goran'`, `'Malinovo'`, `'Radochina'`, `'Skobelevo'`, `'Yoglav'`

**Mismatch:**  
The dropdown uses `SETTLEMENTS_LOVECH.filter((s) => s !== 'Друго' && s !== 'Other')`, so the options passed to the select are exactly the same 10 keys as in `SETTLEMENT_CENTERS_LOVECH`. No case or whitespace mismatch; `SETTLEMENT_CENTERS_LOVECH[filterSettlement]` will exist for any selected settlement except “Всички населени места” (value `''`).

---

## 6) Reproduction logging plan (do NOT implement yet)

Add temporary logs to confirm why the map snaps back:

**a) In the settlement `<select>` onChange**

- Log the new value and a timestamp so we see every time the user (or anything else) changes the filter.
- Example: right after `setFilterSettlement(e.target.value)` (or inside the handler):  
  `console.log('[Map] settlement select onChange', { value: e.target.value, time: Date.now() });`

**b) At the start of the flyTo useEffect**

- Log deps and ref so we see every time the effect runs and with what state.
- Example: first line inside the effect:  
  `console.log('[Map] flyTo effect run', { filterSettlement, mapReady, prev: prevFilterSettlementRef.current });`

**c) Right before executing flyTo**

- Log only when we are about to call `map.flyTo`, and with the target (municipality vs settlement).
- Example: right before each `map.flyTo(...)`:  
  `console.log('[Map] flyTo executing', filterSettlement === '' ? 'MUNICIPALITY' : filterSettlement, { lat, lng, zoom });`  
  (for the municipality branch, use `MUNICIPALITY_CENTER_LOVECH`; for the settlement branch you already have `lat`, `lng`, `zoom`.)

Interpretation:

- If we see the effect run twice — first with the chosen settlement, then with `filterSettlement === ''` — then something is resetting `filterSettlement` to `''` (or the component is remounting).
- If we see only one effect run with the correct settlement but the map still moves, then something else is moving the map (no other `flyTo`/`setView`/`panTo` found besides init, draggable pin, and submit success; logging would confirm no extra effect run with `''`).

---

## Most likely root cause

- **The flyTo effect is running a second time with `filterSettlement === ''`**, so the map flies to the settlement and then flies back to the municipality center. That can happen if:
  1. **Parent re-mounts `Map`** (e.g. key or conditional render), so state resets and `filterSettlement` is `''` again; when the map becomes ready, the effect runs and flies to municipality. The dropdown would also reset to “Всички населени места” in that case.
  2. **Something triggers the settlement select to fire `onChange` with `value === ''`** (e.g. re-render that restores the first option, or a bug in how the controlled value is set), so `setFilterSettlement('')` is called and the effect runs again with `filterSettlement === ''`, causing the second flyTo to municipality.

- **Less likely:** `mapReady` toggling (e.g. init effect cleanup and then running again) could re-run the effect; with the current code that would require the map init effect’s cleanup to run while the component is still mounted, which is unusual unless the component or a parent is remounting.

Adding the three log points above will show whether the effect runs twice and with which `filterSettlement`/`mapReady` values, and whether the select fires again with `''`, which is enough to confirm the root cause before changing any logic.
