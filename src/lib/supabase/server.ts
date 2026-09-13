import { createClient } from "@supabase/supabase-js";

export function createSupabaseServerClient() {
  const configuredUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!configuredUrl || !key) throw new Error("Supabase is not configured. Add SUPABASE_SECRET_KEY to .env.local. SUPABASE_URL is optional when your existing NEXT_PUBLIC_SUPABASE_URL is present.");
  const url = configuredUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
