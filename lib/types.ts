/**
 * Shared types for reports and photos.
 */

export type Severity = 1 | 2 | 3;

/** Multi-category civic reporting (matches Postgres report_category enum). */
export type ReportCategory =
  | 'pothole'
  | 'fallen_tree'
  | 'road_marking'
  | 'street_light'
  | 'traffic_sign'
  | 'hazard';

/** Report status (matches Postgres report_status enum). */
export type ReportStatus = 'new' | 'in_progress' | 'resolved';

export interface Report {
  id: string;
  city: string;
  lat: number;
  lng: number;
  severity: Severity;
  comment: string | null;
  first_name?: string;
  last_name?: string;
  email_hash?: string;
  verify_token_hash?: string | null;
  verified?: boolean;
  created_at: string;
  // Multi-category (backwards compat: city still present)
  municipality?: string;
  settlement?: string;
  category?: ReportCategory;
  status?: ReportStatus;
  updated_at?: string;
  resolved_at?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ReportPhoto {
  id: string;
  report_id: string;
  storage_path: string;
  created_at: string;
}

/** Report with photos joined (for map popups). */
export interface ReportWithPhotos extends Report {
  photos: { storage_path: string }[];
}

/** Severity labels in Bulgarian. */
export const SEVERITY_LABELS: Record<Severity, string> = {
  1: 'До 3 см',
  2: '3–7 см',
  3: 'Над 7 см',
};

/** Category-specific severity labels in Bulgarian. */
export const CATEGORY_SEVERITY_LABELS: Record<ReportCategory, Record<Severity, string>> = {
  pothole: {
    1: 'До 3 см',
    2: '3–7 см',
    3: 'Над 7 см',
  },
  fallen_tree: {
    1: 'Малки клони (частично на пътя)',
    2: 'Големи клони (пречи на преминаване)',
    3: 'Паднало дърво / блокира пътя',
  },
  road_marking: {
    1: 'Частично изтрита (все още се вижда)',
    2: 'Почти невидима',
    3: 'Липсва напълно / опасно',
  },
  street_light: {
    1: 'Примигва / слаба светлина',
    2: 'Не свети (1 лампа)',
    3: 'Не свети (цял участък / много лампи)',
  },
  traffic_sign: {
    1: 'Повреден, но видим',
    2: 'Паднал / обърнат',
    3: 'Липсва критичен знак (STOP/ОПАСНОСТ)',
  },
  hazard: {
    1: 'Локален риск (може да се мине)',
    2: 'Опасно при преминаване (особено нощем/дъжд)',
    3: 'Висок риск / участъкът е компрометиран',
  },
};

/** Category labels in Bulgarian. */
export const CATEGORY_LABELS: Record<ReportCategory, string> = {
  pothole: 'Пътни неравности / дупки',
  fallen_tree: 'Паднали клони / дървета',
  road_marking: 'Изтрита маркировка / пешеходна пътека',
  street_light: 'Несветеща / повредена лампа',
  traffic_sign: 'Паднал / липсващ знак',
  hazard: 'Опасен участък / срутване',
};

/** Status labels in Bulgarian. */
export const STATUS_LABELS: Record<ReportStatus, string> = {
  new: 'Нов',
  in_progress: 'В процес',
  resolved: 'Решен',
};

/** Marker emoji per category (for map). */
export const CATEGORY_ICONS: Record<ReportCategory, string> = {
  pothole: '🕳️',
  fallen_tree: '🌳',
  road_marking: '🦓',
  street_light: '💡',
  traffic_sign: '🚫',
  hazard: '⚠️',
};

/** Settlements in Община Ловеч (for dropdown). */
export const SETTLEMENTS_LOVECH: string[] = [
  'Lovech',
  'Bahovitsa',
  'Aleksandrovo',
  'Slavyani',
  'Vladinya',
  'Goran',
  'Hlevene',
  'Kazachevo',
  'Lisets',
  'Malinovo',
  'Skobelevo',
  'Yoglav',
  'Radyuvene',
  'Sokolovo',
  'Slivek',
  'Presyaka',
  'Gostinya',
  'Smochan',
  'Slatina',
  'Doyrentsi',
  'Umarevtsi',
  'Друго',
];

/** Center + zoom per settlement (for map flyTo). Keys must match SETTLEMENTS_LOVECH (excluding Друго). Lat/lng can be refreshed by running scripts/fetch-lovech-settlement-centers.mjs and merging scripts/lovech-settlements-centers.json. */
export const SETTLEMENT_CENTERS_LOVECH: Record<string, { lat: number; lng: number; zoom: number }> = {
  Lovech:       { lat: 43.143214201771464, lng: 24.70434890006551,  zoom: 13 },
  Bahovitsa:    { lat: 43.18867924232698,  lng: 24.682703215857362, zoom: 13 },
  Aleksandrovo: { lat: 43.263485163031106, lng: 24.93914766050204,  zoom: 13 },
  Slavyani:     { lat: 43.2226968456665,   lng: 24.679719381073802, zoom: 13 },
  Vladinya:     { lat: 43.291833980959524, lng: 24.79366642626967,  zoom: 13 },
  Goran:        { lat: 43.20340048878466,  lng: 24.742856575322325, zoom: 13 },
  Hlevene:      { lat: 43.08866912728859,  lng: 24.70450360106252,  zoom: 13 },
  Kazachevo:    { lat: 43.080771947484685, lng: 24.749558197055453, zoom: 13 },
  Lisets:       { lat: 43.184498831725996, lng: 24.65731716585288,  zoom: 13 },
  Malinovo:     { lat: 43.03818774541016,  lng: 24.884369324257232, zoom: 13 },
  Skobelevo:    { lat: 43.1558023736934,   lng: 24.65759247788928,  zoom: 13 },
  Yoglav:       { lat: 43.208623452483884, lng: 24.824409569844295, zoom: 13 },
  Radyuvene:    { lat: 43.12573932941868,  lng: 24.60238129782971,  zoom: 13 },
  Sokolovo:     { lat: 43.0729834942493,   lng: 24.626895185649943, zoom: 13 },
  Slivek:       { lat: 43.09905307010572,  lng: 24.748604488336365, zoom: 13 },
  Presyaka:     { lat: 43.1568063030826,   lng: 24.773548444363975, zoom: 13 },
  Gostinya:     { lat: 43.158061202538974, lng: 24.831607652359263, zoom: 13 },
  Smochan:      { lat: 43.18284018591901,  lng: 24.798492400391574, zoom: 13 },
  Slatina:      { lat: 43.2535967929977,   lng: 24.72723214191891,  zoom: 13 },
  Doyrentsi:    { lat: 43.231284636810045, lng: 24.83739829825162,  zoom: 13 },
  Umarevtsi:    { lat: 43.192359667799465, lng: 24.782863367178326, zoom: 13 },
};

/** Bulgarian labels for settlements (UI display). */
export const SETTLEMENT_LABELS_BG: Record<string, string> = {
  Lovech: 'Ловеч',
  Bahovitsa: 'Баховица',
  Aleksandrovo: 'Александрово',
  Slavyani: 'Славяни',
  Vladinya: 'Владиня',
  Goran: 'Горан',
  Hlevene: 'Хлевене',
  Kazachevo: 'Казачево',
  Lisets: 'Лисец',
  Malinovo: 'Малиново',
  Skobelevo: 'Скобелево',
  Yoglav: 'Йоглав',
  Radyuvene: 'Радювене',
  Sokolovo: 'Соколово',
  Slivek: 'Сливек',
  Presyaka: 'Пресяка',
  Gostinya: 'Гостиня',
  Smochan: 'Смочан',
  Slatina: 'Слатина',
  Doyrentsi: 'Дойренци',
  Umarevtsi: 'Умаревци',
};

/** Municipality overview (all settlements). */
export const MUNICIPALITY_CENTER_LOVECH = { lat: 43.1332, lng: 24.7151, zoom: 12 };

/** Padding (degrees) for max bounds around all settlement centers. */
const BOUNDS_PADDING = 0.03;

/** Map max bounds: min/max of all SETTLEMENT_CENTERS_LOVECH + BOUNDS_PADDING. Leaflet: [[south, west], [north, east]]. */
function computeMunicipalityBounds(): [[number, number], [number, number]] {
  const centers = Object.values(SETTLEMENT_CENTERS_LOVECH);
  const lats = centers.map((c) => c.lat);
  const lngs = centers.map((c) => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return [
    [minLat - BOUNDS_PADDING, minLng - BOUNDS_PADDING],
    [maxLat + BOUNDS_PADDING, maxLng + BOUNDS_PADDING],
  ];
}

export const MUNICIPALITY_BOUNDS_LOVECH = computeMunicipalityBounds();
