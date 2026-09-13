import { z } from "zod";
import { ALL_IDS } from "./types";

export const centsSchema = z.number().int().min(-999999999).max(999999999);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid date.");
export const receiptSchema = z.object({
  id: z.uuid(),
  merchant: z.string().trim().min(1, "Enter the store name.").max(200),
  purchasedAt: dateSchema,
  payerId: z.enum(ALL_IDS as ["michael", "kevin", "feo", "saketh"]),
  subtotalCents: centsSchema,
  taxCents: centsSchema,
  adjustmentCents: centsSchema,
  totalCents: centsSchema.refine((n) => n >= 0, "The receipt total cannot be negative."),
  imageId: z.uuid().nullable(),
  items: z.array(z.object({
    id: z.uuid(),
    sku: z.string().trim().max(120).nullable(),
    rawDescription: z.string().trim().max(300).nullable(),
    description: z.string().trim().min(1, "Name each item.").max(300),
    quantity: z.string().trim().max(40).nullable(),
    unitPriceCents: centsSchema.nullable(),
    itemDiscountCents: centsSchema.nullable(),
    lineTotalCents: centsSchema,
    isUncertain: z.boolean(),
    roommateIds: z.array(z.enum(ALL_IDS as ["michael", "kevin", "feo", "saketh"])).min(1, "Assign every item.").max(4).refine((ids) => new Set(ids).size === ids.length),
  })).min(1, "Add at least one item.").max(300),
}).strict().superRefine((receipt, ctx) => {
  if (new Set(receipt.items.map((i) => i.id)).size !== receipt.items.length) ctx.addIssue({ code: "custom", message: "Item IDs must be unique." });
  const sum = receipt.items.reduce((n, i) => n + i.lineTotalCents, 0);
  if (Math.abs(sum) > 999999999) ctx.addIssue({ code: "custom", message: "This receipt exceeds the supported amount." });
});

// Nullable fields preserve partial reads without fabricating missing information.
export const extractionSchema = z.object({
  merchant: z.string().max(200).nullable(),
  purchasedAt: dateSchema.nullable(),
  currency: z.string().max(10).nullable(),
  subtotalCents: centsSchema.nullable(),
  taxCents: centsSchema.nullable(),
  discountCents: centsSchema.nullable(),
  feeCents: centsSchema.nullable(),
  totalCents: centsSchema.nullable(),
  items: z.array(z.object({
    sku: z.string().max(120).nullable(),
    rawDescription: z.string().max(300).nullable(),
    description: z.string().max(300),
    quantity: z.string().max(40).nullable(),
    unitPriceCents: centsSchema.nullable(),
    itemDiscountCents: centsSchema.nullable(),
    lineTotalCents: centsSchema.nullable(),
    isUncertain: z.boolean(),
  })).max(300),
  warnings: z.array(z.string().max(500)).max(30),
});
export type ExtractedReceipt = z.infer<typeof extractionSchema>;
