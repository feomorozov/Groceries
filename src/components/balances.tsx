"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { allocateReceipt, formatMoney, moneyInput, parseMoney } from "@/lib/money";
import { ALL_IDS, nameOf, type BalancePayment, type PairBalance, type Receipt, type RoommateId } from "@/lib/types";

function TransferIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h13m0 0-3.5-3.5M17 7l-3.5 3.5M20 17H7m0 0 3.5-3.5M7 17l3.5 3.5" /></svg>;
}
function EyeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /></svg>;
}
function relationship(balance: PairBalance) {
  return balance.debtor ? `${nameOf(balance.debtor)} → ${nameOf(balance.creditor!)}` : `${nameOf(balance.first)} · ${nameOf(balance.second)}`;
}
function Pair({ balance, onLog, onHistory }: { balance: PairBalance; onLog: (balance: PairBalance) => void; onHistory: (balance: PairBalance) => void }) {
  const active = Boolean(balance.debtor && balance.creditor);
  return <div className={`pair-value balance-card${active ? "" : " zero"}`}>
    <button type="button" className="balance-summary" disabled={!active} onClick={() => onLog(balance)} aria-label={active ? `Mark ${formatMoney(balance.cents)} from ${nameOf(balance.debtor!)} to ${nameOf(balance.creditor!)} as paid` : `${relationship(balance)} is settled`}>
      <strong>{formatMoney(balance.cents)}</strong><span>{active ? relationship(balance) : "Settled"}</span>
    </button>
    <div className="balance-actions">
      <button type="button" className="balance-icon" disabled={!active} onClick={() => onLog(balance)} aria-label={`Log a payment for ${relationship(balance)}`} title="Log a payment"><TransferIcon /></button>
      <button type="button" className="balance-icon" onClick={() => onHistory(balance)} aria-label={`View transaction history for ${nameOf(balance.first)} and ${nameOf(balance.second)}`} title="View transaction history"><EyeIcon /></button>
    </div>
  </div>;
}
function MobilePair({ balance, onLog, onHistory }: { balance: PairBalance; onLog: (balance: PairBalance) => void; onHistory: (balance: PairBalance) => void }) {
  const active = Boolean(balance.debtor && balance.creditor);
  return <div className={`mobile-pair balance-card${active ? "" : " zero"}`}>
    <button type="button" className="balance-summary" disabled={!active} onClick={() => onLog(balance)} aria-label={active ? `Mark ${formatMoney(balance.cents)} from ${nameOf(balance.debtor!)} to ${nameOf(balance.creditor!)} as paid` : `${relationship(balance)} is settled`}>
      <span>{relationship(balance)}</span><strong>{formatMoney(balance.cents)}</strong>
    </button>
    <div className="balance-actions">
      <button type="button" className="balance-icon" disabled={!active} onClick={() => onLog(balance)} aria-label={`Log a payment for ${relationship(balance)}`} title="Log a payment"><TransferIcon /></button>
      <button type="button" className="balance-icon" onClick={() => onHistory(balance)} aria-label={`View transaction history for ${nameOf(balance.first)} and ${nameOf(balance.second)}`} title="View transaction history"><EyeIcon /></button>
    </div>
  </div>;
}
function displayTimestamp(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: new Date().getFullYear() === new Date(value).getFullYear() ? undefined : "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function displayDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: new Date().getFullYear() === Number(value.slice(0, 4)) ? undefined : "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)); }
type PairCharge = { id: string; receiptId: string; merchant: string; purchasedAt: string; item: string; debtor: RoommateId; creditor: RoommateId; cents: number };
function chargesForPair(receipts: Receipt[], pair: PairBalance): PairCharge[] {
  return receipts.flatMap((receipt) => {
    if (!receipt.isComplete || (receipt.payerId !== pair.first && receipt.payerId !== pair.second)) return [];
    const debtor = receipt.payerId === pair.first ? pair.second : pair.first;
    try {
      const allocation = allocateReceipt(receipt);
      return receipt.items.flatMap((item, index) => {
        const share = allocation.items[index]?.shares.find((value) => value.roommateId === debtor);
        return share && share.allocatedCents !== 0 ? [{ id: `${receipt.id}-${item.id}`, receiptId: receipt.id, merchant: receipt.merchant, purchasedAt: receipt.purchasedAt, item: item.description || "Unnamed item", debtor, creditor: receipt.payerId, cents: share.allocatedCents }] : [];
      });
    } catch { return []; }
  });
}

