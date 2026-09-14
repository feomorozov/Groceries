import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { Balances } from "@/components/balances";
import { getHomeData } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { nameOf } from "@/lib/types";

function displayDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: new Date().getFullYear() === Number(value.slice(0, 4)) ? undefined : "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)); }
function displayTimestamp(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: new Date().getFullYear() === new Date(value).getFullYear() ? undefined : "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
export const dynamic = "force-dynamic";
export default async function Home() {
  noStore();
  const { trips, payments, balances } = await getHomeData(createSupabaseServerClient());
  return <main className="shell">
    <div className="pagehead"><h1>Groceries</h1><Link href="/receipts/new" className="primary">Add receipt</Link></div>
    <section className="section" aria-labelledby="balances-heading"><div className="sectionhead"><h2 id="balances-heading">Balances</h2><p className="tiny">All trips, netted by pair</p></div><Balances balances={balances} payments={payments} /></section>
    <section className="section" aria-labelledby="history-heading"><div className="sectionhead"><h2 id="history-heading">Transaction History</h2>{payments.length > 0 && <p className="tiny">{payments.length} {payments.length === 1 ? "payment" : "payments"}</p>}</div>
      {payments.length === 0 ? <div className="empty">No balance payments have been recorded.</div> : <div className="transaction-list">{payments.map((payment) => <div className="transaction" key={payment.id}><span className="transaction-title">{nameOf(payment.payerId)} paid {nameOf(payment.recipientId)}</span><span className="transaction-meta">{displayTimestamp(payment.createdAt)}</span><span className="transaction-amount">{formatMoney(payment.cents)}</span></div>)}</div>}
    </section>
    <section className="section" aria-labelledby="trips-heading"><div className="sectionhead"><h2 id="trips-heading">Recent trips</h2>{trips.length > 0 && <p className="tiny">{trips.length} {trips.length === 1 ? "receipt" : "receipts"}</p>}</div>
      {trips.length === 0 ? <div className="empty">No grocery trips yet.<br/><Link href="/receipts/new"><u>Add your first receipt.</u></Link></div> : <div className="trip-list">{trips.map((trip) => <Link href={`/receipts/${trip.id}`} className={`trip${trip.isComplete ? "" : " incomplete-trip"}`} key={trip.id}><span className="trip-title">{trip.merchant || "Untitled receipt"}</span><span className="trip-meta">{displayDate(trip.purchasedAt)} · {nameOf(trip.payerId)} paid · {trip.itemCount} {trip.itemCount === 1 ? "item" : "items"}</span><span className="trip-amount">{formatMoney(trip.totalCents)}</span>{!trip.isComplete && <span className="incomplete-badge">Incomplete</span>}</Link>)}</div>}
    </section>
  </main>;
}
