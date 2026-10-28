import { NextRequest, NextResponse } from "next/server";
import { authorized } from "@/lib/directory";
export async function GET(request: NextRequest) {
  const access = await authorized("sales.read");
  if (!access)
    return NextResponse.json(
      { error: "Sales access required." },
      { status: 401 },
    );
  const params = request.nextUrl.searchParams;
  const entity = params.get("entity");
  if (
    entity !== "accounts" &&
    entity !== "products" &&
    entity !== "subscriptions"
  )
    return NextResponse.json({ error: "Invalid lookup." }, { status: 400 });
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  const page = Math.min(
    10000,
    Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1),
  );
  if (entity === "subscriptions") {
    let query = access.db
      .from("sales_subscriptions_list")
      .select("id,account_name,product_name,start_date,end_date,currency");
    if (q)
      query = query.ilike("search_text", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
    const r = await query
      .order("end_date", { ascending: false })
      .order("id")
      .range((page - 1) * 20, page * 20);
    if (r.error)
      return NextResponse.json(
        { error: "Subscriptions unavailable." },
        { status: 503 },
      );
    return NextResponse.json(
      {
        items: (r.data ?? []).slice(0, 20).map((s) => ({
          id: s.id,
          name: `${s.account_name} · ${s.product_name} · ${s.start_date} – ${s.end_date} · ${s.currency || "Currency not set"}`,
        })),
        hasMore: (r.data?.length ?? 0) > 20,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
  let query = access.db.from(entity).select("id,name");
  if (q) query = query.ilike("name", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  if (
    entity === "products" &&
    (params.get("kind") === "Turnitin" || params.get("kind") === "Other")
  )
    query = query.eq("subscription_kind", params.get("kind"));
  const { data, error } = await query
    .order("name")
    .order("id")
    .range((page - 1) * 20, page * 20);
  if (error)
    return NextResponse.json(
      { error: "The reference list could not be loaded." },
      { status: 503 },
    );
  return NextResponse.json(
    { items: (data ?? []).slice(0, 20), hasMore: (data?.length ?? 0) > 20 },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
