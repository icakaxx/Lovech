# Dev scripts

## fetch-lovech-settlement-centers.mjs

One-time script to fetch lat/lng for Lovech Municipality settlements via OSM Nominatim.

**Usage:** `node scripts/fetch-lovech-settlement-centers.mjs`

**Output:** `scripts/lovech-settlements-centers.json` — array of `{ name, lat, lng, display_name }` or `{ name, error }`.

**Note:** Nominatim may return **403** from some networks (e.g. data centers). If so, run the script from a machine where browser requests work, or use a valid contact email in the User-Agent. Then merge successful entries from the JSON into `lib/types.ts` → `SETTLEMENT_CENTERS_LOVECH`.

**Rate limit:** 1100 ms between requests (Nominatim policy).
