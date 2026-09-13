import { extractionSchema, type ExtractedReceipt } from "./validation";

export interface ReceiptExtractionProvider {
  extract(image: { mime: string; bytes: Uint8Array }): Promise<ExtractedReceipt>;
}

export type ReceiptExtractionDiagnostics = {
  stage: "configuration" | "request" | "provider" | "response" | "validation";
  model: string;
  providerStatus?: number;
  providerStatusText?: string;
  providerRequestId?: string | null;
  providerResponse?: unknown;
  providerOutput?: string;
  reason?: string;
};

export class ReceiptExtractionError extends Error {
  constructor(message: string, readonly diagnostics: ReceiptExtractionDiagnostics) {
    super(message);
  }
}

function redactAndTrim(value: string, limit = 4_000) {
  const redacted = value.replace(/\bsk-[A-Za-z0-9_-]+\b/g, "[redacted]");
  return redacted.length > limit ? `${redacted.slice(0, limit)}…` : redacted;
}
function providerResponse(value: string): unknown {
  const safeValue = redactAndTrim(value);
  try { return JSON.parse(safeValue); } catch { return safeValue; }
}
function errorReason(error: unknown) { return error instanceof Error ? error.message : String(error); }

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
        description: { type: "string" }, quantity: { type: ["string", "null"], description: "Always null because each purchased unit is a separate item." },
        unitPriceCents: { type: ["integer", "null"], description: "The individual item's price before any item-level adjustment, when known." }, lineTotalCents: { type: ["integer", "null"], description: "The individual item's actual charged price." },
        itemDiscountCents: { type: ["integer", "null"], description: "Signed item-level coupon or adjustment in cents; a discount is negative." },
        isUncertain: { type: "boolean" },
      } } },
    warnings: { type: "array", items: { type: "string" } },
  },
};

export class OpenAIReceiptExtractionProvider implements ReceiptExtractionProvider {
  async extract(image: { mime: string; bytes: Uint8Array }): Promise<ExtractedReceipt> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.RECEIPT_MODEL || "gpt-4.1-mini";
    if (!apiKey) throw new ReceiptExtractionError("Receipt reading isn't configured. Add OPENAI_API_KEY in Vercel Environment Variables, then redeploy.", { stage: "configuration", model, reason: "OPENAI_API_KEY is not set on this server." });

    const base64 = Buffer.from(image.bytes).toString("base64");
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model, store: false,
          input: [{ role: "user", content: [
            { type: "input_text", text: `You are a grocery receipt extraction assistant. Read this receipt image and extract only the purchased products, for any retailer.

For every purchased item, return its printed SKU/item code in sku when present; rawDescription as the product code or abbreviated text exactly as printed; and description as the best conservative human-readable name. Each individual purchased unit must be its own item, including identical products on a receipt line marked with a quantity. Do not group duplicates. Set quantity to null for every item. Return unitPriceCents when identifiable, and lineTotalCents as that individual item's actual amount charged after any line-level discount. When a counted line has a total that does not divide evenly, distribute the cents across the separate items so their sum remains exact. Put an item-specific coupon, discount, or adjustment in itemDiscountCents as signed integer cents (negative for a reduction). Mark isUncertain true for a line with any unclear material value.

Exclude subtotals, tax, receipt-level discounts, fees, payment/tender details, membership numbers, transaction IDs, and change from items. Do not make coupons their own items: attach a clear product-level coupon to that product; put receipt-level discounts only in discountCents. Do not use objects around the receipt as evidence.

Return every monetary value as signed integer cents. Extract merchant, purchase date, subtotal, tax, receipt-level discounts/savings, fees, and final total when available. Use null for an unreadable value, do not invent details, and explain uncertainty in warnings. Check that item prices, subtotal, and total are reasonably consistent.` },
            { type: "input_image", image_url: `data:${image.mime};base64,${base64}`, detail: "high" },
          ] }],
          text: { format: { type: "json_schema", name: "receipt_extraction", strict: true, schema: responseSchema } },
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (error) {
      throw new ReceiptExtractionError("Couldn't reach the receipt reader.", { stage: "request", model, reason: errorReason(error) });
    }

    if (!response.ok) {
      const detail = await response.text();
      const diagnostics = { stage: "provider" as const, model, providerStatus: response.status, providerStatusText: response.statusText, providerRequestId: response.headers.get("x-request-id"), providerResponse: providerResponse(detail) };
      console.error("Receipt provider error", diagnostics);
      throw new ReceiptExtractionError("Couldn't read this receipt.", diagnostics);
    }

    let body: { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    try { body = await response.json(); }
    catch (error) { throw new ReceiptExtractionError("The receipt reader returned an unreadable response.", { stage: "response", model, providerStatus: response.status, providerStatusText: response.statusText, providerRequestId: response.headers.get("x-request-id"), reason: errorReason(error) }); }

    const text = body.output_text ?? body.output?.flatMap((item) => item.content ?? []).find((content) => content.type === "output_text")?.text;
    if (!text) throw new ReceiptExtractionError("The receipt reader returned no structured output.", { stage: "response", model, providerStatus: response.status, providerStatusText: response.statusText, providerRequestId: response.headers.get("x-request-id"), providerResponse: providerResponse(JSON.stringify(body)) });
    try { return extractionSchema.parse(JSON.parse(text)); }
    catch (error) { throw new ReceiptExtractionError("The receipt reader returned an unexpected result.", { stage: "validation", model, providerStatus: response.status, providerStatusText: response.statusText, providerRequestId: response.headers.get("x-request-id"), providerOutput: redactAndTrim(text), reason: errorReason(error) }); }
  }
}

export function receiptExtractionProvider(): ReceiptExtractionProvider {
  return new OpenAIReceiptExtractionProvider();
}
