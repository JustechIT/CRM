import { NextRequest, NextResponse } from "next/server";
import { invoiceAccess } from "@/lib/finance/access";
import { invoiceSchema } from "@/lib/finance/config";
import { idSchema, versionSchema } from "@/lib/sales/validation";
const headers = { "Cache-Control": "private, no-store" };
export function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers });
}
export function sameOrigin(request: NextRequest) {
  return request.headers.get("origin") === request.nextUrl.origin;
}
export async function GET(request: NextRequest) {
  const access = await invoiceAccess();
  if (!access) return reply({ error: "Private invoice access required." }, 403);
  const id = request.nextUrl.searchParams.get("id");
  if (!idSchema.safeParse(id).success)
    return reply({ error: "Invalid invoice." }, 400);
  const r = await access.db
    .from("supplier_invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return r.error
    ? reply({ error: "Invoice unavailable." }, 503)
    : r.data
      ? reply(r.data)
      : reply({ error: "Invoice not found." }, 404);
}
async function save(request: NextRequest, editing: boolean) {
  if (!sameOrigin(request))
    return reply({ error: "Invalid request origin." }, 403);
  const access = await invoiceAccess(false, true);
  if (!access) return reply({ error: "Private invoice access required." }, 403);
  const form = await request.formData();
  const parsed = invoiceSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return reply(
      {
        error: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(" "),
      },
      400,
    );
  let r;
  if (editing) {
    const id = idSchema.safeParse(form.get("id")),
      v = versionSchema.safeParse(form.get("revision"));
    if (!id.success || !v.success)
      return reply({ error: "Reopen the latest invoice." }, 400);
    r = await access.db
      .from("supplier_invoices")
      .update(parsed.data)
      .eq("id", id.data)
      .eq("revision", v.data)
      .select("id")
      .maybeSingle();
  } else
    r = await access.db
      .from("supplier_invoices")
      .insert({ ...parsed.data, owner_id: access.profile.id })
      .select("id")
      .single();
  if (r.error)
    return reply(
      {
        error: "Invoice could not be saved. Check your connection and access.",
      },
      503,
    );
  return r.data
    ? reply(r.data)
    : reply(
        { error: "Invoice changed or was removed. Reopen before saving." },
        409,
      );
}
export async function POST(r: NextRequest) {
  return save(r, false);
}
export async function PATCH(r: NextRequest) {
  return save(r, true);
}
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request))
    return reply({ error: "Invalid request origin." }, 403);
  const access = await invoiceAccess(false, true);
  if (!access) return reply({ error: "Private invoice access required." }, 403);
  const data = await request.json();
  const id = idSchema.safeParse(data.id),
    v = versionSchema.safeParse(data.revision);
  if (!id.success || !v.success)
    return reply({ error: "Invalid invoice." }, 400);
  // RLS and optimistic version apply to the deletion, not just a preceding read.
  const r = await access.db
    .from("supplier_invoices")
    .delete()
    .eq("id", id.data)
    .eq("revision", v.data)
    .select("file_path")
    .maybeSingle();
  if (r.error) return reply({ error: "Deletion failed." }, 503);
  if (!r.data)
    return reply({ error: "Invoice changed or was removed. Reopen it." }, 409);
  if (r.data.file_path)
    await access.db.storage
      .from("supplier-invoices")
      .remove([r.data.file_path]);
  return reply({ deleted: true });
}
