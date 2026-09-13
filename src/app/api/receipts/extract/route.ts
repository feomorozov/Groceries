import { NextResponse } from "next/server";
import { getImage } from "@/lib/db";
import { apiError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { receiptExtractionProvider } from "@/lib/receipt-extraction";
import { z } from "zod";

export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const { imageId } = z.object({ imageId: z.uuid() }).parse(await request.json());
    const image = await getImage(supabase, imageId);
    if (!image) throw new Error("The receipt image is no longer available.");
    return NextResponse.json(await receiptExtractionProvider().extract(image));
  } catch (error) { return apiError(error); }
}
