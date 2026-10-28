import { z } from "zod";
import { decimal } from "@/lib/sales/validation";
import { paymentStatuses } from "@/lib/sales/config";
export const invoiceFields = [
  ["invoice_number", "Invoice Number", "text"],
  ["supplier", "Supplier", "text"],
  ["product_service", "Product / Service", "text"],
  ["invoice_date", "Invoice Date", "date"],
  ["due_date", "Due Date", "date"],
  ["amount", "Amount", "number"],
  ["currency", "Currency", "text"],
  ["payment_status", "Payment Status", "select"],
  ["file_name", "Invoice File", "file"],
  ["notes", "Notes", "textarea"],
] as const;
export const invoiceSchema = z
  .object({
    invoice_number: z.string().trim().min(1).max(250),
    supplier: z.string().trim().min(1).max(250),
    product_service: z.string().trim().min(1).max(250),
    invoice_date: z.iso.date(),
    due_date: z.iso.date(),
    amount: decimal,
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Enter a three-letter currency code."),
    payment_status: z.enum(paymentStatuses),
    notes: z.string().trim().max(5000).default(""),
  })
  .refine((v) => v.due_date >= v.invoice_date, {
    path: ["due_date"],
    message: "Due Date cannot precede Invoice Date.",
  });
export type Invoice = z.infer<typeof invoiceSchema> & {
  id: string;
  revision: number;
  file_name: string | null;
  file_path: string | null;
};
export const invoiceBase = "/finance/supplier-invoices";
