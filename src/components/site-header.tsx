import Link from "next/link";
export function SiteHeader({ email }: { email?: string }) {
  return <header className="topbar"><Link href="/" className="wordmark">Groceries</Link><span className="house">Michael, Kevin, Feo &amp; Saketh</span>{email && <form action="/auth/signout" method="post"><button className="signout" type="submit">Sign out</button></form>}</header>;
}
