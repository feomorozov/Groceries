import { NextResponse } from "next/server";
import { createReceipt } from "@/lib/db";
import { apiError } from "@/lib/http";
import { receiptSchema } from "@/lib/validation";
export async function POST(request: Request) {
  try { return NextResponse.json(createReceipt(receiptSchema.parse(await request.json())), { status: 201 }); }
  catch (error) { return apiError(error); }
}
