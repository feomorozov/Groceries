import { z } from "zod";
import { ALL_IDS } from "./types";

export const centsSchema = z.number().int().min(-999999999).max(999999999);
export const paymentSchema = z.object({
  payerId: z.enum(ALL_IDS as ["michael", "kevin", "feo", "saketh"]),
  recipientId: z.enum(ALL_IDS as ["michael", "kevin", "feo", "saketh"]),
  cents: z.number().int().min(1, "Enter a payment greater than zero.").max(999999999),
}).refine((payment) => payment.payerId !== payment.recipientId, "Choose two different roommates.");
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid date.");
export const receiptSchema = z.object({
  id: z.uuid(),
  isComplete: z.boolean(),
  merchant: z.string().trim().max(200),
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
    description: z.string().trim().max(300),
    quantity: z.string().trim().max(40).nullable(),
    unitPriceCents: centsSchema.nullable(),
    itemDiscountCents: centsSchema.nullable(),
    lineTotalCents: centsSchema,
    isUncertain: z.boolean(),
    roommateIds: z.array(z.enum(ALL_IDS as ["michael", "kevin", "feo", "saketh"])).max(4).refine((ids) => new Set(ids).size === ids.length),
  })).max(300),
}).strict().superRefine((receipt, ctx) => {
  if (new Set(receipt.items.map((i) => i.id)).size !== receipt.items.length) ctx.addIssue({ code: "custom", message: "Item IDs must be unique." });
  const sum = receipt.items.reduce((n, i) => n + i.lineTotalCents, 0);
  if (Math.abs(sum) > 999999999) ctx.addIssue({ code: "custom", message: "This receipt exceeds the supported amount." });
  if (!receipt.isComplete) return;
  if (!receipt.merchant) ctx.addIssue({ code: "custom", path: ["merchant"], message: "Enter the store name." });
  if (!receipt.items.length) ctx.addIssue({ code: "custom", path: ["items"], message: "Add at least one item." });
  receipt.items.forEach((item, index) => {
    if (!item.description) ctx.addIssue({ code: "custom", path: ["items", index, "description"], message: "Name each item." });
    if (!item.roommateIds.length) ctx.addIssue({ code: "custom", path: ["items", index, "roommateIds"], message: "Assign every item." });
  });
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
