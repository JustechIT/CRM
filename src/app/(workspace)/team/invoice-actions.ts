"use server";
import { revalidatePath } from "next/cache";
import { superAdmin } from "@/lib/team/access";
import { idSchema } from "@/lib/sales/validation";
export async function changeInvoiceAccess(
  _: { error: string },
  form: FormData,
) {
  const access = await superAdmin();
  if (!access)
    return {
      error:
        "Only your designated invoice access manager can change permissions.",
    };
  const id = idSchema.safeParse(form.get("user_id"));
  if (!id.success) return { error: "Select an employee." };
  const r = await access.db.rpc("set_supplier_invoice_access", {
    target: id.data,
    allowed: form.get("allowed") === "true",
  });
  if (r.error)
    return {
      error:
        "Access could not be changed. Select an active employee; you cannot revoke your own access.",
    };
  revalidatePath("/team");
  revalidatePath("/", "layout");
  return { error: "Access updated." };
}
