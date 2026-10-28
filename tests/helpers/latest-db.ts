import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
export const ids = {
  root: "11111111-1111-4111-8111-111111111111",
  manager: "22222222-2222-4222-8222-222222222222",
  employee: "33333333-3333-4333-8333-333333333333",
  viewer: "44444444-4444-4444-8444-444444444444",
};
export async function latestDatabase() {
  const db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner_id text);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant select,insert,delete on storage.objects to authenticated;grant select on storage.objects to anon;",
  );
  const dir = new URL("../../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(dir))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(new URL(file, dir), "utf8"));
  for (const [role, id] of Object.entries(ids)) {
    await db.query("insert into auth.users values($1,$2,now())", [
      id,
      role === "root" ? "souhail@justech.tn" : role + "@example.invalid",
    ]);
    await db.query(
      "insert into employee_profiles(id,full_name) values($1,$2)",
      [id, role],
    );
    await db.query("insert into user_roles values($1,$2)", [
      id,
      role === "root" ? "administrator" : "it",
    ]);
  }
  const as = async (id: string | null) =>
    db.exec(
      `reset role;select set_config('request.jwt.claim.sub','${id ?? ""}',false);set role ${id ? "authenticated" : "anon"};`,
    );
  await db.query("select configure_team_super_admin($1,'souhail@justech.tn')", [
    ids.root,
  ]);
  await as(ids.root);
  await db.exec("select activate_team_super_admin()");
  const grants = (write: boolean) =>
    [
      "directory",
      "alfikr-sales",
      "alfikr-marketing",
      "alfikr-content",
      "priorities",
      "platform",
      "events",
    ].map((module) => ({ module, read: true, write, delete: write }));
  for (const role of ["manager", "employee", "viewer"] as const)
    await db.query("select team_update_user($1,$2,$3,$4,true,$5,false,false)", [
      ids[role],
      role,
      "it",
      role,
      JSON.stringify(grants(role !== "viewer")),
    ]);
  const insert = async (table: string, data: Record<string, unknown>) => {
    const k = Object.keys(data);
    return (
      await db.query<{ id: string }>(
        `insert into ${table}(${k.join(",")}) values(${k.map((_, i) => "$" + (i + 1)).join(",")}) returning id`,
        Object.values(data),
      )
    ).rows[0].id;
  };
  return { db, as, insert };
}
