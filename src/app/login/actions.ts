"use server";
import { redirect } from "next/navigation";
import { database, employee, isConfigured } from "@/lib/supabase";
import { z } from "zod";
export async function login(_: { error: string }, form: FormData) {
  if (!isConfigured()) return { error: "Connect Supabase before signing in." };
  const input = z
    .object({ email: z.email(), password: z.string().min(1).max(1000) })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Enter a valid email address and password." };
  const db = await database();
  const { error } = await db.auth.signInWithPassword(input.data);
  if (error)
    return {
      error:
        "Sign-in failed. Check your credentials or contact your administrator.",
    };
  if (!(await employee())) {
    await db.auth.signOut();
    return {
      error: "Your employee profile is not active. Contact your administrator.",
    };
  }
  redirect("/");
}
export async function signOut() {
  if (isConfigured()) {
    const db = await database();
    await db.auth.signOut();
  }
  redirect("/login");
}
