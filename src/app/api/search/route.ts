import { NextRequest, NextResponse } from "next/server";
import { database, employee, isConfigured } from "@/lib/supabase";
import { queryTerm } from "@/lib/validation";
export async function GET(req: NextRequest) {
  if (!isConfigured() || !(await employee()))
    return NextResponse.json(
      { error: "Employee access required" },
      { status: 401 },
    );
  const term = queryTerm(req.nextUrl.searchParams.get("q"));
  if (term.length < 2) return NextResponse.json({ results: [] });
  const db = await database();
  const [accounts, contacts] = await Promise.all([
    db
      .from("accounts")
      .select("id,name")
      .ilike("name", `%${term}%`)
      .order("name")
      .limit(8),
    db
      .from("directory_contacts_list")
      .select("id,display_name")
      .ilike("display_name", `%${term}%`)
      .order("last_name")
      .limit(8),
  ]);
  if (accounts.error || contacts.error)
    return NextResponse.json({ error: "Search unavailable" }, { status: 503 });
  return NextResponse.json(
    {
      results: [
        ...(accounts.data ?? []).map((a) => ({
          id: a.id,
          label: a.name,
          type: "accounts",
        })),
        ...(contacts.data ?? []).map((c) => ({
          id: c.id,
          label: c.display_name,
          type: "contacts",
        })),
      ],
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
