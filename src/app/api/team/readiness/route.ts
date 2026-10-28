import { NextResponse } from "next/server";
import { superAdmin } from "@/lib/team/access";
import { authAdministrator } from "@/lib/team/admin-client";
export async function GET() {
  const a = await superAdmin();
  if (!a)
    return NextResponse.json(
      { error: "Verified Super Admin required." },
      { status: 403 },
    );
  const key = process.env.SUPABASE_SECRET_KEY;
  const admin =
    key && !key.startsWith("sb_publishable_") ? authAdministrator() : null;
  let valid = false;
  if (admin) {
    const r = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    valid = !r.error;
  }
  return NextResponse.json(
    {
      key_set: !!key,
      key_valid: valid,
      email_delivery:
        "Send an invitation and confirm receipt to verify delivery.",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
