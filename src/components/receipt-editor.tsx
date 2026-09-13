"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoneyField } from "./money-field";
import { allocateReceipt, formatMoney } from "@/lib/money";
import { ALL_IDS, ROOMMATES, nameOf, type Receipt, type ReceiptInput, type RoommateId } from "@/lib/types";

const newItem = () => ({ id: crypto.randomUUID(), description: "", quantity: null, unitPriceCents: null, lineTotalCents: 0, roommateIds: [...ALL_IDS] });
function errorMessage(body: unknown) { return typeof body === "object" && body && "error" in body ? String(body.error) : "Something went wrong."; }
function SplitPicker({ selected, onChange }: { selected: RoommateId[]; onChange: (ids: RoommateId[]) => void }) {
  const ordered = ALL_IDS.filter((id) => selected.includes(id));
  const label = ordered.length === 4 ? "Everyone" : ordered.length ? ordered.map(nameOf).join(", ") : "Choose people";
  const toggle = (id: RoommateId, checked: boolean) => onChange(checked ? ALL_IDS.filter((x) => x === id || selected.includes(x)) : selected.filter((x) => x !== id));
  return <details className="split"><summary>{label}</summary><div className="split-menu">
    <label className="check everyone"><input type="checkbox" checked={selected.length === 4} onChange={(e) => onChange(e.target.checked ? [...ALL_IDS] : [])} />Everyone</label>
    {ROOMMATES.map((r) => <label className="check" key={r.id}><input type="checkbox" checked={selected.includes(r.id)} onChange={(e) => toggle(r.id, e.target.checked)} />{r.name}</label>)}
  </div></details>;
}
export function ReceiptEditor({ initial, warnings = [] }: { initial: ReceiptInput | Receipt; warnings?: string[] }) {
  const router = useRouter();
  const isExisting = "updatedAt" in initial;
  const [receipt, setReceipt] = useState<ReceiptInput>(() => {
    if (!isExisting) return initial;
    const editable = { ...initial } as ReceiptInput & { createdAt?: string; updatedAt?: string };
    delete editable.createdAt; delete editable.updatedAt;
    return editable;
  });
  const [version, setVersion] = useState(isExisting ? initial.updatedAt : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const itemSum = useMemo(() => receipt.items.reduce((n, item) => n + item.lineTotalCents, 0), [receipt.items]);
  const computedTotal = itemSum + receipt.taxCents + receipt.adjustmentCents;
  const difference = receipt.totalCents - computedTotal;
  const update = <K extends keyof ReceiptInput>(key: K, value: ReceiptInput[K]) => setReceipt((r) => ({ ...r, [key]: value }));
  const updateItem = (id: string, patch: Partial<ReceiptInput["items"][number]>) => update("items", receipt.items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const reconcile = () => setReceipt((r) => ({ ...r, subtotalCents: itemSum, adjustmentCents: r.totalCents - itemSum - r.taxCents }));
  const save = async () => {
    setError("");
    try { allocateReceipt(receipt); }
    catch (e) { setError(e instanceof Error ? e.message : "Check the receipt."); return; }
    setSaving(true);
    try {
      const response = await fetch(isExisting ? `/api/receipts/${receipt.id}` : "/api/receipts", { method: isExisting ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(isExisting ? { receipt, expectedUpdatedAt: version } : receipt) });
      const body = await response.json();
      if (!response.ok) throw new Error(errorMessage(body));
      if (isExisting) { setVersion(body.updatedAt); setSaving(false); router.refresh(); }
      else { router.push(`/receipts/${receipt.id}`); router.refresh(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save this receipt."); setSaving(false); }
  };
  const remove = async () => {
    if (!isExisting) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/receipts/${receipt.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedUpdatedAt: version }) });
      if (!response.ok) throw new Error(errorMessage(await response.json()));
      router.push("/"); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't delete this receipt."); setSaving(false); dialog.current?.close(); }
  };
  return <>
    {warnings.length > 0 && <div className="notice" role="status">{warnings.join(" ")}</div>}
    <div className="editor-head">
      <div className="field merchant"><label htmlFor="merchant">Store</label><input id="merchant" className="input big" value={receipt.merchant} onChange={(e) => update("merchant", e.target.value)} /></div>
      <div className="field"><label htmlFor="date">Date</label><input id="date" className="input" type="date" value={receipt.purchasedAt} onChange={(e) => update("purchasedAt", e.target.value)} /></div>
      <div className="field"><label htmlFor="payer">Paid by</label><select id="payer" className="input" value={receipt.payerId} onChange={(e) => update("payerId", e.target.value as RoommateId)}>{ROOMMATES.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
      <div className="field"><span className="label">Total</span><MoneyField value={receipt.totalCents} onChange={(v) => update("totalCents", v)} className="input big" label="Receipt total" /></div>
      <div className="field"><span className="label">Subtotal</span><MoneyField value={receipt.subtotalCents} onChange={(v) => update("subtotalCents", v)} label="Subtotal" /></div>
      <div className="field"><span className="label">Tax</span><MoneyField value={receipt.taxCents} onChange={(v) => update("taxCents", v)} label="Tax" /></div>
      <div className="field"><span className="label">Discounts & fees</span><MoneyField value={receipt.adjustmentCents} onChange={(v) => update("adjustmentCents", v)} label="Discounts and fees" /></div>
    </div>
    <div className="items-head"><span>Item</span><span style={{textAlign:"right"}}>Amount</span><span>Split</span><span/></div>
    {receipt.items.map((item) => <div className="item-row" key={item.id}>
      <div className="item-description"><input aria-label="Item name" placeholder="Item name" value={item.description} onChange={(e) => updateItem(item.id, { description:e.target.value })} />
        <div className="item-details"><label>Qty <input aria-label={`${item.description || "Item"} quantity`} value={item.quantity ?? ""} onChange={(e) => updateItem(item.id, { quantity:e.target.value || null })} /></label><label>Unit $ <MoneyField value={item.unitPriceCents ?? 0} onChange={(v) => updateItem(item.id, { unitPriceCents:v })} className="detail-money" label={`${item.description || "Item"} unit price`} /></label></div>
      </div>
      <div className="amount-wrap"><span>$</span><MoneyField value={item.lineTotalCents} onChange={(v) => updateItem(item.id, { lineTotalCents:v })} className="amount-input" label={`${item.description || "Item"} amount`} /></div>
      <SplitPicker selected={item.roommateIds} onChange={(ids) => updateItem(item.id, { roommateIds:ids })} />
      <button type="button" className="remove" aria-label={`Remove ${item.description || "item"}`} onClick={() => update("items", receipt.items.filter((i) => i.id !== item.id))}>×</button>
    </div>)}
    <div className="items-tools"><button className="secondary-btn" type="button" onClick={() => update("items", [...receipt.items, newItem()])}>Add item</button>
      <label className="split-all">Split all <select defaultValue="everyone" onChange={(e) => { const ids = e.target.value === "everyone" ? [...ALL_IDS] : [e.target.value as RoommateId]; update("items", receipt.items.map((item) => ({ ...item, roommateIds:ids }))); }}><option value="everyone">Everyone</option>{ROOMMATES.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
    </div>
    <div className="reconcile"><div className="reconcile-line">Items <b>{formatMoney(itemSum)}</b> · Tax & adjustments <b>{formatMoney(receipt.taxCents + receipt.adjustmentCents)}</b> · Receipt <b>{formatMoney(receipt.totalCents)}</b>{difference !== 0 && <> · Difference <b>{formatMoney(difference)}</b></>}</div>
      {difference !== 0 || receipt.subtotalCents !== itemSum ? <button type="button" className="secondary-btn" onClick={reconcile}>Reconcile</button> : <span className="tiny">Reconciled exactly</span>}
    </div>
    {/* Private database images are served directly and keep their natural aspect ratio. */}
    {receipt.imageId && <details className="receipt-image"><summary>View original receipt</summary><img src={`/api/images/${receipt.imageId}`} alt="Uploaded receipt" /></details>}
    <div className="editor-actions">{error && <span role="alert" className="error">{error}</span>}<button type="button" className="primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save receipt"}</button></div>
    {isExisting && <div className="delete-area"><button type="button" className="text-btn danger" onClick={() => dialog.current?.showModal()}>Delete receipt</button></div>}
    <dialog ref={dialog} aria-labelledby="delete-title"><h2 id="delete-title">Delete this receipt?</h2><p className="muted">Its shares will be removed from everyone’s balances.</p><div className="dialog-actions"><button className="secondary-btn" onClick={() => dialog.current?.close()}>Cancel</button><button className="primary" disabled={saving} onClick={remove}>Delete receipt</button></div></dialog>
  </>;
}
