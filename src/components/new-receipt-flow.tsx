"use client";
import { useState } from "react";
import { ReceiptEditor } from "./receipt-editor";
import { ALL_IDS, ROOMMATES, type ReceiptInput, type RoommateId } from "@/lib/types";
import type { ExtractedReceipt } from "@/lib/validation";

function today() { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0,10); }
async function shrinkImage(file: File): Promise<File> {
  if (file.size <= 1_500_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", .84));
    return blob ? new File([blob], "receipt.jpg", { type:"image/jpeg" }) : file;
  } catch { return file; }
}
function makeManual(payerId: RoommateId, imageId: string | null): ReceiptInput {
  return { id:crypto.randomUUID(), merchant:"", purchasedAt:today(), payerId, subtotalCents:0, taxCents:0, adjustmentCents:0, totalCents:0, imageId,
    items:[{ id:crypto.randomUUID(), description:"", quantity:null, unitPriceCents:null, lineTotalCents:0, roommateIds:[...ALL_IDS] }] };
}
function fromExtraction(data: ExtractedReceipt, payerId: RoommateId, imageId: string): ReceiptInput {
  const items = data.items.map((item) => ({ id:crypto.randomUUID(), description:item.description || "Unread item", quantity:item.quantity, unitPriceCents:item.unitPriceCents, lineTotalCents:item.lineTotalCents ?? 0, roommateIds:[...ALL_IDS] }));
  if (!items.length) items.push({ id:crypto.randomUUID(), description:"", quantity:null, unitPriceCents:null, lineTotalCents:0, roommateIds:[...ALL_IDS] });
  const itemSum = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const subtotal = data.subtotalCents ?? itemSum;
  const adjustment = (data.discountCents ?? 0) + (data.feeCents ?? 0);
  const tax = data.taxCents ?? 0;
  return { id:crypto.randomUUID(), merchant:data.merchant ?? "", purchasedAt:data.purchasedAt ?? today(), payerId, subtotalCents:subtotal, taxCents:tax, adjustmentCents:adjustment, totalCents:data.totalCents ?? subtotal + tax + adjustment, imageId, items };
}
async function responseError(response: Response) { try { const body = await response.json(); return String(body.error || "Something went wrong."); } catch { return "Something went wrong."; } }
export function NewReceiptFlow() {
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState<string | null>(null);
  const [payer, setPayer] = useState<RoommateId | null>(null); const [imageId, setImageId] = useState<string | null>(null);
  const [editor, setEditor] = useState<ReceiptInput | null>(null); const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [dragging, setDragging] = useState(false);
  const choose = (chosen: File | undefined) => { if (!chosen) return; if (preview) URL.revokeObjectURL(preview); setFile(chosen); setPreview(URL.createObjectURL(chosen)); setImageId(null); setError(""); };
  const selectedPayer = () => payer ?? (document.querySelector<HTMLInputElement>('input[name="payer"]:checked')?.value as RoommateId | undefined) ?? null;
  const upload = async () => {
    if (imageId) return imageId; if (!file) return null;
    const prepared = await shrinkImage(file); const form = new FormData(); form.set("image", prepared);
    const response = await fetch("/api/images", { method:"POST", body:form }); if (!response.ok) throw new Error(await responseError(response));
    const body = await response.json(); setImageId(body.id); return body.id as string;
  };
  const manual = async () => {
    const paidBy = selectedPayer(); if (!paidBy) { setError("Choose who paid."); return; } setBusy(true); setError("");
    try { setEditor(makeManual(paidBy, await upload())); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't upload this image."); } finally { setBusy(false); }
  };
  const read = async () => {
    const paidBy = selectedPayer(); if (!paidBy) { setError("Choose who paid."); return; } if (!file) { setError("Choose a receipt image."); return; } setBusy(true); setError("");
    try {
      const id = await upload(); const response = await fetch("/api/receipts/extract", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({imageId:id}) });
      if (!response.ok) throw new Error(await responseError(response)); const data = await response.json() as ExtractedReceipt;
      const moreWarnings = [...data.warnings]; if (data.items.some((i) => i.lineTotalCents === null)) moreWarnings.push("One or more item prices could not be read. Check the amounts below.");
      setWarnings(moreWarnings); setEditor(fromExtraction(data, paidBy, id!));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't read this receipt."); } finally { setBusy(false); }
  };
  if (editor) return <ReceiptEditor initial={editor} warnings={warnings} />;
  return <div className="upload">
    <label className={`dropzone${dragging ? " dragging" : ""}`} onDragOver={(e) => {e.preventDefault();setDragging(true)}} onDragLeave={() => setDragging(false)} onDrop={(e) => {e.preventDefault();setDragging(false);choose(e.dataTransfer.files[0])}}>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/*" capture="environment" onChange={(e) => choose(e.target.files?.[0])} />
      {/* blob previews cannot use the Next image optimizer */}
      {preview ? <img className="preview" src={preview} alt="Selected receipt preview" /> : <div><strong>Take a photo or choose an image</strong><span>JPEG, PNG, or WebP · up to 8 MB after compression</span></div>}
    </label>
    <fieldset className="payer"><legend className="label">Who paid?</legend><div className="payer-options">{ROOMMATES.map((r) => <div className="payer-option" key={r.id}><input id={`payer-${r.id}`} type="radio" name="payer" value={r.id} checked={payer===r.id} onChange={() => setPayer(r.id)} /><label htmlFor={`payer-${r.id}`}>{r.name}</label></div>)}</div></fieldset>
    <div className="upload-actions"><button type="button" className="primary" disabled={busy || !file} onClick={read}>{busy ? "Reading receipt…" : "Read receipt"}</button><button type="button" className="text-btn" disabled={busy} onClick={manual}>Enter manually</button>{error && <span className="error" role="alert">{error}</span>}</div>
  </div>;
}
