"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authorized } from "@/lib/directory";
import {
  getSection,
  isModuleScope,
  modulePath,
} from "@/lib/departments/config";
import { id as uuid, revision, validate } from "@/lib/departments/validation";
export type State = { error: string; fields?: Record<string, string> };
function fail(error: string, form: FormData): State {
  return {
    error,
    fields: Object.fromEntries(
      [...form.entries()].filter(
        (e): e is [string, string] =>
          typeof e[1] === "string" && !e[0].startsWith("$ACTION_"),
      ),
    ),
  };
}
export async function saveDepartment(
  dept: string,
  slug: string,
  recordId: string | null,
  _: State,
  form: FormData,
): Promise<State> {
  if (!isModuleScope(dept)) return fail("Invalid department.", form);
  const section = getSection(dept, slug);
  if (!section || (recordId && !uuid.safeParse(recordId).success))
    return fail("Invalid record.", form);
  const access = await authorized(dept + ".write");
  if (!access)
    return fail(
      "Employee access with department write permission is required. No record was saved.",
      form,
    );
  const result = validate(section, Object.fromEntries(form));
  if (!result.success)
    return fail(
      result.error.issues
        .map(
          (i) =>
            `${section.fields.find((f) => f.key === i.path[0] || (f.type === "project" && ["project_id", "area"].includes(String(i.path[0]))) || (f.type === "party" && ["party_id", "party_type"].includes(String(i.path[0]))))?.label ?? String(i.path[0])}: ${i.message}`,
        )
        .join(" "),
      form,
    );
  const data = result.data;
  // Link registrations to an existing contact by institution/email; never create or overwrite contacts.
  if (section.slug === "registrations") {
    const r = await access.db
      .from("contacts")
      .select("id")
      .eq("account_id", data.account_id)
      .ilike("email", String(data.email).replace(/[\\%_]/g, "\\$&"))
      .maybeSingle();
    if (r.error)
      return fail(
        "The participant's institution/contact could not be verified. Try again.",
        form,
      );
    data.contact_id = r.data?.id ?? null;
  }
  let response;
  if (recordId) {
    const v = revision.safeParse(form.get("revision"));
    if (!v.success) return fail("Reopen this record before editing.", form);
    let q = access.db
      .from(section.table)
      .update(data)
      .eq("id", recordId)
      .eq("revision", v.data);
    if (section.scope)
      q = q.eq(section.scopeField ?? "department", section.scope);
    response = await q.select("id").maybeSingle();
  } else
    response = await access.db
      .from(section.table)
      .insert({
        ...data,
        owner_id: access.profile.id,
        ...(section.scope
          ? { [section.scopeField ?? "department"]: section.scope }
          : {}),
      })
      .select("id")
      .single();
  if (response.error) {
    const code = response.error.code;
    return fail(
      code === "23505"
        ? section.slug === "caution"
          ? "This LCID already exists. Open the existing Caution record instead."
          : "This participant/session or history entry already exists. Open the existing record instead."
        : code === "23503"
          ? "A linked record is no longer available. Select an existing record and try again."
          : code === "23514"
            ? dept === "training"
              ? "Check the institution, active trainer and session. History requires a completed session; cancelled sessions cannot accept new registrations."
              : dept === "operations"
                ? "Check the dates and active employee assignments. Choose one project or area, and one existing contact or organization."
                : "Check the dates, link and employee/product choices. Employees must be active."
            : "The record could not be saved. Check your connection and department permissions.",
      form,
    );
  }
  if (!response.data)
    return fail(
      "This record was changed or removed by someone else. Your work was not overwritten. Reopen the latest version.",
      form,
    );
  revalidatePath(modulePath(dept, slug));
  revalidatePath(modulePath(dept));
  redirect(
    modulePath(dept, slug, {
      record: response.data.id,
      saved: "1",
      ...(slug === "issues" && typeof data.project_id === "string"
        ? { project: data.project_id }
        : {}),
    }),
  );
}
export async function deleteDepartment(
  dept: string,
  slug: string,
  recordId: string,
  _: State,
  form: FormData,
): Promise<State> {
  if (!isModuleScope(dept) || !uuid.safeParse(recordId).success)
    return { error: "Invalid record." };
  const section = getSection(dept, slug);
  if (!section) return { error: "Invalid section." };
  if (form.get("confirmation") !== "DELETE")
    return { error: "Type DELETE to confirm this permanent action." };
  const v = revision.safeParse(form.get("revision"));
  if (!v.success) return { error: "Reopen the latest record before deleting." };
  const access = await authorized(dept + ".delete");
  if (!access)
    return { error: "Administrator department delete permission is required." };
  let q = access.db
    .from(section.table)
    .delete()
    .eq("id", recordId)
    .eq("revision", v.data);
  if (section.scope)
    q = q.eq(section.scopeField ?? "department", section.scope);
  const r = await q
    .select(slug === "issues" ? "id,project_id" : "id")
    .maybeSingle();
  if (r.error)
    return {
      error:
        "This record could not be deleted. Linked tasks, checks, registrations or history must be removed or reassigned first.",
    };
  if (!r.data)
    return {
      error:
        "This record changed or was removed. Reopen the latest version before deleting.",
    };
  revalidatePath(modulePath(dept, slug));
  revalidatePath(modulePath(dept));
  if (slug === "issues")
    redirect(
      modulePath("platform", "projects", {
        record: (r.data as unknown as { project_id: string }).project_id,
      }),
    );
  redirect(modulePath(dept, slug));
}
