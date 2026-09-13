import { NextResponse } from "next/server";
import { saveImage } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireApiMember } from "@/lib/auth";
const TYPES: Record<string, number[]> = { "image/jpeg": [0xff, 0xd8, 0xff], "image/png": [0x89, 0x50, 0x4e, 0x47], "image/webp": [0x52, 0x49, 0x46, 0x46] };
export async function POST(request: Request) {
  try {
    const { supabase } = await requireApiMember();
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) throw new Error("Choose a receipt image.");
    if (!TYPES[file.type]) throw new Error("Use a JPEG, PNG, or WebP image.");
    if (file.size > 8 * 1024 * 1024) throw new Error("The image must be smaller than 8 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!TYPES[file.type].every((byte, index) => bytes[index] === byte)) throw new Error("The selected file is not a valid image.");
    const id = crypto.randomUUID();
    await saveImage(supabase, id, file.type, bytes);
    return NextResponse.json({ id, url: `/api/images/${id}` }, { status: 201 });
  } catch (error) { return apiError(error); }
}
