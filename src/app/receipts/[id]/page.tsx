import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { ReceiptEditor } from "@/components/receipt-editor";
import { SiteHeader } from "@/components/site-header";
import { getReceipt } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function ReceiptPage({ params }: { params: Promise<{id:string}> }) { noStore(); const receipt = getReceipt((await params).id); if (!receipt) notFound(); return <main className="shell"><SiteHeader/><Link href="/" className="back">← Back to groceries</Link><h1>Receipt</h1><ReceiptEditor initial={receipt}/></main>; }
