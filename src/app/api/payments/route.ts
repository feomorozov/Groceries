import { NextResponse } from "next/server";
import { createPayment } from "@/lib/db";
import { apiError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { paymentSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try { return NextResponse.json(await createPayment(createSupabaseServerClient(), paymentSchema.parse(await request.json())), { status: 201 }); }
  catch (error) { return apiError(error); }
}
