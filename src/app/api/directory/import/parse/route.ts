import { requestHasSameOrigin } from "@/lib/server/request";
import { NextRequest, NextResponse } from "next/server";
import { authorized } from "@/lib/directory";
import { parseDirectoryFile } from "@/lib/imports/parser";
export async function POST(r: NextRequest) {
  if (!requestHasSameOrigin(r))
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  if (!(await authorized("directory.write")))
    return NextResponse.json(
      { error: "Directory write access required." },
      { status: 403 },
    );
  try {
    const f = await r.formData(),
      file = f.get("file");
    if (!(file instanceof File)) throw Error("Choose a file.");
    if (file.size > 5 * 1024 * 1024) throw Error("Choose a file up to 5 MB.");
    const parsed = await parseDirectoryFile(
      Buffer.from(await file.arrayBuffer()),
      file.name,
      typeof f.get("sheet") === "string" ? String(f.get("sheet")) : undefined,
    );
    return NextResponse.json(parsed, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "The file could not be read." },
      { status: 400 },
    );
  }
}
