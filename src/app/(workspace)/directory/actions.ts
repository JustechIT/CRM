"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { accountSchema, contactSchema, uuid } from "@/lib/validation";
import { authorized } from "@/lib/directory";
export type FormState = { error: string };
export async function saveRecord(
  entity: string,
  id: string | null,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  if (entity !== "accounts" && entity !== "contacts")
    return { error: "Invalid record type." };
  if (id && !uuid.safeParse(id).success)
    return { error: "Invalid record identifier." };
  const access = await authorized("directory.write");
  if (!access)
    return { error: "You do not have permission to update the directory." };
  const result = (
    entity === "accounts" ? accountSchema : contactSchema
  ).safeParse(Object.fromEntries(form));
  if (!result.success)
    return {
      error: result.error.issues
        .map((i) => `${i.path.join(" ")}: ${i.message}`)
        .join(" "),
    };
  const values = { ...result.data };
  const response = id
    ? await access.db
        .from(entity)
        .update(values)
        .eq("id", id)
        .select("id")
        .single()
    : await access.db
        .from(entity)
        .insert({ ...values, owner_id: access.profile.id })
        .select("id")
        .single();
  if (response.error)
    return {
      error:
        response.error.code === "23505"
          ? "A record with this unique value already exists. Review the existing record."
          : "The record could not be saved. Check your permissions and related institution, then try again.",
    };
  revalidatePath("/directory");
  redirect(`/directory/${entity}/${response.data.id}?saved=1`);
}
export async function deleteRecord(
  entity: string,
  id: string,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  if (
    (entity !== "accounts" && entity !== "contacts") ||
    !uuid.safeParse(id).success
  )
    return { error: "Invalid record." };
  if (form.get("confirmation") !== "DELETE")
    return { error: "Type DELETE to confirm this permanent action." };
  const access = await authorized("directory.delete");
  if (!access)
    return { error: "You do not have permission to delete directory records." };
  const { data, error } = await access.db
    .from(entity)
    .delete()
    .eq("id", id)
    .select("id");
  if (error || !data?.length)
    return {
      error:
        "Deletion failed. Accounts with contacts must have their contacts removed or reassigned first.",
    };
  revalidatePath("/directory");
  redirect(`/directory?type=${entity}`);
}
