import { superAdmin } from "@/lib/team/access";
import { requestHasSameOrigin } from "@/lib/server/request";
import { NextRequest, NextResponse } from "next/server";
import { database, employee } from "@/lib/supabase";
import { z } from "zod";
export async function PATCH(req: NextRequest) {
  if (!requestHasSameOrigin(req))
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  if (!(await employee()))
    return NextResponse.json(
      { error: "Employee access required." },
      { status: 401 },
    );
  if (!(await superAdmin()))
    return NextResponse.json(
      { error: "Only the Super Admin can update user information." },
      { status: 403 },
    );
  const parsed = z
    .object({ full_name: z.string().trim().min(1).max(200) })
    .safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: "Enter your full name." },
      { status: 400 },
    );
  const db = await database(),
    r = await db.rpc("update_my_profile", {
      person_name: parsed.data.full_name,
    });
  return NextResponse.json(
    r.error ? { error: "Profile could not be saved." } : { saved: true },
    { status: r.error ? 503 : 200 },
  );
}
export async function POST(req: NextRequest) {
  if (!requestHasSameOrigin(req))
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  if (!(await employee()))
    return NextResponse.json(
      { error: "Employee access required." },
      { status: 401 },
    );
  const parsed = z
    .object({
      current: z.string().min(1).max(1000),
      password: z.string().min(12).max(1000),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm)
    .safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: "Use at least 12 characters and matching new passwords." },
      { status: 400 },
    );
  const db = await database(),
    u = await db.auth.getUser();
  if (!u.data.user?.email)
    return NextResponse.json(
      { error: "Reauthentication required." },
      { status: 401 },
    );
  const sign = await db.auth.signInWithPassword({
    email: u.data.user.email,
    password: parsed.data.current,
  });
  if (sign.error)
    return NextResponse.json(
      { error: "Current password is incorrect. No password was changed." },
      { status: 400 },
    );
  if (sign.data.user?.id !== u.data.user.id) {
    await db.auth.signOut();
    return NextResponse.json(
      {
        error:
          "The signed-in account changed. Sign in again; no password was changed.",
      },
      { status: 401 },
    );
  }
  const r = await db.auth.updateUser({ password: parsed.data.password });
  return NextResponse.json(
    r.error
      ? {
          error:
            "Password change failed. Check your account security requirements.",
        }
      : { saved: true },
    { status: r.error ? 400 : 200 },
  );
}