export function Balances({ balances, payments, receipts }: { balances: PairBalance[]; payments: BalancePayment[]; receipts: Receipt[] }) {
  const router = useRouter();
  const paymentDialog = useRef<HTMLDialogElement>(null);
  const historyDialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<PairBalance | null>(null);
  const [history, setHistory] = useState<PairBalance | null>(null);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const get = (a: RoommateId, b: RoommateId) => balances.find((p) => p.first === a && p.second === b)!;

  useEffect(() => { if (selected && paymentDialog.current && !paymentDialog.current.open) paymentDialog.current.showModal(); }, [selected]);
  useEffect(() => { if (history && historyDialog.current && !historyDialog.current.open) historyDialog.current.showModal(); }, [history]);
  const openPayment = (balance: PairBalance) => { if (!balance.debtor || !balance.creditor) return; setSelected(balance); setAmount(moneyInput(balance.cents)); setError(""); };
  const openHistory = (balance: PairBalance) => setHistory(balance);
  const closePayment = () => paymentDialog.current?.close();
  const pairPayments = history ? payments.filter((payment) => (payment.payerId === history.first && payment.recipientId === history.second) || (payment.payerId === history.second && payment.recipientId === history.first)) : [];
  const pairCharges = history ? chargesForPair(receipts, history) : [];
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected?.debtor || !selected.creditor) return;
    const cents = parseMoney(amount);
    if (cents === null || cents <= 0) { setError("Enter a payment greater than zero."); return; }
    if (cents > selected.cents) { setError(`Payment cannot exceed ${formatMoney(selected.cents)}.`); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payerId: selected.debtor, recipientId: selected.creditor, cents }) });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : "Couldn't record this payment.");
      closePayment(); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn't record this payment."); setSaving(false); }
  };

  return <>
    <div className="pair-table" aria-label="Pairwise balances">
      <div className="corner" />{ALL_IDS.slice(1).map((id) => <div className="colhead" key={id}>{nameOf(id)}</div>)}
      <div className="rowhead">Michael</div>{ALL_IDS.slice(1).map((id) => <Pair key={id} balance={get("michael", id)} onLog={openPayment} onHistory={openHistory} />)}
      <div className="rowhead">Kevin</div><div className="blank" aria-hidden="true" /><Pair balance={get("kevin", "feo")} onLog={openPayment} onHistory={openHistory} /><Pair balance={get("kevin", "saketh")} onLog={openPayment} onHistory={openHistory} />
      <div className="rowhead">Feo</div><div className="blank" aria-hidden="true" /><div className="blank" aria-hidden="true" /><Pair balance={get("feo", "saketh")} onLog={openPayment} onHistory={openHistory} />
    </div>
    <div className="mobile-pairs" aria-label="Pairwise balances">
      {balances.map((balance) => <MobilePair key={`${balance.first}-${balance.second}`} balance={balance} onLog={openPayment} onHistory={openHistory} />)}
    </div>
    <dialog ref={paymentDialog} aria-labelledby="payment-title" onClose={() => { setSelected(null); setSaving(false); setError(""); }}>
      {selected && <form onSubmit={submit}>
        <h2 id="payment-title">Mark balance as paid</h2>
        <p className="muted payment-copy">{nameOf(selected.debtor!)} pays {nameOf(selected.creditor!)}. The current balance is {formatMoney(selected.cents)}.</p>
        <label className="payment-field" htmlFor="payment-amount">Payment amount <span className="payment-input"><b>$</b><input id="payment-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} autoFocus /></span></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="dialog-actions"><button type="button" className="secondary-btn" onClick={closePayment}>Cancel</button><button type="submit" className="primary" disabled={saving}>{saving ? "Recording…" : "Mark as paid"}</button></div>
      </form>}
    </dialog>
    <dialog ref={historyDialog} aria-labelledby="pair-history-title" onClose={() => setHistory(null)}>
      {history && <>
        <h2 id="pair-history-title">Balance details</h2>
        <p className="muted payment-copy">{nameOf(history.first)} and {nameOf(history.second)}</p>
        <h3 className="dialog-section-title">Charges from trips</h3>
        {pairCharges.length === 0 ? <p className="dialog-empty">No item charges have been recorded for this balance.</p> : <div className="dialog-transaction-list">{pairCharges.map((charge) => <Link className="dialog-transaction dialog-charge" href={`/receipts/${charge.receiptId}`} key={charge.id}><span><b>{charge.item}</b><small>{charge.merchant || "Untitled receipt"} · {displayDate(charge.purchasedAt)} · {charge.cents < 0 ? `Credit to ${nameOf(charge.debtor)}` : `${nameOf(charge.debtor)} owes ${nameOf(charge.creditor)}`}</small></span><strong>{formatMoney(charge.cents)}</strong></Link>)}</div>}
        <h3 className="dialog-section-title payment-history-heading">Payment history</h3>
        {pairPayments.length === 0 ? <p className="dialog-empty">No payments have been recorded for this balance.</p> : <div className="dialog-transaction-list">{pairPayments.map((payment) => <div className="dialog-transaction" key={payment.id}><span><b>{nameOf(payment.payerId)}</b> paid <b>{nameOf(payment.recipientId)}</b><small>{displayTimestamp(payment.createdAt)}</small></span><strong>{formatMoney(payment.cents)}</strong></div>)}</div>}
        <div className="dialog-actions"><button type="button" className="secondary-btn" onClick={() => historyDialog.current?.close()}>Close</button></div>
      </>}
    </dialog>
  </>;
}
