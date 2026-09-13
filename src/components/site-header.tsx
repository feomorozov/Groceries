import Link from "next/link";
export function SiteHeader() {
  return <header className="topbar"><Link href="/" className="wordmark">Groceries</Link><span className="house">Michael, Kevin, Feo &amp; Saketh</span></header>;
}
