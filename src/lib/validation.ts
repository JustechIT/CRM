import { z } from "zod";
const optionalText = (max = 250) => z.string().trim().max(max).default("");
const email = z.union([z.literal(""), z.email()]).default("");
export const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter an institution name of at least 2 characters.")
    .max(200),
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
export const uuid = z.uuid();
export function queryTerm(value: unknown) {
  return typeof value === "string"
    ? value
        .trim()
        .slice(0, 100)
        .replace(/[%_(),.\\]/g, " ")
    : "";
}
