-- ============================================
-- Migration 002: Multi-category civic reporting (Община Ловеч)
-- Idempotent: safe to run multiple times.
-- Run in Supabase SQL Editor.
-- ============================================

-- 1) Create ENUM types (ignore if already exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_category') THEN
    CREATE TYPE report_category AS ENUM (
      'pothole', 'fallen_tree', 'road_marking', 'street_light', 'traffic_sign', 'hazard'
    );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL; -- already exists
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE report_status AS ENUM ('new', 'in_progress', 'resolved');
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Add new columns to reports
ALTER TABLE reports ADD COLUMN IF NOT EXISTS municipality text NOT NULL DEFAULT 'Lovech';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS settlement text NOT NULL DEFAULT 'Lovech';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS category report_category NOT NULL DEFAULT 'pothole';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS status report_status NOT NULL DEFAULT 'new';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3) Optional: migrate settlement from city where we have non-default city
UPDATE reports
SET settlement = city
WHERE settlement = 'Lovech' AND city IS NOT NULL AND city != 'Lovech';

-- 4) Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reports_verified ON reports (verified);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports (category);
CREATE INDEX IF NOT EXISTS idx_reports_municipality_settlement ON reports (municipality, settlement);
CREATE INDEX IF NOT EXISTS idx_reports_created_at_desc ON reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_lat_lng ON reports (lat, lng);

-- 5) Trigger function: set updated_at on UPDATE
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6) Trigger (drop first to avoid duplicate, then create)
DROP TRIGGER IF EXISTS reports_set_updated_at ON reports;
CREATE TRIGGER reports_set_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();
