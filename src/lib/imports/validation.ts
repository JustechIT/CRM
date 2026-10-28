import { accountSchema, contactSchema } from "@/lib/validation";
import { z } from "zod";
export const importFields = {
  accounts: [
    ["name", "Institution Name"],
    ["institution_type", "Institution Type"],
    ["country", "Country"],
    ["city", "City"],
    ["website", "Website"],
    ["email", "Email"],
    ["phone", "Phone"],
    ["status", "Status"],
    ["business", "Business"],
    ["notes", "Notes"],
  ],
  contacts: [
    ["first_name", "First Name"],
    ["last_name", "Last Name"],
    ["institution", "Institution name or ID"],
    ["job_title", "Job Title"],
    ["department", "Department"],
    ["email", "Email"],
    ["phone", "Phone"],
    ["notes", "Notes"],
  ],
} as const;
export const mappingSchema = z.record(
  z.string(),
  z.number().int().min(-1).max(39),
);
export const batchSchema = z.object({
  entity: z.enum(["accounts", "contacts"]),
  rows: z
    .array(z.array(z.string().max(10000)).max(40))
    .min(1)
    .max(500),
  mapping: mappingSchema,
  defaults: z.object({
    institution_type: z.enum([
      "University",
      "Faculty",
      "Research institution",
      "Library",
      "Other",
    ]),
    status: z.enum(["Prospect", "Active", "Inactive"]),
    business: z.enum(["Justech", "Al-Fikr", "Both"]),
  }),
});
export type Batch = z.infer<typeof batchSchema>;
export function mappedRows(batch: Batch) {
  return batch.rows.map((row, index) => {
    const data: Record<string, string> = {};
    for (const [key] of importFields[batch.entity]) {
      const col = batch.mapping[key];
      data[key] = typeof col === "number" && col >= 0 ? (row[col] ?? "") : "";
    }
    if (batch.entity === "accounts") {
      for (const [key, v] of Object.entries(batch.defaults))
        if (!data[key]) data[key] = v;
      const r = accountSchema.safeParse(data);
      return {
        row: index + 2,
        data: r.success ? r.data : null,
        institution: "",
        error: r.success
          ? ""
          : r.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join(" "),
      };
    }
    const institution = data.institution;
    delete data.institution;
    const r = contactSchema.omit({ account_id: true }).safeParse(data);
    return {
      row: index + 2,
      data: r.success ? r.data : null,
      institution,
      error: !institution
        ? "Choose an institution column."
        : r.success
          ? ""
          : r.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join(" "),
    };
  });
}
export function duplicateKey(
  entity: "accounts" | "contacts",
  record: Record<string, unknown>,
) {
  const keys =
    entity === "accounts"
      ? ["name", "country", "city"]
      : record.email
        ? ["account_id", "email"]
        : ["account_id", "first_name", "last_name"];
  return keys
    .map((k) =>
      String(record[k] ?? "")
        .trim()
        .toLowerCase(),
    )
    .join("\u001f");
}
