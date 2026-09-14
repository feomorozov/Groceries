export const ROOMMATES = [
  { id: "michael", name: "Michael" },
  { id: "kevin", name: "Kevin" },
  { id: "feo", name: "Feo" },
  { id: "saketh", name: "Saketh" },
] as const;
export type RoommateId = (typeof ROOMMATES)[number]["id"];
export const ALL_IDS: RoommateId[] = ROOMMATES.map((r) => r.id);
export const nameOf = (id: RoommateId) => ROOMMATES.find((r) => r.id === id)!.name;

export type ReceiptItem = {
  id: string;
  /** Printed SKU or item code, when the receipt makes one available. */
  sku: string | null;
  /** Product text exactly as printed on the receipt. */
  rawDescription: string | null;
  description: string;
  quantity: string | null;
  unitPriceCents: number | null;
  /** Signed line-level discount or adjustment; a discount is negative. */
  itemDiscountCents: number | null;
  lineTotalCents: number;
  /** Lets the editor call out a line the receipt reader could not read confidently. */
  isUncertain: boolean;
  roommateIds: RoommateId[];
};
export type ReceiptInput = {
  id: string;
  /** Incomplete receipts are saved for later and do not affect balances. */
  isComplete: boolean;
  merchant: string;
  purchasedAt: string;
  payerId: RoommateId;
  subtotalCents: number;
  taxCents: number;
  adjustmentCents: number;
  totalCents: number;
  imageId: string | null;
  items: ReceiptItem[];
};
export type Receipt = ReceiptInput & { createdAt: string; updatedAt: string };
export type TripSummary = Omit<Receipt, "items"> & { itemCount: number };
export type PairBalance = {
  first: RoommateId;
  second: RoommateId;
  debtor: RoommateId | null;
  creditor: RoommateId | null;
  cents: number;
};
export type BalancePayment = {
  id: string;
  payerId: RoommateId;
  recipientId: RoommateId;
  cents: number;
  createdAt: string;
};
