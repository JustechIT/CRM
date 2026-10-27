import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
export async function database() {
  if (!isConfigured()) throw new Error("Supabase is not configured.");
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll(values) {
          try {
            values.forEach(({ name, value, options }) =>
              store.set(name, value, options),
            );
          } catch {
            /* Server components cannot set cookies. Actions refresh them. */
          }
        },
      },
    },
  );
}
export async function employee() {
  if (!isConfigured()) return null;
  const db = await database();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) return null;
  const { data: profile } = await db
    .from("employee_profiles")
    .select("id,full_name,status")
    .eq("id", user.id)
    .eq("status", "active")
    .maybeSingle();
  return profile;
}
