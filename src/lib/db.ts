import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { allocateReceipt, calculateBalances } from "./money";
import { ALL_IDS, ROOMMATES, type Receipt, type ReceiptInput, type ReceiptItem, type RoommateId, type TripSummary } from "./types";

type SqlValue = string | number | null | Uint8Array;
type Row = Record<string, SqlValue>;
const dbPath = path.resolve(/* turbopackIgnore: true */ process.env.DATABASE_PATH || "./data/groceries.sqlite");
mkdirSync(path.dirname(dbPath), { recursive: true });

const globalDb = globalThis as unknown as { groceriesDb?: DatabaseSync };
export const db = globalDb.groceriesDb ?? new DatabaseSync(dbPath, { timeout: 5000 });
if (process.env.NODE_ENV !== "production") globalDb.groceriesDb = db;
db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
db.exec(`
  CREATE TABLE IF NOT EXISTS roommates (
    id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE
  ) STRICT;
  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY, mime_type TEXT NOT NULL, bytes BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) STRICT;
  CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY, merchant TEXT NOT NULL, purchased_at TEXT NOT NULL,
    payer_id TEXT NOT NULL REFERENCES roommates(id), subtotal_cents INTEGER NOT NULL,
    tax_cents INTEGER NOT NULL, adjustment_cents INTEGER NOT NULL, total_cents INTEGER NOT NULL,
    image_id TEXT REFERENCES images(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE IF NOT EXISTS receipt_items (
    id TEXT PRIMARY KEY, receipt_id TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    description TEXT NOT NULL, quantity TEXT, unit_price_cents INTEGER,
    line_total_cents INTEGER NOT NULL, sort_order INTEGER NOT NULL
  ) STRICT;
  CREATE TABLE IF NOT EXISTS item_shares (
    receipt_item_id TEXT NOT NULL REFERENCES receipt_items(id) ON DELETE CASCADE,
    roommate_id TEXT NOT NULL REFERENCES roommates(id), allocated_cents INTEGER NOT NULL,
    PRIMARY KEY (receipt_item_id, roommate_id)
  ) STRICT;
  CREATE INDEX IF NOT EXISTS receipts_date ON receipts(purchased_at DESC, created_at DESC);
  CREATE INDEX IF NOT EXISTS items_receipt ON receipt_items(receipt_id, sort_order);
`);
const seed = db.prepare("INSERT OR IGNORE INTO roommates (id, name) VALUES (?, ?)");
ROOMMATES.forEach(({ id, name }) => seed.run(id, name));
// Preserve any earlier local data created before the fourth roommate was renamed.
if (db.prepare("SELECT 1 FROM roommates WHERE id = 'socket'").get()) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("INSERT OR IGNORE INTO roommates (id, name) VALUES ('saketh', 'Saketh')").run();
    db.prepare("UPDATE receipts SET payer_id = 'saketh' WHERE payer_id = 'socket'").run();
    db.prepare("UPDATE item_shares SET roommate_id = 'saketh' WHERE roommate_id = 'socket'").run();
    db.prepare("DELETE FROM roommates WHERE id = 'socket'").run();
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

function value<T extends SqlValue>(row: Row, key: string): T { return row[key] as T; }
function getItems(receiptId: string): ReceiptItem[] {
  const rows = db.prepare(`
    SELECT i.*, GROUP_CONCAT(s.roommate_id) AS roommate_ids
    FROM receipt_items i LEFT JOIN item_shares s ON s.receipt_item_id = i.id
    WHERE i.receipt_id = ? GROUP BY i.id ORDER BY i.sort_order
  `).all(receiptId) as Row[];
  return rows.map((row) => ({
    id: value<string>(row, "id"), description: value<string>(row, "description"),
    quantity: value<string | null>(row, "quantity"), unitPriceCents: value<number | null>(row, "unit_price_cents"),
    lineTotalCents: value<number>(row, "line_total_cents"),
    roommateIds: String(row.roommate_ids ?? "").split(",").filter((id): id is RoommateId => ALL_IDS.includes(id as RoommateId)),
  }));
}
function toReceipt(row: Row): Receipt {
  return {
    id: value<string>(row, "id"), merchant: value<string>(row, "merchant"), purchasedAt: value<string>(row, "purchased_at"),
    payerId: value<RoommateId>(row, "payer_id"), subtotalCents: value<number>(row, "subtotal_cents"), taxCents: value<number>(row, "tax_cents"),
    adjustmentCents: value<number>(row, "adjustment_cents"), totalCents: value<number>(row, "total_cents"), imageId: value<string | null>(row, "image_id"),
    createdAt: value<string>(row, "created_at"), updatedAt: value<string>(row, "updated_at"), items: getItems(value<string>(row, "id")),
  };
}
export function getReceipt(id: string): Receipt | null {
  const row = db.prepare("SELECT * FROM receipts WHERE id = ?").get(id) as Row | undefined;
  return row ? toReceipt(row) : null;
}
export function getReceipts(): Receipt[] {
  return (db.prepare("SELECT * FROM receipts ORDER BY purchased_at DESC, created_at DESC").all() as Row[]).map(toReceipt);
}
export function getHomeData() {
  const receipts = getReceipts();
  const trips: TripSummary[] = receipts.map(({ items, ...receipt }) => ({ ...receipt, itemCount: items.length }));
  return { trips, balances: calculateBalances(receipts) };
}

function transaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try { const result = fn(); db.exec("COMMIT"); return result; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
function writeItems(receipt: ReceiptInput) {
  const allocation = allocateReceipt(receipt);
  const itemStmt = db.prepare("INSERT INTO receipt_items VALUES (?, ?, ?, ?, ?, ?, ?)");
  const shareStmt = db.prepare("INSERT INTO item_shares VALUES (?, ?, ?)");
  receipt.items.forEach((item, index) => {
    itemStmt.run(item.id, receipt.id, item.description, item.quantity, item.unitPriceCents, item.lineTotalCents, index);
    allocation.items[index].shares.forEach((share) => shareStmt.run(item.id, share.roommateId, share.allocatedCents));
  });
}
export function createReceipt(receipt: ReceiptInput): Receipt {
  allocateReceipt(receipt);
  return transaction(() => {
    const existing = getReceipt(receipt.id);
    if (existing) return existing;
    if (receipt.imageId && !getImage(receipt.imageId)) throw new Error("The receipt image is no longer available.");
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO receipts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(receipt.id, receipt.merchant, receipt.purchasedAt, receipt.payerId, receipt.subtotalCents, receipt.taxCents, receipt.adjustmentCents, receipt.totalCents, receipt.imageId, now, now);
    writeItems(receipt);
    return getReceipt(receipt.id)!;
  });
}
export function updateReceipt(id: string, receipt: ReceiptInput, expectedUpdatedAt: string): Receipt {
  if (id !== receipt.id) throw new Error("Receipt ID mismatch.");
  allocateReceipt(receipt);
  return transaction(() => {
    const previous = getReceipt(id);
    if (!previous) throw new Error("Receipt not found.");
    if (previous.updatedAt !== expectedUpdatedAt) throw new Error("This receipt changed elsewhere. Reload and try again.");
    const now = new Date(Math.max(Date.now(), Date.parse(previous.updatedAt) + 1)).toISOString();
    const result = db.prepare(`UPDATE receipts SET merchant=?, purchased_at=?, payer_id=?, subtotal_cents=?, tax_cents=?, adjustment_cents=?, total_cents=?, image_id=?, updated_at=? WHERE id=? AND updated_at=?`)
      .run(receipt.merchant, receipt.purchasedAt, receipt.payerId, receipt.subtotalCents, receipt.taxCents, receipt.adjustmentCents, receipt.totalCents, receipt.imageId, now, id, expectedUpdatedAt);
    if (Number(result.changes) !== 1) throw new Error("This receipt changed elsewhere. Reload and try again.");
    db.prepare("DELETE FROM receipt_items WHERE receipt_id = ?").run(id);
    writeItems(receipt);
    return getReceipt(id)!;
  });
}
export function deleteReceipt(id: string, expectedUpdatedAt: string) {
  return transaction(() => {
    const previous = getReceipt(id);
    if (!previous) throw new Error("Receipt not found.");
    if (previous.updatedAt !== expectedUpdatedAt) throw new Error("This receipt changed elsewhere. Reload and try again.");
    db.prepare("DELETE FROM receipts WHERE id = ?").run(id);
    if (previous.imageId) db.prepare("DELETE FROM images WHERE id = ?").run(previous.imageId);
  });
}
export function saveImage(id: string, mime: string, bytes: Uint8Array) {
  db.prepare("DELETE FROM images WHERE created_at < datetime('now', '-1 day') AND id NOT IN (SELECT image_id FROM receipts WHERE image_id IS NOT NULL)").run();
  db.prepare("INSERT INTO images (id, mime_type, bytes) VALUES (?, ?, ?)").run(id, mime, bytes);
}
export function getImage(id: string): { mime: string; bytes: Uint8Array } | null {
  const row = db.prepare("SELECT mime_type, bytes FROM images WHERE id = ?").get(id) as Row | undefined;
  return row ? { mime: value<string>(row, "mime_type"), bytes: value<Uint8Array>(row, "bytes") } : null;
}
