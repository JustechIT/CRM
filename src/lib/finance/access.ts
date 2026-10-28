import "server-only";
import { database, employee, isConfigured } from "@/lib/supabase";
export async function invoiceAccess(manage = false) {
  if (!isConfigured()) return null;
  const profile = await employee();
  if (!profile) return null;
  const db = await database();
  const r = await db.rpc("supplier_invoice_allowed", { manage });
  if (r.error || r.data !== true) return null;
  return { db, profile };
}
