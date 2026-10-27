import "server-only";
import { database, employee } from "./supabase";
export type Entity = "accounts" | "contacts";
export async function authorized(permission: string) {
  const profile = await employee();
  if (!profile) return null;
  const db = await database();
  const { data, error } = await db.rpc("has_permission", {
    requested: permission,
  });
  return !error && data === true ? { profile, db } : null;
}
export const directoryFields = {
  accounts: [
    "name",
    "institution_type",
    "country",
    "city",
    "website",
    "email",
    "phone",
    "status",
    "business",
    "notes",
  ],
  contacts: [
    "first_name",
    "last_name",
    "job_title",
    "department",
    "email",
    "phone",
    "account_id",
    "notes",
  ],
};
export type RecordData = {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  institution_type?: string;
  country?: string;
  city?: string;
  website?: string;
  email?: string;
  phone?: string;
  status?: string;
  business?: string;
  notes?: string;
  job_title?: string;
  department?: string;
  account_id?: string;
  created_at?: string;
  updated_at?: string;
  owner_id?: string;
};
export function recordName(r: RecordData) {
  return r.name ?? `${r.first_name} ${r.last_name}`;
}
