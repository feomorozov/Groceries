import type { SupabaseClient } from "@supabase/supabase-js";
import { allocateReceipt, calculateBalances } from "./money";
import { ALL_IDS, type Receipt, type ReceiptInput, type ReceiptItem, type RoommateId, type TripSummary } from "./types";

type ReceiptRow = { id: string; merchant: string; purchased_at: string; payer_id: RoommateId; subtotal_cents: number; tax_cents: number; adjustment_cents: number; total_cents: number; image_id: string | null; created_at: string; updated_at: string; receipt_items?: ItemRow[] };
type ItemRow = { id: string; sku: string | null; raw_description: string | null; description: string; quantity: string | null; unit_price_cents: number | null; item_discount_cents: number | null; line_total_cents: number; is_uncertain: boolean | null; sort_order: number; item_shares?: ShareRow[] };
type ShareRow = { roommate_id: RoommateId; allocated_cents: number };
export type StoredImage = { id: string; objectPath: string; mime: string };

function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }
function toReceipt(row: ReceiptRow): Receipt {
  return { id: row.id, merchant: row.merchant, purchasedAt: row.purchased_at, payerId: row.payer_id, subtotalCents: row.subtotal_cents, taxCents: row.tax_cents, adjustmentCents: row.adjustment_cents, totalCents: row.total_cents, imageId: row.image_id, createdAt: row.created_at, updatedAt: row.updated_at,
    items: (row.receipt_items ?? []).sort((a, b) => a.sort_order - b.sort_order).map((item): ReceiptItem => ({ id: item.id, sku: item.sku ?? null, rawDescription: item.raw_description ?? null, description: item.description, quantity: item.quantity, unitPriceCents: item.unit_price_cents, itemDiscountCents: item.item_discount_cents ?? null, lineTotalCents: item.line_total_cents, isUncertain: item.is_uncertain ?? false, roommateIds: (item.item_shares ?? []).map((share) => share.roommate_id).filter((id): id is RoommateId => ALL_IDS.includes(id)) })) };
}
const receiptSelect = "*, receipt_items(*, item_shares(roommate_id, allocated_cents))";

export async function getReceipt(supabase: SupabaseClient, id: string): Promise<Receipt | null> {
  const { data, error } = await supabase.from("receipts").select(receiptSelect).eq("id", id).maybeSingle(); fail(error);
  return data ? toReceipt(data as unknown as ReceiptRow) : null;
}
export async function getReceipts(supabase: SupabaseClient): Promise<Receipt[]> {
  const { data, error } = await supabase.from("receipts").select(receiptSelect).order("purchased_at", { ascending: false }).order("created_at", { ascending: false }); fail(error);
  return (data as unknown as ReceiptRow[]).map(toReceipt);
}
export async function getHomeData(supabase: SupabaseClient) {
  const receipts = await getReceipts(supabase);
  const trips: TripSummary[] = receipts.map(({ items, ...receipt }) => ({ ...receipt, itemCount: items.length }));
  return { trips, balances: calculateBalances(receipts) };
}
function payload(receipt: ReceiptInput) {
  const allocation = allocateReceipt(receipt);
  return { ...receipt, items: receipt.items.map((item, index) => ({ ...item, shares: allocation.items[index].shares.map((share) => ({ roommateId: share.roommateId, allocatedCents: share.allocatedCents })) })) };
}
async function saveReceipt(supabase: SupabaseClient, receipt: ReceiptInput, expectedUpdatedAt: string | null) {
  const { error } = await supabase.rpc("save_receipt", { p_receipt: payload(receipt), p_expected_updated_at: expectedUpdatedAt }); fail(error);
  const saved = await getReceipt(supabase, receipt.id); if (!saved) throw new Error("Receipt not found after saving."); return saved;
}
export function createReceipt(supabase: SupabaseClient, receipt: ReceiptInput) { return saveReceipt(supabase, receipt, null); }
export async function updateReceipt(supabase: SupabaseClient, id: string, receipt: ReceiptInput, expectedUpdatedAt: string) { if (id !== receipt.id) throw new Error("Receipt ID mismatch."); return saveReceipt(supabase, receipt, expectedUpdatedAt); }
export async function deleteReceipt(supabase: SupabaseClient, id: string, expectedUpdatedAt: string) {
  const { data: objectPath, error } = await supabase.rpc("delete_receipt", { p_id: id, p_expected_updated_at: expectedUpdatedAt }); fail(error);
  if (objectPath) { const { error: storageError } = await supabase.storage.from("receipt-images").remove([objectPath]); fail(storageError); const { error: metadataError } = await supabase.from("receipt_images").delete().eq("object_path", objectPath); fail(metadataError); }
}
export async function saveImage(supabase: SupabaseClient, id: string, mime: string, bytes: Uint8Array) {
  const objectPath = `receipts/${id}`;
  const uploadBytes = new Uint8Array(bytes);
  const { error: uploadError } = await supabase.storage.from("receipt-images").upload(objectPath, new Blob([uploadBytes.buffer], { type: mime }), { contentType: mime, upsert: false }); fail(uploadError);
  const { error: metadataError } = await supabase.from("receipt_images").insert({ id, object_path: objectPath, mime_type: mime });
  if (metadataError) { await supabase.storage.from("receipt-images").remove([objectPath]); fail(metadataError); }
  return { id, objectPath, mime } satisfies StoredImage;
}
export async function getImage(supabase: SupabaseClient, id: string): Promise<{ mime: string; bytes: Uint8Array } | null> {
  const { data, error } = await supabase.from("receipt_images").select("object_path, mime_type").eq("id", id).maybeSingle(); fail(error); if (!data) return null;
  const { data: blob, error: downloadError } = await supabase.storage.from("receipt-images").download(data.object_path); fail(downloadError); if (!blob) throw new Error("The receipt image is no longer available.");
  return { mime: data.mime_type, bytes: new Uint8Array(await blob.arrayBuffer()) };
}
export async function getImageUrl(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("receipt_images").select("object_path").eq("id", id).maybeSingle(); fail(error); if (!data) return null;
  const { data: signed, error: signedError } = await supabase.storage.from("receipt-images").createSignedUrl(data.object_path, 60); fail(signedError); if (!signed) throw new Error("Could not create an image link."); return signed.signedUrl;
}
