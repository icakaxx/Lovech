#!/usr/bin/env node
/**
 * One-time script: fetch lat/lng for Lovech Municipality settlements via OSM Nominatim.
 * Usage: node scripts/fetch-lovech-settlement-centers.mjs
 * Output: scripts/lovech-settlements-centers.json
 * Requires Node 18+ (built-in fetch). Rate limit: 1100ms between requests.
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SETTLEMENT_NAMES = [
  'Lovech',
  'Bahovitsa',
  'Lisets',
  'Hlevene',
  'Kazachevo',
  'Slavyani',
  'Vladinya',
  'Goran',
  'Malinovo',
  'Skobelevo',
  'Yoglav',
  'Aleksandrovo',
];

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'signalilovech/1.0 (contact: signalilovech@example.com)';
const RATE_LIMIT_MS = 1100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSettlement(name) {
  const q = `${encodeURIComponent(name)}, Lovech Municipality, Lovech Province, Bulgaria`;
  const url = `${NOMINATIM_URL}?format=jsonv2&limit=1&q=${q}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) {
    return { name, error: `http_${res.status}` };
  }
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    return { name, error: 'not_found' };
  }
  const first = data[0];
  return {
    name,
    lat: parseFloat(first.lat),
    lng: parseFloat(first.lon),
    display_name: first.display_name || '',
  };
}

async function main() {
  const results = [];
  for (let i = 0; i < SETTLEMENT_NAMES.length; i++) {
    const name = SETTLEMENT_NAMES[i];
    process.stderr.write(`Fetching ${i + 1}/${SETTLEMENT_NAMES.length}: ${name}... `);
    try {
      const row = await fetchSettlement(name);
      results.push(row);
      if (row.error) {
        process.stderr.write(`FAIL (${row.error})\n`);
      } else {
        process.stderr.write(`OK (${row.lat}, ${row.lng})\n`);
      }
    } catch (err) {
      results.push({ name, error: err.message || 'request_failed' });
      process.stderr.write(`FAIL (${err.message})\n`);
    }
    if (i < SETTLEMENT_NAMES.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  const outPath = join(__dirname, 'lovech-settlements-centers.json');
  writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nWrote ${outPath}`);

  const succeeded = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);
  console.log(`Succeeded: ${succeeded.length} – ${succeeded.map((r) => r.name).join(', ')}`);
  if (failed.length) {
    console.log(`Failed: ${failed.length} – ${failed.map((r) => `${r.name} (${r.error})`).join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
