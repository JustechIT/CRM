import { z } from "zod";
import {
  quotationStatuses,
  paymentStatuses,
  type SalesSection,
} from "./config";
const text = (max = 250) => z.string().trim().max(max).default("");
const requiredText = (max = 250) =>
  z.string().trim().min(1, "This field is required.").max(max);
const dateValue = z.iso.date();
const optionalDate = z
  .union([z.literal(""), dateValue])
  .transform((v) => v || null);
export const decimal = z
  .string()
  .trim()
  .regex(
    /^\d{1,12}(\.\d{1,3})?$/,
    "Enter a non-negative amount with up to 12 whole digits and 3 decimal places.",
  );
const optionalDecimal = z
  .union([z.literal(""), decimal])
  .transform((v) => v || null);
const references = {
  account_id: z.uuid("Select an existing institution."),
  product_id: z.uuid("Select an existing product."),
};
const schemas = {
  opportunities: z
    .object({
      organization_name: requiredText(),
      product_text: requiredText(),
      name: requiredText(200),
      date: dateValue,
      due_date: optionalDate,
      value: optionalDecimal,
      stage: requiredText(100),
      action_type: text(100),
      expected_close: optionalDate,
      note: text(5000),
    })
    .refine((v) => !v.due_date || v.due_date >= v.date, {
      message: "Due Date cannot precede Date.",
      path: ["due_date"],
    })
    .refine((v) => !v.expected_close || v.expected_close >= v.date, {
      message: "Expected Close cannot precede Date.",
      path: ["expected_close"],
    }),
  quotations: z.object({
    ...references,
    lcid: requiredText(100),
    type: text(100),
    client: text(),
    nom: text(),
    ref_eng: text(100),
    compte_no: text(100),
    ccy: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Enter a three-letter currency code."),
    amount: decimal,
    drawings: optionalDecimal,
    liability_amount: optionalDecimal,
    total_lc: optionalDecimal,
    total_liab: optionalDecimal,
    total_drawings: optionalDecimal,
    subscription_period: text(),
    decision_status: z.enum(quotationStatuses),
  }),
  subscriptions: z
    .object({
      ...references,
      creation_date: dateValue.default(new Date().toISOString().slice(0, 10)),
      payment_status: z.enum(paymentStatuses).default("Unpaid"),
      start_date: dateValue,
      end_date: dateValue,
      contract_duration: text(100),
      status: requiredText(100),
      kind: z.enum(["Turnitin", "Other"]),
      annual_amount: optionalDecimal,
      currency: z.union([
        z.literal(""),
        z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{3}$/, "Enter a three-letter currency code."),
      ]),
    })
    .refine((v) => v.end_date >= v.start_date, {
      message: "End Date must be on or after Start Date.",
      path: ["end_date"],
    })
    .refine((v) => v.annual_amount === null || !!v.currency, {
      message: "Choose a currency for the annual amount.",
      path: ["currency"],
    })
    .transform((v) => ({
      ...v,
      contract_duration:
        v.contract_duration || contractDuration(v.start_date, v.end_date),
    })),
  payments: z.object({
    ...references,
    invoice_reference: requiredText(),
    amount: decimal,
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/),
    payment_date: dateValue,
    payment_method: requiredText(100),
    payment_status: z.enum(paymentStatuses),
    notes: text(5000),
    subscription_id: z
      .union([z.literal(""), z.uuid()])
      .transform((v) => v || null),
  }),
  renewals: z.object({
    ...references,
    expiry_date: dateValue,
    renewal_stage: requiredText(100),
    next_action: text(500),
    follow_up_date: optionalDate,
  }),
};
export function validateSales(section: SalesSection, input: unknown) {
  return schemas[section].safeParse(input);
}
export function contractDuration(start: string, end: string) {
  const days =
    Math.round(
      (Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) /
        86400000,
    ) + 1;
  return `${days} ${days === 1 ? "day" : "days"}`;
}
export const productSchema = z.object({
  name: requiredText(200),
  subscription_kind: z.enum(["Turnitin", "Other"]),
});
export const versionSchema = z.coerce.number().int().min(1).max(2147483647);
export const idSchema = z.uuid();
export function normalizedDate(value: string | undefined) {
  return value && dateValue.safeParse(value).success ? value : "";
}
