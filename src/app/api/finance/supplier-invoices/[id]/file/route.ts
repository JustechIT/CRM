import { NextRequest } from "next/server";
import { invoiceFileInfo } from "@/lib/finance/files";
import { invoiceAccess } from "@/lib/finance/access";
import { idSchema, versionSchema } from "@/lib/sales/validation";
import { reply, sameOrigin } from "../../route";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: NextRequest, ctx: Context) {
  const access = await invoiceAccess();
  if (!access) return reply({ error: "Private invoice access required." }, 403);
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success)
    return reply({ error: "Invalid invoice." }, 400);
  const r = await access.db
    .from("supplier_invoices")
    .select("file_path,file_name")
    .eq("id", id)
    .maybeSingle();
  if (r.error) return reply({ error: "File unavailable." }, 503);
  if (!r.data?.file_path) return reply({ error: "File not found." }, 404);
  const download = await access.db.storage
    .from("supplier-invoices")
    .download(r.data.file_path);
  if (download.error || !download.data)
    return reply({ error: "File unavailable." }, 503);
  return new Response(download.data, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(r.data.file_name || "invoice")}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    },
  });
}
export async function POST(request: NextRequest, ctx: Context) {
  if (!sameOrigin(request))
    return reply({ error: "Invalid request origin." }, 403);
  const access = await invoiceAccess(false, true);
  if (!access) return reply({ error: "Private invoice access required." }, 403);
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success)
    return reply({ error: "Invalid invoice." }, 400);
  const form = await request.formData();
  const v = versionSchema.safeParse(form.get("revision"));
  if (!v.success) return reply({ error: "Reopen the latest invoice." }, 400);
  const file = form.get("file");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 10485760 ||
    file.name.length > 250
  )
    return reply({ error: "Choose a PDF, PNG or JPEG file up to 10 MB." }, 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = invoiceFileInfo(bytes, file.name);
  if (!info)
    return reply(
      { error: "Choose a valid PDF, PNG or JPEG file up to 10 MB." },
      400,
    );
  const r = await access.db
    .from("supplier_invoices")
    .select("file_path,revision")
    .eq("id", id)
    .eq("revision", v.data)
    .maybeSingle();
  if (r.error) return reply({ error: "Invoice unavailable." }, 503);
  if (!r.data)
    return reply({ error: "Invoice changed or was removed. Reopen it." }, 409);
  const path = `${id}/${crypto.randomUUID()}`;
  const bucket = access.db.storage.from("supplier-invoices");
  const uploaded = await bucket.upload(path, bytes, {
    contentType: info.mime,
    upsert: false,
  });
  if (uploaded.error)
    return reply(
      {
        error:
          "Private upload failed. Check storage migration and permissions.",
      },
      503,
    );
  const updated = await access.db
    .from("supplier_invoices")
    .update({
      file_path: path,
      file_name: info.filename,
    })
    .eq("id", id)
    .eq("revision", v.data)
    .select("id")
    .maybeSingle();
  if (updated.error || !updated.data) {
    await bucket.remove([path]);
    return reply(
      {
        error:
          "Invoice changed or access was revoked. File was not attached. Reopen it.",
      },
      409,
    );
  }
  if (r.data.file_path) await bucket.remove([r.data.file_path]);
  return reply({ uploaded: true });
}
