import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
function config() { const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; if (!url || !key) throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."); return { url, key }; }
export async function createSupabaseServerClient() {
  const cookieStore = await cookies(); const { url, key } = config();
  return createServerClient(url, key, { cookies: { getAll: () => cookieStore.getAll(), setAll: (items) => { try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Proxy refreshes sessions. */ } } } });
}
