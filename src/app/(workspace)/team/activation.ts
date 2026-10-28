"use server";
import { database, employee } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
export async function activateAdministrator() {
  if (!(await employee())) return;
  const db = await database();
  await db.rpc("activate_team_super_admin");
  revalidatePath("/", "layout");
}
