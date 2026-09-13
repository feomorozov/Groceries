import { getImageUrl } from "@/lib/db";
import { requireApiMember } from "@/lib/auth";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireApiMember();
    const url = await getImageUrl(supabase, (await params).id);
    return url ? Response.redirect(url, 307) : new Response("Not found", { status: 404 });
  } catch { return new Response("Unauthorized", { status: 401 }); }
}
