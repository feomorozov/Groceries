import { NextResponse } from "next/server";
import { getImage } from "@/lib/db";
import { apiError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ReceiptExtractionError, receiptExtractionProvider } from "@/lib/receipt-extraction";
import { z } from "zod";

export const maxDuration = 60;
export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let imageDetails: { mime: string; bytes: number } | null = null;
  try {
    const supabase = createSupabaseServerClient();
    const { imageId } = z.object({ imageId: z.uuid() }).parse(await request.json());
    const image = await getImage(supabase, imageId);
    if (!image) throw new Error("The receipt image is no longer available.");
    imageDetails = { mime: image.mime, bytes: image.bytes.byteLength };
    return NextResponse.json(await receiptExtractionProvider().extract(image));
  } catch (error) {
    if (error instanceof ReceiptExtractionError) {
      const diagnostics = { requestId, environment: process.env.VERCEL ? "vercel" : "local", image: imageDetails, ...error.diagnostics };
      console.error("Receipt extraction failed", diagnostics);
      return NextResponse.json({ error: error.message, diagnostics }, { status: 502 });
    }
    return apiError(error);
  }
}
