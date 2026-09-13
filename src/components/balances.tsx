"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, moneyInput, parseMoney } from "@/lib/money";
import { ALL_IDS, nameOf, type PairBalance, type RoommateId } from "@/lib/types";

function Pair({ balance, onPay }: { balance: PairBalance; onPay: (balance: PairBalance) => void }) {
  if (!balance.debtor) return <div className="pair-value zero"><strong>$0.00</strong><span>Settled</span></div>;
  return <button type="button" className="pair-value balance-button" onClick={() => onPay(balance)} aria-label={`Mark ${formatMoney(balance.cents)} from ${nameOf(balance.debtor)} to ${nameOf(balance.creditor!)} as paid`}><strong>{formatMoney(balance.cents)}</strong><span>{nameOf(balance.debtor)} <b aria-hidden="true">→</b> {nameOf(balance.creditor!)}</span></button>;
}

export function Balances({ balances }: { balances: PairBalance[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<PairBalance | null>(null);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const get = (a: RoommateId, b: RoommateId) => balances.find((p) => p.first === a && p.second === b)!;

  useEffect(() => { if (selected && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [selected]);
  const openPayment = (balance: PairBalance) => { setSelected(balance); setAmount(moneyInput(balance.cents)); setError(""); };
  const close = () => dialog.current?.close();
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
      close(); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn't record this payment."); setSaving(false); }
  };

  return <>
    <div className="pair-table" aria-label="Pairwise balances">
      <div className="corner" />{ALL_IDS.slice(1).map((id) => <div className="colhead" key={id}>{nameOf(id)}</div>)}
      <div className="rowhead">Michael</div>{ALL_IDS.slice(1).map((id) => <Pair key={id} balance={get("michael", id)} onPay={openPayment} />)}
      <div className="rowhead">Kevin</div><div className="blank" aria-hidden="true" /><Pair balance={get("kevin", "feo")} onPay={openPayment} /><Pair balance={get("kevin", "saketh")} onPay={openPayment} />
      <div className="rowhead">Feo</div><div className="blank" aria-hidden="true" /><div className="blank" aria-hidden="true" /><Pair balance={get("feo", "saketh")} onPay={openPayment} />
    </div>
    <div className="mobile-pairs" aria-label="Pairwise balances">
      {balances.map((balance) => balance.debtor ? <button type="button" className="mobile-pair balance-button" key={`${balance.first}-${balance.second}`} onClick={() => openPayment(balance)}><span>{nameOf(balance.debtor)} <b aria-hidden="true">→</b> {nameOf(balance.creditor!)}</span><strong>{formatMoney(balance.cents)}</strong></button> : <div className="mobile-pair" key={`${balance.first}-${balance.second}`}><span>{nameOf(balance.first)} · {nameOf(balance.second)}</span><strong>{formatMoney(balance.cents)}</strong></div>)}
    </div>
    <dialog ref={dialog} aria-labelledby="payment-title" onClose={() => { setSelected(null); setSaving(false); setError(""); }}>
      {selected && <form onSubmit={submit}>
        <h2 id="payment-title">Mark balance as paid</h2>
        <p className="muted payment-copy">{nameOf(selected.debtor!)} pays {nameOf(selected.creditor!)}. The current balance is {formatMoney(selected.cents)}.</p>
        <label className="payment-field" htmlFor="payment-amount">Payment amount <span className="payment-input"><b>$</b><input id="payment-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} autoFocus /></span></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="dialog-actions"><button type="button" className="secondary-btn" onClick={close}>Cancel</button><button type="submit" className="primary" disabled={saving}>{saving ? "Recording…" : "Mark as paid"}</button></div>
      </form>}
    </dialog>
  </>;
}
