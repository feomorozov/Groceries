import { extractionSchema, type ExtractedReceipt } from "./validation";

export interface ReceiptExtractionProvider {
  extract(image: { mime: string; bytes: Uint8Array }): Promise<ExtractedReceipt>;
}

const responseSchema = {
  type: "object", additionalProperties: false,
  required: ["merchant", "purchasedAt", "currency", "subtotalCents", "taxCents", "discountCents", "feeCents", "totalCents", "items", "warnings"],
  properties: {
    merchant: { type: ["string", "null"] },
    purchasedAt: { type: ["string", "null"], description: "YYYY-MM-DD" },
    currency: { type: ["string", "null"] },
    subtotalCents: { type: ["integer", "null"] }, taxCents: { type: ["integer", "null"] },
    discountCents: { type: ["integer", "null"], description: "A discount is a negative integer." },
    feeCents: { type: ["integer", "null"] }, totalCents: { type: ["integer", "null"] },
    items: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["sku", "rawDescription", "description", "quantity", "unitPriceCents", "itemDiscountCents", "lineTotalCents", "isUncertain"], properties: {
        sku: { type: ["string", "null"], description: "Printed SKU or item code, if present." },
        rawDescription: { type: ["string", "null"], description: "Product code or abbreviated description exactly as printed." },
        description: { type: "string" }, quantity: { type: ["string", "null"] },
        unitPriceCents: { type: ["integer", "null"] }, lineTotalCents: { type: ["integer", "null"] },
        itemDiscountCents: { type: ["integer", "null"], description: "Signed item-level coupon or adjustment in cents; a discount is negative." },
        isUncertain: { type: "boolean" },
      } } },
    warnings: { type: "array", items: { type: "string" } },
  },
};

export class OpenAIReceiptExtractionProvider implements ReceiptExtractionProvider {
  async extract(image: { mime: string; bytes: Uint8Array }): Promise<ExtractedReceipt> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Receipt reading isn't configured. Add OPENAI_API_KEY in Vercel Environment Variables, then redeploy.");
    const base64 = Buffer.from(image.bytes).toString("base64");
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.RECEIPT_MODEL || "gpt-4.1-mini", store: false,
        input: [{ role: "user", content: [
          { type: "input_text", text: `You are a grocery receipt extraction assistant. Read this receipt image and extract only the purchased products, for any retailer.

For every purchased item, return its printed SKU/item code in sku when present; rawDescription as the product code or abbreviated text exactly as printed; and description as the best conservative human-readable name. Return quantity when identifiable, unitPriceCents when identifiable, and lineTotalCents as the actual amount charged after any line-level discount. Put an item-specific coupon, discount, or adjustment in itemDiscountCents as signed integer cents (negative for a reduction). Mark isUncertain true for a line with any unclear material value.

Keep repeated purchases as separate items unless the receipt clearly gives one quantity. Exclude subtotals, tax, receipt-level discounts, fees, payment/tender details, membership numbers, transaction IDs, and change from items. Do not make coupons their own items: attach a clear product-level coupon to that product; put receipt-level discounts only in discountCents. Do not use objects around the receipt as evidence.

Return every monetary value as signed integer cents. Extract merchant, purchase date, subtotal, tax, receipt-level discounts/savings, fees, and final total when available. Use null for an unreadable value, do not invent details, and explain uncertainty in warnings. Check that item prices, subtotal, and total are reasonably consistent.` },
          { type: "input_image", image_url: `data:${image.mime};base64,${base64}`, detail: "high" },
        ] }],
        text: { format: { type: "json_schema", name: "receipt_extraction", strict: true, schema: responseSchema } },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("Receipt provider error", response.status, detail.slice(0, 500));
      throw new Error("Couldn't read this receipt.");
    }
    const body = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const text = body.output_text ?? body.output?.flatMap((item) => item.content ?? []).find((content) => content.type === "output_text")?.text;
    if (!text) throw new Error("Couldn't read this receipt.");
    return extractionSchema.parse(JSON.parse(text));
  }
}

export function receiptExtractionProvider(): ReceiptExtractionProvider {
  return new OpenAIReceiptExtractionProvider();
}
