import { createSupabaseServerClient } from "./supabase/server";
export class ApiError extends Error { constructor(message: string, public readonly status: number) { super(message); } }
export async function getAppMember() {
  const supabase = await createSupabaseServerClient(); const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, member: null };
  const { data: member, error: memberError } = await supabase.from("app_members").select("display_name").eq("user_id", user.id).maybeSingle(); if (memberError) throw new Error(memberError.message);
  return { supabase, user, member };
}
export async function requireApiMember() { const auth = await getAppMember(); if (!auth.user) throw new ApiError("Sign in to use Groceries.", 401); if (!auth.member) throw new ApiError("Your account has not been added to this household.", 403); return auth; }
