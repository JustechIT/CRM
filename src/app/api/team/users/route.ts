import { NextRequest, NextResponse } from "next/server";
import { superAdmin } from "@/lib/team/access";
import { userSchema } from "@/lib/team/config";
export async function PATCH(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const access = await superAdmin();
  if (!access)
    return NextResponse.json(
      { error: "Verified Super Admin required." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  const parsed = userSchema.safeParse(await request.json());
  if (!parsed.success || !parsed.data.id)
    return NextResponse.json(
      { error: "Check the user details and module permissions." },
      { status: 400 },
    );
  const u = parsed.data;
  const r = await access.db.rpc("team_update_user", {
    target: u.id,
    person_name: u.full_name,
    department_value: u.department,
    role_value: u.role,
    active: u.active,
    module_values: u.modules,
    private_invoices: u.supplier_access,
    remove_user: u.remove,
  });
  if (r.error)
    return NextResponse.json(
      {
        error:
          "The user could not be updated. The Super Admin is protected; check department, role and permissions.",
      },
      { status: 400 },
    );
  return NextResponse.json(
    { saved: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function GET() {
  const a = await superAdmin();
  if (!a)
    return NextResponse.json(
      { error: "Verified Super Admin required." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  const r = await a.db.rpc("team_users");
  return NextResponse.json(
    r.error ? { error: "Users unavailable." } : { users: r.data },
    {
      status: r.error ? 503 : 200,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
