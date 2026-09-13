import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
export default function NotFound() { return <main className="shell"><SiteHeader/><h1>Receipt not found.</h1><p className="muted">It may have been deleted.</p><Link href="/" className="primary">Back to groceries</Link></main>; }
