import Link from "next/link";
import { getAppMember } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function NotAllowedPage() { const auth = await getAppMember(); if (!auth.user) redirect("/login"); if (auth.member) redirect("/"); return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">Groceries</p><h1>Ask to be added</h1><p><strong>{auth.user.email}</strong> has signed in, but has not been added to this household yet. An existing roommate can add this account in Supabase.</p><form action="/auth/signout" method="post"><button className="secondary">Sign out</button></form><p><Link href="/login">Use a different email</Link></p></section></main>; }
