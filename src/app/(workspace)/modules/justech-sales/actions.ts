"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authorized } from "@/lib/directory";
import {
  isSalesSection,
  salesDefinitions,
  salesPath,
  salesBase,
  type SubscriptionKind,
} from "@/lib/sales/config";
import {
  idSchema,
  validateSales,
  versionSchema,
  productSchema,
} from "@/lib/sales/validation";
export type SalesFormState = { error: string; fields?: Record<string, string> };
function failure(message: string, form: FormData): SalesFormState {
  return {
    error: message,
    fields: Object.fromEntries(
      [...form.entries()].filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === "string" && !entry[0].startsWith("$ACTION_"),
      ),
    ),
  };
}
function databaseError(code?: string) {
  if (code === "23505")
    return "This identifier or customer/product period already exists. Open the existing record instead of creating a duplicate.";
  if (code === "23503")
    return "A linked institution or product is no longer available. Refresh and select an existing record.";
  if (code === "23514")
    return "Check the dates and product category. A product with existing subscriptions cannot be moved to another category.";
  return "The record could not be saved. Check your permissions and connection, then try again.";
}
function refreshSales() {
  revalidatePath(`${salesBase}/overview`);
  for (const section of Object.keys(salesDefinitions))
    revalidatePath(`${salesBase}/${section}`);
}
export async function saveSales(
  sectionInput: string,
  id: string | null,
  _: SalesFormState,
  form: FormData,
): Promise<SalesFormState> {
  if (!isSalesSection(sectionInput) || (id && !idSchema.safeParse(id).success))
    return failure("Invalid Sales record.", form);
  const section = sectionInput;
  const access = await authorized("sales.write");
  if (!access)
    return failure(
      "Employee access with Sales write permission is required. No record was saved.",
      form,
    );
  const result = validateSales(section, Object.fromEntries(form));
  if (!result.success)
    return failure(
      result.error.issues
        .map(
          (i) =>
            `${salesDefinitions[section].fields.find((f) => f.key === i.path[0])?.label ?? String(i.path[0])}: ${i.message}`,
        )
        .join(" "),
      form,
    );
  const values = result.data;
  const request = access.db.from(salesDefinitions[section].table);
  let response;
  if (id) {
    const revision = versionSchema.safeParse(form.get("revision"));
    if (!revision.success)
      return failure(
        "The record version is missing. Reopen the record before editing.",
        form,
      );
    response = await request
      .update(values)
      .eq("id", id)
      .eq("revision", revision.data)
      .select("id,revision")
      .maybeSingle();
  } else
    response = await request
      .insert({ ...values, owner_id: access.profile.id })
      .select("id,revision")
      .single();
  if (response.error) return failure(databaseError(response.error.code), form);
  if (!response.data)
    return failure(
      "Someone changed or removed this record while you were editing. Your changes were not overwritten. Reopen the latest record and try again.",
      form,
    );
  refreshSales();
  const kind =
    section === "subscriptions"
      ? (values as { kind: SubscriptionKind }).kind
      : undefined;
  const params = new URLSearchParams({ record: response.data.id, saved: "1" });
  if (kind) params.set("kind", kind);
  redirect(`${salesBase}/${section}?${params}`);
}
export async function deleteSales(
  sectionInput: string,
  id: string,
  _: SalesFormState,
  form: FormData,
): Promise<SalesFormState> {
  if (!isSalesSection(sectionInput) || !idSchema.safeParse(id).success)
    return { error: "Invalid Sales record." };
  if (form.get("confirmation") !== "DELETE")
    return { error: "Type DELETE to confirm this permanent action." };
  const revision = versionSchema.safeParse(form.get("revision"));
  if (!revision.success)
    return { error: "Reopen the latest record before deleting." };
  const access = await authorized("sales.delete");
  if (!access)
    return { error: "Administrator Sales delete permission is required." };
  const { data, error } = await access.db
    .from(salesDefinitions[sectionInput].table)
    .delete()
    .eq("id", id)
    .eq("revision", revision.data)
    .select("id")
    .maybeSingle();
  if (error)
    return {
      error: "Deletion failed. Check your connection and linked records.",
    };
  if (!data)
    return {
      error:
        "This record changed or was removed. Reopen the latest version before deleting.",
    };
  refreshSales();
  redirect(
    salesPath(
      sectionInput,
      form.get("kind") === "Other" ? "Other" : "Turnitin",
    ),
  );
}
export async function saveProduct(
  id: string | null,
  _: SalesFormState,
  form: FormData,
): Promise<SalesFormState> {
  if (id && !idSchema.safeParse(id).success)
    return failure("Invalid product.", form);
  const access = await authorized("sales.write");
  if (!access)
    return failure(
      "Sales write permission is required to manage products.",
      form,
    );
  const result = productSchema.safeParse(Object.fromEntries(form));
  if (!result.success)
    return failure(result.error.issues.map((i) => i.message).join(" "), form);
  let response;
  if (id) {
    const revision = versionSchema.safeParse(form.get("revision"));
    if (!revision.success)
      return failure("Reopen the latest product before editing.", form);
    response = await access.db
      .from("products")
      .update(result.data)
      .eq("id", id)
      .eq("revision", revision.data)
      .select("id")
      .maybeSingle();
  } else
    response = await access.db
      .from("products")
      .insert({ ...result.data, owner_id: access.profile.id })
      .select("id")
      .single();
  if (response.error) return failure(databaseError(response.error.code), form);
  if (!response.data)
    return failure(
      "This product changed while you were editing. Reopen it before saving.",
      form,
    );
  refreshSales();
  redirect(`${salesBase}/subscriptions?catalog=1&saved=1`);
}
