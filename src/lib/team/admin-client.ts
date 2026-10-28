import "server-only";
import { createClient } from "@supabase/supabase-js";
// Never import this module into a client component. Every caller must verify Super Admin first.
export function authAdministrator() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
