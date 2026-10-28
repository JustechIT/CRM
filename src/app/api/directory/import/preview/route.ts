import { requestHasSameOrigin } from "@/lib/server/request";
import { NextRequest, NextResponse } from "next/server";
import { authorized } from "@/lib/directory";
import { batchSchema } from "@/lib/imports/validation";
import { validateImport } from "@/lib/imports/server";
export async function POST(r: NextRequest) {
  if (!requestHasSameOrigin(r))
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const a = await authorized("directory.write");
  if (!a)
    return NextResponse.json(
      { error: "Directory write access required." },
      { status: 403 },
    );
  const p = batchSchema.safeParse(await r.json());
  if (!p.success)
    return NextResponse.json(
      { error: "Check the mapping, defaults and row limits." },
      { status: 400 },
    );
  try {
    return NextResponse.json(
      { rows: await validateImport(a, p.data) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Preview could not be checked. No records were saved." },
      { status: 503 },
    );
  }
}
