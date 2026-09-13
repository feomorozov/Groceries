import type { ExtractedReceipt } from "./validation";

type ExtractedItem = ExtractedReceipt["items"][number];

function purchaseCount(quantity: string | null) {
  if (!quantity || !/^\d+(?:\.0+)?$/.test(quantity.trim())) return 1;
  const count = Number(quantity);
  return Number.isSafeInteger(count) && count > 1 && count <= 300 ? count : 1;
}

function divideCents(cents: number | null, count: number) {
  if (cents === null) return Array<number | null>(count).fill(null);
  const base = Math.trunc(cents / count);
  const remainder = cents - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < Math.abs(remainder) ? Math.sign(remainder) : 0));
}

/** Expands a counted receipt line into separately assignable household items. */
export function expandReceiptItems(items: ExtractedItem[]): ExtractedItem[] {
  return items.flatMap((item) => {
    const count = purchaseCount(item.quantity);
    if (count === 1) return [{ ...item, quantity: null }];

    const totals = divideCents(item.lineTotalCents, count);
    const discounts = divideCents(item.itemDiscountCents, count);
    return totals.map((lineTotalCents, index) => ({
      ...item,
      quantity: null,
      unitPriceCents: item.unitPriceCents ?? lineTotalCents,
      lineTotalCents,
      itemDiscountCents: discounts[index],
    }));
  });
}
