"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function HomeIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" /></svg>; }
function ListIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg>; }
function PlusIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>; }

export function MobileNav() {
  const pathname = usePathname();
  const active = pathname === "/receipts/new" ? 1 : pathname.startsWith("/list") ? 2 : 0;
  return <nav className={`mobile-nav mobile-nav-active-${active}`} aria-label="Mobile navigation">
    <span className="mobile-nav-indicator" aria-hidden="true" />
    <Link className="mobile-nav-link" href="/" aria-label="Home" aria-current={active === 0 ? "page" : undefined}><HomeIcon /></Link>
    <Link className="mobile-nav-add" href="/receipts/new" aria-label="Add receipt" aria-current={active === 1 ? "page" : undefined}><PlusIcon /></Link>
    <Link className="mobile-nav-link" href="/list" aria-label="Groceries list" aria-current={active === 2 ? "page" : undefined}><ListIcon /></Link>
  </nav>;
}
