import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { ReceiptEditor } from "@/components/receipt-editor";
import { SiteHeader } from "@/components/site-header";
import { getAppMember } from "@/lib/auth";
import { getReceipt } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  noStore(); const auth = await getAppMember();
  if (!auth.user) redirect("/login"); if (!auth.member) redirect("/not-allowed");
  const receipt = await getReceipt(auth.supabase, (await params).id); if (!receipt) notFound();
  return <main className="shell"><SiteHeader email={auth.user.email}/><Link href="/" className="back">← Back to groceries</Link><h1>Receipt</h1><ReceiptEditor initial={receipt}/></main>;
}
