import { requestHasSameOrigin, publicOrigin } from "@/lib/server/request";
import { NextRequest, NextResponse } from "next/server";
import { superAdmin } from "@/lib/team/access";
import { authAdministrator } from "@/lib/team/admin-client";
import { userSchema } from "@/lib/team/config";
import { deliverInvitation } from "@/lib/team/delivery";
import { idSchema } from "@/lib/sales/validation";
export async function POST(request: NextRequest) {
  if (!requestHasSameOrigin(request))
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const access = await superAdmin();
  if (!access)
    return NextResponse.json(
      { error: "Verified Super Admin required." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  const admin = authAdministrator();
  if (!admin)
    return NextResponse.json(
      {
        error:
          "Invitations need the server-only SUPABASE_SECRET_KEY. Ask your database operator to configure it in .env.local; never use a NEXT_PUBLIC variable.",
      },
      { status: 503 },
    );
  const parsed = userSchema.safeParse(await request.json());
  if (!parsed.success || !parsed.data.email)
    return NextResponse.json(
      { error: "Enter a valid email, name, department, role and permissions." },
      { status: 400 },
    );
  const u = parsed.data;
  const reservation = await access.db.rpc("team_create_invitation", {
    person_email: u.email,
    person_name: u.full_name,
    department_value: u.department,
    role_value: u.role,
    module_values: u.modules,
    private_invoices: u.supplier_access,
  });
  if (reservation.error || !reservation.data)
    return NextResponse.json(
      {
        error:
          "An employee or pending invitation already exists, or the permissions are invalid. Edit the existing entry.",
      },
      { status: 400 },
    );
  const delivery = await deliverInvitation({
    invite: async () => {
      const r = await admin.auth.admin.inviteUserByEmail(parsed.data.email!, {
        redirectTo: `${publicOrigin(request)}/auth/confirm`,
      });
      return r.error;
    },
    recover: async () => {
      const r = await admin.auth.resetPasswordForEmail(parsed.data.email!, {
        redirectTo: `${publicOrigin(request)}/auth/confirm`,
      });
      return r.error;
    },
    record: async (sent, code) => {
      const r = await access.db.rpc("record_invitation_delivery", {
        invitation: reservation.data,
        sent,
        error_code: code,
      });
      if (r.error) {
        if (!sent)
          await access.db.rpc("team_cancel_invitation", {
            invitation: reservation.data,
          });
        throw Error("Delivery tracking unavailable.");
      }
    },
  });
  if (!delivery.sent)
    return NextResponse.json(
      {
        error:
          "The invitation could not be sent. Check Supabase email delivery and redirect settings.",
      },
      { status: 503 },
    );
  return NextResponse.json(
    {
      sent: true,
      ...(!delivery.tracked
        ? {
            warning:
              "The email service accepted the invitation, but delivery tracking is unavailable.",
          }
        : {}),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function DELETE(request: NextRequest) {
  if (!requestHasSameOrigin(request))
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const a = await superAdmin();
  if (!a)
    return NextResponse.json(
      { error: "Verified Super Admin required." },
      { status: 403 },
    );
  const input = await request.json();
  if (!idSchema.safeParse(input.id).success)
    return NextResponse.json({ error: "Invalid invitation." }, { status: 400 });
  const r = await a.db.rpc("team_cancel_invitation", { invitation: input.id });
  return NextResponse.json(
    r.error ? { error: "Cancellation failed." } : { cancelled: true },
    { status: r.error ? 400 : 200 },
  );
}
