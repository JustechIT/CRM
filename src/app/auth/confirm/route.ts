import { NextRequest, NextResponse } from "next/server";
import { database, isConfigured } from "@/lib/supabase";
export async function GET(request: NextRequest) {
  if (!isConfigured())
    return NextResponse.redirect(new URL("/login?error=setup", request.url));
  const db = await database();
  const p = request.nextUrl.searchParams;
  const code = p.get("code"),
    hash = p.get("token_hash");
  let ok = false;
  if (!code && !hash)
    return NextResponse.redirect(new URL("/invite", request.url));
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
  return NextResponse.redirect(
    new URL(ok ? "/invite" : "/invite?error=link", request.url),
  );
}
