import { NextResponse } from "next/server";
import { createReceipt } from "@/lib/db";
import { apiError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { receiptSchema } from "@/lib/validation";
export async function POST(request: Request) {
  try { const supabase = createSupabaseServerClient(); return NextResponse.json(await createReceipt(supabase, receiptSchema.parse(await request.json())), { status: 201 }); }
  catch (error) { return apiError(error); }
}
