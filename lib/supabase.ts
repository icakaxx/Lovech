import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Report, ReportPhoto } from './types';

let anonClient: SupabaseClient | null = null;

/** Client for browser / public reads. Lazy-init so build works without env. */
export function getSupabase(): SupabaseClient {
  if (!anonClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required');
    anonClient = createClient(url, key);
  }
  return anonClient;
}

/** Server-only client with service role for writes and admin operations. */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required on server');
  return createClient(url, key);
}

/** Database row types matching Supabase schema */
export type ReportRow = Report;
export type ReportPhotoRow = ReportPhoto;
