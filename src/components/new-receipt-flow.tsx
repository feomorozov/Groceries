"use client";

import { useState } from "react";
import { ReceiptEditor } from "./receipt-editor";
import { expandReceiptItems } from "@/lib/receipt-items";
import { ROOMMATES, type ReceiptInput, type RoommateId } from "@/lib/types";
import type { ExtractedReceipt } from "@/lib/validation";

function today() { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); }
async function shrinkImage(file: File): Promise<File> {
  if (file.size <= 1_500_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
    return blob ? new File([blob], "receipt.jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}
function makeManual(payerId: RoommateId, imageId: string | null): ReceiptInput {
  return { id: crypto.randomUUID(), isComplete: false, merchant: "", purchasedAt: today(), payerId, subtotalCents: 0, taxCents: 0, adjustmentCents: 0, totalCents: 0, imageId,
    items: [{ id: crypto.randomUUID(), sku: null, rawDescription: null, description: "", quantity: null, unitPriceCents: null, itemDiscountCents: null, lineTotalCents: 0, isUncertain: false, roommateIds: [] }] };
}
function fromExtraction(data: ExtractedReceipt, payerId: RoommateId, imageId: string): ReceiptInput {
  const items = expandReceiptItems(data.items).map((item) => ({ id: crypto.randomUUID(), sku: item.sku, rawDescription: item.rawDescription, description: item.description || "Unread item", quantity: item.quantity, unitPriceCents: item.unitPriceCents, itemDiscountCents: item.itemDiscountCents, lineTotalCents: item.lineTotalCents ?? 0, isUncertain: item.isUncertain, roommateIds: [] }));
  if (!items.length) items.push({ id: crypto.randomUUID(), sku: null, rawDescription: null, description: "", quantity: null, unitPriceCents: null, itemDiscountCents: null, lineTotalCents: 0, isUncertain: false, roommateIds: [] });
  const itemSum = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const subtotal = data.subtotalCents ?? itemSum;
  const adjustment = (data.discountCents ?? 0) + (data.feeCents ?? 0);
  const tax = data.taxCents ?? 0;
  return { id: crypto.randomUUID(), isComplete: false, merchant: data.merchant ?? "", purchasedAt: data.purchasedAt ?? today(), payerId, subtotalCents: subtotal, taxCents: tax, adjustmentCents: adjustment, totalCents: data.totalCents ?? subtotal + tax + adjustment, imageId, items };
}

type ReceiptDiagnostics = Record<string, unknown>;
class ApiRequestError extends Error { constructor(message: string, readonly diagnostics: ReceiptDiagnostics | null) { super(message); } }
async function responseError(response: Response) {
  try {
    const body = await response.json() as { error?: unknown; diagnostics?: unknown };
    const diagnostics = body.diagnostics && typeof body.diagnostics === "object" && !Array.isArray(body.diagnostics) ? body.diagnostics as ReceiptDiagnostics : null;
    return new ApiRequestError(String(body.error || "Something went wrong."), diagnostics);
  } catch { return new ApiRequestError("Something went wrong.", null); }
}

export function NewReceiptFlow() {
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState<string | null>(null);
  const [payer, setPayer] = useState<RoommateId | null>(null); const [imageId, setImageId] = useState<string | null>(null);
  const [editor, setEditor] = useState<ReceiptInput | null>(null); const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [diagnostics, setDiagnostics] = useState<ReceiptDiagnostics | null>(null); const [dragging, setDragging] = useState(false);
  const choose = (chosen: File | undefined) => { if (!chosen) return; if (preview) URL.revokeObjectURL(preview); setFile(chosen); setPreview(URL.createObjectURL(chosen)); setImageId(null); setError(""); setDiagnostics(null); };
  const selectedPayer = () => payer ?? (document.querySelector<HTMLInputElement>('input[name="payer"]:checked')?.value as RoommateId | undefined) ?? null;
  const upload = async () => {
    if (imageId) return imageId; if (!file) return null;
    const prepared = await shrinkImage(file); const form = new FormData(); form.set("image", prepared);
    const response = await fetch("/api/images", { method: "POST", body: form }); if (!response.ok) throw await responseError(response);
    const body = await response.json(); setImageId(body.id); return body.id as string;
  };
  const manual = async () => {
    const paidBy = selectedPayer(); if (!paidBy) { setError("Choose who paid."); setDiagnostics(null); return; } setBusy(true); setError(""); setDiagnostics(null);
    try { setEditor(makeManual(paidBy, await upload())); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't upload this image."); setDiagnostics(e instanceof ApiRequestError ? e.diagnostics : null); } finally { setBusy(false); }
  };
  const read = async () => {
    const paidBy = selectedPayer(); if (!paidBy) { setError("Choose who paid."); setDiagnostics(null); return; } if (!file) { setError("Choose a receipt image."); setDiagnostics(null); return; } setBusy(true); setError(""); setDiagnostics(null);
    try {
      const id = await upload(); const response = await fetch("/api/receipts/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageId: id }) });
      if (!response.ok) throw await responseError(response); const data = await response.json() as ExtractedReceipt;
      const moreWarnings = [...data.warnings]; if (data.items.some((item) => item.lineTotalCents === null || item.isUncertain)) moreWarnings.push("One or more item details could not be read confidently. Check the marked lines below.");
      setWarnings(moreWarnings); setEditor(fromExtraction(data, paidBy, id!));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't read this receipt."); setDiagnostics(e instanceof ApiRequestError ? e.diagnostics : null); } finally { setBusy(false); }
  };
  if (editor) return <ReceiptEditor initial={editor} warnings={warnings} />;
  return <div className="upload">
    <div className={`photo-choices${dragging ? " dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]); }}>
      <label className="photo-choice">
        <input type="file" accept="image/jpeg,image/png,image/webp,image/*" onChange={(event) => choose(event.target.files?.[0])} />
        {preview ? <><img className="preview" src={preview} alt="Selected receipt preview" /><strong>Upload photo</strong></> : <div><strong>Upload photo</strong><span>Choose an image from your device</span></div>}
      </label>
      <label className="photo-choice">
        <input type="file" accept="image/jpeg,image/png,image/webp,image/*" capture="environment" onChange={(event) => choose(event.target.files?.[0])} />
        <div><strong>Take photo</strong><span>Use your camera</span></div>
      </label>
    </div>
    <p className="photo-note">JPEG, PNG, or WebP · up to 8 MB after compression</p>
    <fieldset className="payer"><legend className="label">Who paid?</legend><div className="payer-options">{ROOMMATES.map((roommate) => <div className="payer-option" key={roommate.id}><input id={`payer-${roommate.id}`} type="radio" name="payer" value={roommate.id} checked={payer === roommate.id} onChange={() => setPayer(roommate.id)} /><label htmlFor={`payer-${roommate.id}`}>{roommate.name}</label></div>)}</div></fieldset>
    <div className="upload-actions"><button type="button" className="primary" disabled={busy || !file} onClick={read}>{busy ? "Reading receipt…" : "Read receipt"}</button><button type="button" className="text-btn" disabled={busy} onClick={manual}>Enter manually</button>{error && <div className="upload-error error" role="alert"><div>{error}</div>{diagnostics && <details className="diagnostics" open><summary>Troubleshooting details</summary><pre>{JSON.stringify(diagnostics, null, 2)}</pre></details>}</div>}</div>
  </div>;
}
