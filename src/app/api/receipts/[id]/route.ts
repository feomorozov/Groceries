import { NextResponse } from "next/server";
import { deleteReceipt, getReceipt, updateReceipt } from "@/lib/db";
import { apiError } from "@/lib/http";
import { receiptSchema } from "@/lib/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const supabase = createSupabaseServerClient(); const receipt = await getReceipt(supabase, (await params).id); return receipt ? NextResponse.json(receipt) : NextResponse.json({ error: "Receipt not found." }, { status: 404 }); }
  catch (error) { return apiError(error); }
}
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { receipt, expectedUpdatedAt } = await request.json();
    const supabase = createSupabaseServerClient();
    return NextResponse.json(await updateReceipt(supabase, (await params).id, receiptSchema.parse(receipt), String(expectedUpdatedAt)));
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { expectedUpdatedAt } = await request.json();
    const supabase = createSupabaseServerClient();
    await deleteReceipt(supabase, (await params).id, String(expectedUpdatedAt));
    return new NextResponse(null, { status: 204 });
  } catch (error) { return apiError(error); }
}
