"use server";
import { database, isConfigured } from "@/lib/supabase";
import { redirect } from "next/navigation";
export async function acceptInvitation(_: { error: string }, form: FormData) {
  if (!isConfigured()) return { error: "The database is not connected." };
  const password = form.get("password");
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password !== form.get("confirm")
  )
    return {
      error: "Use at least 12 characters and make both passwords match.",
    };
  const db = await database();
  const u = await db.auth.getUser();
  if (!u.data.user || u.error)
    return {
      error: "Open the invitation email link again to verify your account.",
    };
  const changed = await db.auth.updateUser({ password });
  if (changed.error)
    return {
      error:
        "Password could not be set. Try a stronger password or request a new invitation.",
    };
  const r = await db.rpc("accept_crm_invitation");
  if (r.error)
    return {
      error:
        "No valid pending invitation was found for your verified account. Ask the Super Admin for help.",
    };
  redirect("/");
}
