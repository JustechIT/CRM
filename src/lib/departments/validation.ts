import { z } from "zod";
import type { Section } from "./types";
export const id = z.uuid("Choose an existing record from the list.");
export const revision = z.coerce.number().int().min(1).max(2147483647);
export function validate(section: Section, input: unknown) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of section.fields) {
    let schema: z.ZodType;
    if (f.type === "project" || f.type === "party") continue;
    if (f.type === "reference") schema = id;
    else if (f.type === "date") schema = z.iso.date();
    else if (f.type === "money")
      schema = z
        .string()
        .trim()
        .regex(
          /^\d{1,12}(\.\d{1,3})?$/,
          "Enter a non-negative numeric amount.",
        );
    else if (f.type === "integer")
      schema = z
        .string()
        .regex(/^\d+$/, "Enter a whole number of participants.")
        .transform(Number)
        .pipe(z.number().int().min(0).max(2147483647));
    else if (f.type === "select")
      schema = z.enum(f.options as [string, ...string[]]);
    else if (f.type === "email")
      schema = z.string().trim().toLowerCase().max(254).pipe(z.email());
    else if (f.type === "url")
      schema = z
        .string()
        .trim()
        .max(2048)
        .pipe(z.url())
        .refine((v) => /^https?:\/\//i.test(v), "Use an HTTP or HTTPS link.");
    else
      schema = z
        .string()
        .trim()
        .min(f.required ? 1 : 0, "This field is required.")
        .max(f.max ?? (f.type === "textarea" ? 5000 : 250));
    shape[f.key] = f.required
      ? schema
      : z
          .union([z.literal(""), schema])
          .transform((v) => (v === "" ? null : v))
          .optional();
  }
  if (section.fields.some((f) => f.type === "project")) {
    shape.project_id = z.union([z.literal(""), id]).transform((v) => v || null);
    shape.area = z.string().trim().max(200).default("");
  }
  if (section.fields.some((f) => f.type === "party")) {
    shape.party_type = z.enum(["accounts", "contacts"]);
    shape.party_id = id;
  }
  return z
    .object(shape)
    .superRefine((v, ctx) => {
      if (
        section.slug === "campaigns" &&
        String(v.end_date) < String(v.start_date)
      )
        ctx.addIssue({
          code: "custom",
          path: ["end_date"],
          message: "End Date cannot precede Start Date.",
        });
      if (
        section.fields.some((f) => f.type === "project") &&
        !v.project_id === !v.area
      )
        ctx.addIssue({
          code: "custom",
          path: ["project_id"],
          message: "Choose a project or enter an area, using one option only.",
        });
      if (
        section.slug === "follow-ups" &&
        v.last_contact &&
        String(v.follow_up_date) < String(v.last_contact)
      )
        ctx.addIssue({
          code: "custom",
          path: ["follow_up_date"],
          message: "Follow-up Date cannot precede Last Contact.",
        });
    })
    .transform((v) => {
      const result: Record<string, unknown> = { ...v };
      if (section.slug === "tasks" && typeof result.due_at === "string")
        result.due_at += "T00:00:00Z";
      if (section.fields.some((f) => f.type === "party")) {
        result.account_id = v.party_type === "accounts" ? v.party_id : null;
        result.contact_id = v.party_type === "contacts" ? v.party_id : null;
        delete result.party_type;
        delete result.party_id;
      }
      return result;
    })
    .safeParse(input);
}
