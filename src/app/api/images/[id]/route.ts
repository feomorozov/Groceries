import { getImage } from "@/lib/db";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const image = getImage((await params).id);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(image.bytes as BodyInit, { headers: { "Content-Type": image.mime, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
