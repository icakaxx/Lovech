/**
 * Shared types for reports and photos.
 */

export type Severity = 1 | 2 | 3;

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
