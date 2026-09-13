import { ALL_IDS, type PairBalance, type ReceiptInput, type RoommateId } from "./types";

// Parse decimal strings directly; dollars never enter floating-point arithmetic.
export function parseMoney(value: string): number | null {
  const match = /^(-?)(\d{1,8})(?:\.(\d{0,2}))?$/.exec(value.trim());
  if (!match) return null;
  const cents = Number(match[2]) * 100 + Number((match[3] ?? "").padEnd(2, "0"));
  return match[1] ? -cents : cents;
}
export function moneyInput(cents: number): string {
  const n = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.floor(n / 100)}.${String(n % 100).padStart(2, "0")}`;
}
export function formatMoney(cents: number): string {
  const [whole, fraction] = moneyInput(Math.abs(cents)).split(".");
  return `${cents < 0 ? "−" : ""}$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}

// Largest remainder, with input order breaking ties. BigInt keeps products exact.
export function allocateWeighted(cents: number, weights: number[]): number[] {
  if (!Number.isSafeInteger(cents) || weights.some((w) => !Number.isSafeInteger(w) || w < 0)) {
    throw new Error("Money and weights must be integer cents.");
  }
  const total = weights.reduce((sum, w) => sum + BigInt(w), 0n);
  if (total === 0n) {
    if (cents !== 0) throw new Error("Add a positive-priced item before distributing adjustments.");
    return weights.map(() => 0);
  }
  const amount = BigInt(Math.abs(cents));
  const parts = weights.map((weight, index) => {
    const product = amount * BigInt(weight);
    return { index, allocated: Number(product / total), remainder: product % total };
  });
  const remaining = Number(amount) - parts.reduce((sum, p) => sum + p.allocated, 0);
  const ranked = [...parts].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (let i = 0; i < remaining; i++) ranked[i].allocated++;
  return parts.map((part) => part.allocated * (cents < 0 ? -1 : 1));
}

export function allocateReceipt(receipt: ReceiptInput) {
  if (!receipt.items.length) throw new Error("Add at least one item.");
  const sum = receipt.items.reduce((n, item) => n + item.lineTotalCents, 0);
  if (sum !== receipt.subtotalCents) throw new Error("The subtotal must equal the sum of your items.");
  if (sum + receipt.taxCents + receipt.adjustmentCents !== receipt.totalCents) {
    throw new Error("Reconcile the receipt total before saving.");
  }
  const adjustments = allocateWeighted(receipt.taxCents + receipt.adjustmentCents, receipt.items.map((i) => Math.max(0, i.lineTotalCents)));
  const portions = Object.fromEntries(ALL_IDS.map((id) => [id, 0])) as Record<RoommateId, number>;
  const items = receipt.items.map((item, index) => {
    const ids = ALL_IDS.filter((id) => item.roommateIds.includes(id));
    if (!ids.length || ids.length !== item.roommateIds.length) throw new Error("Assign each item to at least one roommate, without duplicates.");
    const finalCents = item.lineTotalCents + adjustments[index];
    const cents = allocateWeighted(finalCents, ids.map(() => 1));
    const shares = ids.map((roommateId, i) => {
      portions[roommateId] += cents[i];
      return { roommateId, allocatedCents: cents[i] };
    });
    return { itemId: item.id, adjustmentCents: adjustments[index], finalCents, shares };
  });
  if (Object.values(portions).reduce((n, c) => n + c, 0) !== receipt.totalCents) throw new Error("Shares do not reconcile.");
  return { items, portions };
}

export function calculateBalances(receipts: ReceiptInput[]): PairBalance[] {
  const debts = Object.fromEntries(ALL_IDS.map((id) => [id, Object.fromEntries(ALL_IDS.map((other) => [other, 0]))])) as Record<RoommateId, Record<RoommateId, number>>;
  for (const receipt of receipts) {
    const { portions } = allocateReceipt(receipt);
    for (const id of ALL_IDS) if (id !== receipt.payerId) debts[id][receipt.payerId] += portions[id];
  }
  return ALL_IDS.flatMap((first, i) => ALL_IDS.slice(i + 1).map((second) => {
    const net = debts[first][second] - debts[second][first];
    return { first, second, debtor: net === 0 ? null : net > 0 ? first : second, creditor: net === 0 ? null : net > 0 ? second : first, cents: Math.abs(net) };
  }));
}
