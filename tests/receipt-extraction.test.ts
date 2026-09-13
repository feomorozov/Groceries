import assert from "node:assert/strict";
import test from "node:test";
import { extractionSchema } from "../src/lib/validation";

test("receipt extraction preserves printed item data and uncertainty", () => {
  const receipt = extractionSchema.parse({
    merchant: "Example Market",
    purchasedAt: "2026-09-13",
    currency: "USD",
    subtotalCents: 499,
    taxCents: 40,
    discountCents: -100,
    feeCents: null,
    totalCents: 439,
    items: [{
      sku: "12345",
      rawDescription: "ORG BNA 3LB",
      description: "Organic bananas, 3 lb",
      quantity: "1",
      unitPriceCents: 499,
      itemDiscountCents: -100,
      lineTotalCents: 399,
      isUncertain: true,
    }],
    warnings: ["The quantity is partially obscured."],
  });

  assert.deepEqual(receipt.items[0], {
    sku: "12345",
    rawDescription: "ORG BNA 3LB",
    description: "Organic bananas, 3 lb",
    quantity: "1",
    unitPriceCents: 499,
    itemDiscountCents: -100,
    lineTotalCents: 399,
    isUncertain: true,
  });
});
