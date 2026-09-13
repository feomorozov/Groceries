"use client";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
export default function LoginPage() {
  const [email, setEmail] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setMessage(""); const { error } = await createSupabaseBrowserClient().auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } }); setBusy(false); setMessage(error ? error.message : "Check your email for the sign-in link."); }
  return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">Michael, Kevin, Feo &amp; Saketh</p><h1>Groceries</h1><p>Sign in with the email your household uses.</p><form onSubmit={submit}><label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label><button className="primary" disabled={busy}>{busy ? "Sending..." : "Email me a sign-in link"}</button></form>{message && <p className="notice" role="status">{message}</p>}</section></main>;
}
