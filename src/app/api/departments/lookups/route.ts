import { NextRequest, NextResponse } from "next/server";
import { authorized } from "@/lib/directory";
import { isDepartment } from "@/lib/departments/config";
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams,
    dept = params.get("department"),
    entity = params.get("entity");
  if (!isDepartment(dept))
    return NextResponse.json({ error: "Invalid department." }, { status: 400 });
  const access = await authorized(dept + ".read");
  if (!access)
    return NextResponse.json(
      { error: "Department access required." },
      { status: 401 },
    );
  const allowed: Record<string, string[]> = {
    marketing: ["employees", "products"],
    operations: ["employees", "projects", "accounts", "contacts"],
    training: ["employees", "products", "accounts", "sessions"],
  };
  if (!entity || !allowed[dept].includes(entity))
    return NextResponse.json({ error: "Invalid reference." }, { status: 400 });
  const mapping: Record<string, { table: string; column: string }> = {
    employees: { table: "employee_profiles", column: "full_name" },
    products: { table: "products", column: "name" },
    accounts: { table: "accounts", column: "name" },
    contacts: { table: "department_contact_choices", column: "name" },
    projects: { table: "operations_projects", column: "name" },
    sessions: { table: "training_sessions", column: "name" },
  };
  const { table, column } = mapping[entity];
  const page = Math.min(
    10000,
    Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1),
  );
  const search = (params.get("q") ?? "").trim().slice(0, 100);
  let q = access.db.from(table).select(`id,name:${column}`);
  if (search) q = q.ilike(column, `%${search.replace(/[\\%_]/g, "\\$&")}%`);
  if (entity === "employees") q = q.eq("status", "active");
  if (entity === "sessions")
    q =
      params.get("purpose") === "history"
        ? q.eq("status", "Completed")
        : q.neq("status", "Cancelled");
  const r = await q
    .order(column)
    .order("id")
    .range((page - 1) * 20, page * 20);
  if (r.error)
    return NextResponse.json(
      { error: "Reference choices could not be loaded." },
      { status: 503 },
    );
  return NextResponse.json(
    { items: (r.data ?? []).slice(0, 20), hasMore: (r.data?.length ?? 0) > 20 },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
