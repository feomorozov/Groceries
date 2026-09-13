import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { ReceiptEditor } from "@/components/receipt-editor";
import { getReceipt } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  noStore();
  const receipt = await getReceipt(createSupabaseServerClient(), (await params).id);
  if (!receipt) notFound();
  return <main className="shell"><Link href="/" className="back">← Back to groceries</Link><h1>Receipt</h1><ReceiptEditor initial={receipt}/></main>;
}
