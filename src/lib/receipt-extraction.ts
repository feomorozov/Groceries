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
      required: ["description", "quantity", "unitPriceCents", "lineTotalCents"], properties: {
        description: { type: "string" }, quantity: { type: ["string", "null"] },
        unitPriceCents: { type: ["integer", "null"] }, lineTotalCents: { type: ["integer", "null"] },
      } } },
    warnings: { type: "array", items: { type: "string" } },
  },
};

export class OpenAIReceiptExtractionProvider implements ReceiptExtractionProvider {
  async extract(image: { mime: string; bytes: Uint8Array }): Promise<ExtractedReceipt> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Receipt reading isn't configured. You can enter it manually.");
    const base64 = Buffer.from(image.bytes).toString("base64");
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.RECEIPT_MODEL || "gpt-4.1-mini", store: false,
        input: [{ role: "user", content: [
          { type: "input_text", text: "Extract this grocery receipt. Return monetary amounts as signed integer cents. Do not include subtotal, tax, fees, totals, tenders, or change as line items. Preserve coupons that belong to individual products as negative line items; put only receipt-level discounts in discountCents. Use null when unreadable and mention uncertainty in warnings." },
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
