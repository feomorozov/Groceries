import Link from "next/link";
export default function NotFound() { return <main className="shell"><h1>Receipt not found.</h1><p className="muted">It may have been deleted.</p><Link href="/" className="primary">Back to groceries</Link></main>; }
