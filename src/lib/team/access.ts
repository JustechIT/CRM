import "server-only";
import { database, employee, isConfigured } from "@/lib/supabase";
export async function superAdmin() {
  if (!isConfigured()) return null;
  const profile = await employee();
  if (!profile) return null;
  const db = await database();
  const r = await db.rpc("is_super_admin");
  return !r.error && r.data === true ? { db, profile } : null;
}
