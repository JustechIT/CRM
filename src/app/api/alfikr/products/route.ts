import { requestHasSameOrigin } from "@/lib/server/request";
import { NextRequest, NextResponse } from "next/server";
import { authorized } from "@/lib/directory";
import { z } from "zod";
export async function POST(r: NextRequest) {
  if (!requestHasSameOrigin(r))
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const a = await authorized("alfikr-sales.write");
  if (!a)
    return NextResponse.json(
      { error: "Al-Fikr Sales write access required." },
      { status: 403 },
    );
  const p = z
    .object({ name: z.string().trim().min(1).max(200) })
    .safeParse(await r.json());
  if (!p.success)
    return NextResponse.json(
      { error: "Enter a product name." },
      { status: 400 },
    );
  const out = await a.db.rpc("create_alfikr_product", {
    product_name: p.data.name,
  });
  return NextResponse.json(
    out.error
      ? {
          error:
            "Product could not be created. Check for an existing package with this name.",
        }
      : { saved: true },
    { status: out.error ? 400 : 200 },
  );
}
