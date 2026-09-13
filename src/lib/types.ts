export const ROOMMATES = [
  { id: "michael", name: "Michael" },
  { id: "kevin", name: "Kevin" },
  { id: "feo", name: "Feo" },
  { id: "socket", name: "Socket" },
] as const;
export type RoommateId = (typeof ROOMMATES)[number]["id"];
export const ALL_IDS: RoommateId[] = ROOMMATES.map((r) => r.id);
export const nameOf = (id: RoommateId) => ROOMMATES.find((r) => r.id === id)!.name;

export type ReceiptItem = {
  id: string;
  description: string;
  quantity: string | null;
  unitPriceCents: number | null;
  lineTotalCents: number;
  roommateIds: RoommateId[];
};
export type ReceiptInput = {
  id: string;
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
