import Link from "next/link";
import { NewReceiptFlow } from "@/components/new-receipt-flow";
import { SiteHeader } from "@/components/site-header";
export default function NewReceiptPage() { return <main className="shell"><SiteHeader/><Link href="/" className="back">← Back</Link><h1>Add receipt</h1><NewReceiptFlow/></main>; }
