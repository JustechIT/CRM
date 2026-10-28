import { requestHasSameOrigin } from "@/lib/server/request";
import { NextRequest, NextResponse } from "next/server";
import { authorized } from "@/lib/directory";
import { batchSchema } from "@/lib/imports/validation";
import { validateImport } from "@/lib/imports/server";
import { z } from "zod";
export async function POST(r: NextRequest) {
  if (!requestHasSameOrigin(r))
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const a = await authorized("directory.write");
  if (!a)
    return NextResponse.json(
      { error: "Directory write access required." },
      { status: 403 },
    );
  const p = batchSchema
    .extend({ request_id: z.uuid(), confirmed: z.literal(true) })
    .safeParse(await r.json());
  if (!p.success)
    return NextResponse.json(
      { error: "Review and confirm a valid batch." },
      { status: 400 },
    );
  try {
    const rows = await validateImport(a, p.data);
    if (rows.some((v) => v.error || !v.data))
      return NextResponse.json(
        { error: "Fix all validation errors before importing." },
        { status: 400 },
      );
    const out = await a.db.rpc("import_directory", {
      entity_value: p.data.entity,
      row_values: rows.map((v) => v.data),
      request_id: p.data.request_id,
    });
    if (out.error)
      throw Error(
        "Import failed. Nothing in this batch was saved. Refresh the preview and check your permissions.",
      );
    return NextResponse.json(out.data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed." },
      { status: 400 },
    );
  }
}
