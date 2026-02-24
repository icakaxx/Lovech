-- ============================================
-- SUPABASE SCHEMA: Дупките на Ловеч
-- Run this in Supabase SQL Editor to create tables and storage.
-- ============================================

-- Table: reports
-- Stores pothole reports. Only rows with verified = true are shown on the map.
-- create table reports (
--   id uuid primary key default gen_random_uuid(),
--   city text not null default 'Lovech',
--   lat float8 not null,
--   lng float8 not null,
--   severity int not null check (severity in (1, 2, 3)),
--   comment text,
--   email_hash text not null,
--   verify_token_hash text,
--   verified boolean not null default false,
--   created_at timestamptz not null default now()
-- );

-- Table: report_photos
-- Links report to uploaded images in storage.
-- create table report_photos (
--   id uuid primary key default gen_random_uuid(),
--   report_id uuid not null references reports(id) on delete cascade,
--   storage_path text not null,
--   created_at timestamptz not null default now()
-- );

-- Storage bucket: pothole-photos (create in Supabase Dashboard > Storage)
-- Policy: allow public read for verified display; allow authenticated/service role upload/delete.

-- Optional: RLS policies (use service role from server to bypass for API routes)
-- alter table reports enable row level security;
-- alter table report_photos enable row level security;

-- Migration: Add first_name and last_name (replace email with names, no verification)
-- Run in Supabase SQL Editor if your reports table lacks these columns:
alter table reports add column if not exists first_name text;
alter table reports add column if not exists last_name text;

-- Migration 002: Multi-category civic reporting (category, status, municipality, settlement, etc.)
-- Run lib/migrations/002_multi_category.sql in Supabase SQL Editor.
