import { z } from "zod";
const optionalText = (max = 250) => z.string().trim().max(max).default("");
const email = z.union([z.literal(""), z.email()]).default("");
export const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter an organization name.")
    .max(250),
  institution_type: z.enum([
    "University",
    "Faculty",
    "Research institution",
    "Library",
    "Other",
  ]),
  country: optionalText(100),
  city: optionalText(100),
  website: z
    .union([
      z.literal(""),
      z.url().refine((v) => /^https?:/.test(v), "Use an HTTP or HTTPS URL."),
    ])
    .default(""),
  email,
  phone: optionalText(60),
  status: z.enum(["Prospect", "Active", "Inactive"]),
  business: z.enum(["Justech", "Al-Fikr", "Both"]),
  notes: optionalText(5000),
});
export const contactSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  job_title: optionalText(),
  department: optionalText(),
  email,
  phone: optionalText(60),
  account_id: z.uuid(),
  notes: optionalText(5000),
});
export const accountDirectorySchema = accountSchema.extend({ address: optionalText() });
export const contactDirectorySchema = contactSchema.omit({ account_id: true }).extend({
  first_name: z.string().trim().min(1).max(200),
  last_name: optionalText(200),
  address: optionalText(),
  organization: optionalText(),
});
export const uuid = z.uuid();
export function queryTerm(value: unknown) {
  return typeof value === "string"
    ? value
        .trim()
        .slice(0, 100)
        .replace(/[%_(),.\\]/g, " ")
    : "";
}
