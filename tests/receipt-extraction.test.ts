import assert from "node:assert/strict";
import test from "node:test";
import { OpenAIReceiptExtractionProvider, ReceiptExtractionError } from "../src/lib/receipt-extraction";
import { expandReceiptItems } from "../src/lib/receipt-items";
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

test("receipt reader returns a sanitized OpenAI diagnostic on provider failure", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: "Billing problem for sk-secret-value", code: "insufficient_quota" } }), {
    status: 429,
    statusText: "Too Many Requests",
    headers: { "x-request-id": "req_123" },
  })) as typeof fetch;

  try {
    await assert.rejects(
      new OpenAIReceiptExtractionProvider().extract({ mime: "image/jpeg", bytes: new Uint8Array([1, 2, 3]) }),
      (error: unknown) => {
        assert.ok(error instanceof ReceiptExtractionError);
        assert.equal(error.diagnostics.stage, "provider");
        assert.equal(error.diagnostics.providerStatus, 429);
        assert.equal(error.diagnostics.providerRequestId, "req_123");
        assert.deepEqual(error.diagnostics.providerResponse, { error: { message: "Billing problem for [redacted]", code: "insufficient_quota" } });
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});

test("counted receipt lines become separately assignable items", () => {
  const [first, second, third] = expandReceiptItems([{
    sku: "12345",
    rawDescription: "APPLE",
    description: "Apple",
    quantity: "3",
    unitPriceCents: null,
    itemDiscountCents: -100,
    lineTotalCents: 1000,
    isUncertain: false,
  }]);

  assert.deepEqual([first.lineTotalCents, second.lineTotalCents, third.lineTotalCents], [334, 333, 333]);
  assert.deepEqual([first.itemDiscountCents, second.itemDiscountCents, third.itemDiscountCents], [-34, -33, -33]);
  assert.deepEqual([first.quantity, second.quantity, third.quantity], [null, null, null]);
  assert.deepEqual([first.unitPriceCents, second.unitPriceCents, third.unitPriceCents], [334, 333, 333]);
});
