import { publicOrigin } from "@/lib/server/request";
import { NextRequest, NextResponse } from "next/server";
import { database, isConfigured } from "@/lib/supabase";
export async function GET(request: NextRequest) {
  if (!isConfigured())
    return NextResponse.redirect(
      new URL("/login?error=setup", publicOrigin(request)),
    );
  const db = await database();
  const p = request.nextUrl.searchParams;
  const code = p.get("code"),
    hash = p.get("token_hash");
  let ok = false;
  if (!code && !hash)
    return NextResponse.redirect(new URL("/invite", publicOrigin(request)));
  if (code) {
    const r = await db.auth.exchangeCodeForSession(code);
    ok = !r.error;
  } else if (
    hash &&
    (p.get("type") === "invite" || p.get("type") === "recovery")
  ) {
    const r = await db.auth.verifyOtp({
      token_hash: hash,
      type: p.get("type") as "invite" | "recovery",
    });
    ok = !r.error;
  }
  let destination = "/invite";
  if (ok) {
    const user = await db.auth.getUser();
    if (user.data.user) {
      const profile = await db
        .from("employee_profiles")
        .select("id")
        .eq("id", user.data.user.id)
        .eq("status", "active")
        .maybeSingle();
      if (!profile.error && profile.data) destination = "/reset-password";
    }
  }
  return NextResponse.redirect(
    new URL(
      ok
        ? destination
        : p.get("type") === "recovery"
          ? "/reset-password?error=link"
          : "/invite?error=link",
      publicOrigin(request),
    ),
  );
}
