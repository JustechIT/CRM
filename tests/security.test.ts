import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("migration enforces RBAC, RLS, ownership, audit integrity and foreign keys in PostgreSQL", async (t) => {
  const db = new PGlite();
  const ids = {
    admin: "11111111-1111-4111-8111-111111111111",
    sales: "22222222-2222-4222-8222-222222222222",
    reader: "33333333-3333-4333-8333-333333333333",
    inactive: "44444444-4444-4444-8444-444444444444",
    outsider: "55555555-5555-4555-8555-555555555555",
  };
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to authenticated;`,
    );
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/0001_crm.sql", import.meta.url),
        "utf8",
      ),
    );
    for (const [name, id] of Object.entries(ids)) {
      await db.query("insert into auth.users values($1)", [id]);
      if (name !== "outsider")
        await db.query(
          "insert into employee_profiles(id,full_name,status) values($1,$2,$3)",
          [id, `Test ${name}`, name === "inactive" ? "inactive" : "active"],
        );
    }
    await db.exec(
      `insert into user_roles values ('${ids.admin}','administrator'),('${ids.sales}','sales'),('${ids.sales}','training'),('${ids.reader}','marketing'),('${ids.inactive}','administrator');`,
    );
    const asUser = async (id: string, role = "authenticated") => {
      await db.exec(
        `reset role; select set_config('request.jwt.claim.sub','${id}',false);set role ${role};`,
      );
    };
    const create = async (owner: string) =>
      db.query<{ id: string }>(
        `insert into accounts(name,institution_type,business,status,owner_id) values('Synthetic security test','University','Both','Active',$1) returning id`,
        [owner],
      );
    let accountId = "";
    await t.test(
      "unauthenticated callers cannot read protected tables",
      async () => {
        await asUser("", "anon");
        await assert.rejects(
          db.query("select * from accounts"),
          /permission denied/,
        );
      },
    );
    await t.test(
      "auth identity without employee profile cannot access data",
      async () => {
        await asUser(ids.outsider);
        const r = await db.query("select * from accounts");
        assert.equal(r.rows.length, 0);
        await assert.rejects(create(ids.outsider), /row-level security/);
      },
    );
    await t.test(
      "sales with multiple roles can create an owned account",
      async () => {
        await asUser(ids.sales);
        const r = await create(ids.sales);
        accountId = r.rows[0].id;
        assert.ok(accountId);
        assert.equal((await db.query("select * from accounts")).rows.length, 1);
      },
    );
    await t.test(
      "writers cannot forge ownership or change protected timestamps",
      async () => {
        await asUser(ids.sales);
        await assert.rejects(create(ids.admin), /row-level security/);
        await assert.rejects(
          db.query("update accounts set owner_id=$1 where id=$2", [
            ids.admin,
            accountId,
          ]),
          /permission denied/,
        );
        await assert.rejects(
          db.query("update accounts set created_at=now() where id=$1", [
            accountId,
          ]),
          /permission denied/,
        );
      },
    );
    let contactId = "";
    await t.test(
      "contact relationship and duplicate protections persist",
      async () => {
        await asUser(ids.sales);
        const r = await db.query<{ id: string }>(
          "insert into contacts(first_name,last_name,email,account_id,owner_id) values('Test','Person','test@example.invalid',$1,$2) returning id",
          [accountId, ids.sales],
        );
        contactId = r.rows[0].id;
        await assert.rejects(
          db.query(
            "insert into contacts(first_name,last_name,email,account_id,owner_id) values('Test','Duplicate','TEST@example.invalid',$1,$2)",
            [accountId, ids.sales],
          ),
          /duplicate key/,
        );
        await db.query(
          "update contacts set notes='Updated test note' where id=$1",
          [contactId],
        );
        assert.equal(
          (
            await db.query<{ notes: string }>(
              "select notes from contacts where id=$1",
              [contactId],
            )
          ).rows[0].notes,
          "Updated test note",
        );
      },
    );
    await t.test(
      "read-only roles can read but cannot write or escalate privileges",
      async () => {
        await asUser(ids.reader);
        assert.equal((await db.query("select * from accounts")).rows.length, 1);
        await assert.rejects(create(ids.reader), /row-level security/);
        assert.equal(
          (
            await db.query(
              "update accounts set name='Unauthorized' returning id",
            )
          ).rows.length,
          0,
        );
        await assert.rejects(
          db.query("insert into user_roles values($1,'administrator')", [
            ids.reader,
          ]),
          /permission denied/,
        );
        await assert.rejects(
          db.query("update employee_profiles set status='active'"),
          /permission denied/,
        );
      },
    );
    await t.test(
      "inactive administrators lose all business access",
      async () => {
        await asUser(ids.inactive);
        assert.equal((await db.query("select * from accounts")).rows.length, 0);
        assert.equal(
          (
            await db.query<{ allowed: boolean }>(
              "select has_permission('directory.delete') as allowed",
            )
          ).rows[0].allowed,
          false,
        );
      },
    );
    await t.test("preferences are scoped to their employee", async () => {
      await asUser(ids.sales);
      await db.query(
        "insert into user_preferences(user_id,pinned_pages) values($1,array['/directory'])",
        [ids.sales],
      );
      await asUser(ids.reader);
      assert.equal(
        (await db.query("select * from user_preferences")).rows.length,
        0,
      );
      await assert.rejects(
        db.query("insert into user_preferences(user_id) values($1)", [
          ids.sales,
        ]),
        /row-level security/,
      );
    });
    await t.test(
      "administrator deletion respects contact foreign keys and emits immutable audit records",
      async () => {
        await asUser(ids.admin);
        await assert.rejects(
          db.query("delete from accounts where id=$1", [accountId]),
          /foreign key/,
        );
        await db.query("delete from contacts where id=$1", [contactId]);
        await db.query("delete from accounts where id=$1", [accountId]);
        const audit = await db.query<{ action: string }>(
          "select action from audit_records order by id",
        );
        assert.deepEqual(
          audit.rows.map((r) => r.action),
          ["INSERT", "INSERT", "UPDATE", "DELETE", "DELETE"],
        );
        await assert.rejects(
          db.query("delete from audit_records"),
          /permission denied/,
        );
      },
    );
  } finally {
    await db.close();
  }
});
