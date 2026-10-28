import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("Workspace persistence, verified administration, invitations and assigned-work permissions", async (t) => {
  const db = new PGlite();
  const root = "11111111-1111-4111-8111-111111111111",
    legacy = "22222222-2222-4222-8222-222222222222",
    manager = "33333333-3333-4333-8333-333333333333",
    employee = "44444444-4444-4444-8444-444444444444",
    viewer = "55555555-5555-4555-8555-555555555555",
    invitee = "66666666-6666-4666-8666-666666666666",
    unknown = "77777777-7777-4777-8777-777777777777";
  const as = async (id: string | null) =>
    db.exec(
      `reset role;select set_config('request.jwt.claim.sub','${id ?? ""}',false);set role ${id ? "authenticated" : "anon"};`,
    );
  const cap = async (p: string) =>
    (await db.query<{ v: boolean }>("select has_permission($1) v", [p])).rows[0]
      .v;
  const n = async (table: string) =>
    (await db.query<{ n: number }>(`select count(*)::int n from ${table}`))
      .rows[0].n;
  const insert = async (table: string, data: Record<string, unknown>) => {
    const k = Object.keys(data);
    return (
      await db.query<{ id: string }>(
        `insert into ${table}(${k.join(",")}) values(${k.map((_, i) => "$" + (i + 1)).join(",")}) returning id`,
        Object.values(data),
      )
    ).rows[0].id;
  };
  const modules = (write = true) =>
    ["directory", "priorities", "platform", "events", "operations"].map(
      (module) => ({ module, read: true, write, delete: write }),
    );
  const updateUser = async (
    target: string,
    role: string,
    active = true,
    privateAccess = false,
    removed = false,
  ) =>
    db.query("select team_update_user($1,$2,$3,$4,$5,$6,$7,$8)", [
      target,
      role + " user",
      "it",
      role,
      active,
      JSON.stringify(modules(role !== "viewer")),
      privateAccess,
      removed,
    ]);
  let account = "",
    project = "",
    issue = "",
    priority = "",
    conference = "",
    event = "",
    supplierInvoice = "";
  try {
    await db.exec(
      "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner_id text);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant select,insert,delete on storage.objects to authenticated;grant select on storage.objects to anon;",
    );
    for (const file of [
      "0001_crm.sql",
      "0002_justech_sales.sql",
      "0003_justech_marketing.sql",
      "0004_justech_operations.sql",
      "0005_justech_training.sql",
      "0006_sales_payments_caution.sql",
      "0007_private_supplier_invoices.sql",
      "0008_supplier_invoice_storage.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    for (const [id, email, role] of [
      [root, "souhail@justech.tn", "sales"],
      [legacy, "legacy@example.invalid", "administrator"],
      [manager, "manager@example.invalid", "it"],
      [employee, "employee@example.invalid", "sales"],
      [viewer, "viewer@example.invalid", "training"],
    ]) {
      await db.query("insert into auth.users values($1,$2,now())", [id, email]);
      await db.query(
        "insert into employee_profiles(id,full_name) values($1,$2)",
        [id, email],
      );
      await db.query("insert into user_roles values($1,$2)", [id, role]);
    }
    await db.query(
      "insert into auth.users values($1,'invited@example.invalid',now()),($2,'unknown@example.invalid',now())",
      [invitee, unknown],
    );
    account = await insert("accounts", {
      name: "Test institution",
      institution_type: "University",
      owner_id: legacy,
    });
    const oldActivity = await insert("activities", {
      title: "Existing unrelated activity",
      assigned_to: employee,
    });
    for (const file of ["0009_workspace.sql", "0010_team_management.sql"])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    await t.test(
      "Installation preserves legacy permissions and grants no new Workspace or administrator access",
      async () => {
        await as(legacy);
        assert.equal(await cap("sales.write"), true);
        assert.equal(await cap("priorities.read"), false);
        assert.equal(
          (await db.query<{ v: boolean }>("select is_super_admin() v")).rows[0]
            .v,
          false,
        );
        await assert.rejects(
          db.query("select configure_team_super_admin($1,$2)", [
            legacy,
            "legacy@example.invalid",
          ]),
          /permission denied/,
        );
        await assert.rejects(
          db.query("select activate_team_super_admin()"),
          /verified designated/,
        );
        await assert.rejects(
          updateUser(employee, "manager"),
          /Super Admin required/,
        );
      },
    );
    await t.test(
      "Only a confirmed configured identity and matching authenticated session can activate Super Admin",
      async () => {
        await db.exec("reset role");
        await assert.rejects(
          db.query("select configure_team_super_admin($1,$2)", [
            root,
            "souhail@justech",
          ]),
          /Verify/,
        );
        await db.query(
          "update auth.users set email_confirmed_at=null where id=$1",
          [root],
        );
        await assert.rejects(
          db.exec(
            await readFile(
              new URL("../docs/setup/team-super-admin.sql", import.meta.url),
              "utf8",
            ),
          ),
          /Verify/,
        );
        await db.query(
          "update auth.users set email_confirmed_at=now() where id=$1",
          [root],
        );
        await db.exec(
          await readFile(
            new URL("../docs/setup/team-super-admin.sql", import.meta.url),
            "utf8",
          ),
        );
        await as(legacy);
        await assert.rejects(
          db.query("select activate_team_super_admin()"),
          /verified designated/,
        );
        await as(root);
        assert.equal(
          (
            await db.query<{ v: boolean }>(
              "select team_admin_activation_ready() v",
            )
          ).rows[0].v,
          true,
        );
        assert.equal(await cap("platform.write"), false);
        await db.exec("select activate_team_super_admin()");
        assert.equal(await cap("platform.write"), true);
        assert.equal(
          (
            await db.query<{ v: boolean }>(
              "select supplier_invoice_allowed() v",
            )
          ).rows[0].v,
          false,
        );
        await assert.rejects(updateUser(root, "viewer", false), /protected/);
        await updateUser(manager, "manager");
        await updateUser(employee, "employee");
        await updateUser(viewer, "viewer", true, true);
      },
    );
    await t.test(
      "Priorities reuse scoped activities without changing existing Operations or unrelated activity rows",
      async () => {
        await as(manager);
        priority = await insert("activities", {
          workspace_kind: "priorities",
          title: "Team priority",
          team_department: "sales",
          assigned_to: employee,
          due_at: "2026-01-01",
          priority: "Urgent",
          status: "To Do",
          owner_id: manager,
        });
        assert.equal(await n("team_priorities_list"), 1);
        assert.equal(
          (
            await db.query("select id from activities where id=$1", [
              oldActivity,
            ])
          ).rows.length,
          0,
        );
        await db.query("update activities set status='Completed' where id=$1", [
          priority,
        ]);
        assert.ok(
          (
            await db.query<{ completed_at: unknown }>(
              "select completed_at from activities where id=$1",
              [priority],
            )
          ).rows[0].completed_at,
        );
        await db.exec("reset role");
        assert.equal(
          (
            await db.query<{ status: string }>(
              "select status from activities where id=$1",
              [oldActivity],
            )
          ).rows[0].status,
          "Open",
        );
      },
    );
    await t.test(
      "Projects contain their own tasks; real progress and foreign keys remain consistent",
      async () => {
        await as(manager);
        project = await insert("it_projects", {
          name: "CRM platform",
          platform: "CRM",
          description: "Improve operations",
          responsible_id: manager,
          start_date: "2026-01-01",
          deadline: "2026-12-31",
          status: "In Progress",
          owner_id: manager,
        });
        issue = await insert("it_issues", {
          project_id: project,
          title: "Assigned issue",
          platform: "CRM",
          issue_type: "Bug",
          assigned_to: employee,
          priority: "High",
          status: "To Do",
          owner_id: manager,
        });
        await insert("it_issues", {
          project_id: project,
          title: "Completed task",
          platform: "CRM",
          issue_type: "Task",
          assigned_to: manager,
          priority: "Medium",
          status: "Completed",
          owner_id: manager,
        });
        const p = (
          await db.query<{
            total_tasks: number;
            completed_tasks: number;
            progress: number;
          }>("select * from it_projects_list where id=$1", [project])
        ).rows[0];
        assert.equal(p.total_tasks, 2);
        assert.equal(p.completed_tasks, 1);
        assert.equal(p.progress, 50);
        await assert.rejects(
          db.query("delete from it_projects where id=$1", [project]),
          /foreign key/,
        );
        await assert.rejects(
          insert("it_issues", {
            project_id: unknown,
            title: "Orphan",
            platform: "CRM",
            issue_type: "Task",
            assigned_to: employee,
            priority: "High",
            status: "To Do",
            owner_id: manager,
          }),
          /foreign key/,
        );
      },
    );
    await t.test(
      "Conferences and Events persist independent records with employee and institution references",
      async () => {
        await as(manager);
        conference = await insert("conference_contacts", {
          account_id: account,
          contact_type: "University",
          contact_person: "Contact person",
          email_phone: "person@example.invalid",
          country: "Tunisia",
          status: "Follow-up",
          date_contacted: "2026-01-01",
          topic: "Conference",
          next_step: "Call",
          follow_up_date: "2026-01-10",
          responsible_id: employee,
          owner_id: manager,
        });
        event = await insert("workspace_events", {
          name: "Team event",
          activities: "Workshop",
          responsible_id: employee,
          event_date: "2026-12-01",
          status: "Planned",
          notes: "",
          owner_id: manager,
        });
        assert.equal(await n("conference_contacts_list"), 1);
        assert.equal(await n("workspace_events_list"), 1);
        await db.query(
          "update conference_contacts set next_step='Email' where id=$1",
          [conference],
        );
        await db.query(
          "update workspace_events set notes='Updated' where id=$1",
          [event],
        );
        await assert.rejects(
          db.query(
            "update conference_contacts set follow_up_date='2025-12-01' where id=$1",
            [conference],
          ),
          /check constraint/,
        );
      },
    );
    await t.test(
      "Employees can manage assigned work, cannot reassign themselves or mutate other people’s work; Viewers are read-only",
      async () => {
        await as(employee);
        await db.query("update it_issues set status='Completed' where id=$1", [
          issue,
        ]);
        assert.equal(
          (await db.query("update it_projects set name='Denied' returning id"))
            .rows.length,
          0,
        );
        await assert.rejects(
          db.query("update it_issues set assigned_to=$1 where id=$2", [
            manager,
            issue,
          ]),
          /row-level security/,
        );
        await assert.rejects(
          insert("activities", {
            workspace_kind: "priorities",
            title: "Not mine",
            team_department: "it",
            assigned_to: manager,
            due_at: "2026-01-01",
            status: "To Do",
            owner_id: employee,
          }),
          /row-level security/,
        );
        await as(viewer);
        assert.equal(await cap("platform.write"), false);
        assert.equal(await n("it_issues_list"), 2);
        assert.equal(
          (await db.query("update it_issues set status='On Hold' returning id"))
            .rows.length,
          0,
        );
        await assert.rejects(
          db.query("select team_update_user($1,$2,$3,$4,true,$5,false,false)", [
            viewer,
            "Escalated",
            "it",
            "manager",
            JSON.stringify(modules()),
          ]),
          /Super Admin required/,
        );
        await assert.rejects(
          db.query(
            "insert into team_module_access(user_id,module,can_read) values($1,'platform',true)",
            [viewer],
          ),
          /permission denied/,
        );
      },
    );
    await t.test(
      "Private invoice grants stay explicit; Viewer grants do not allow record or file writes",
      async () => {
        await as(root);
        await db.query("select set_supplier_invoice_access($1,true)", [
          manager,
        ]);
        await as(manager);
        supplierInvoice = await insert("supplier_invoices", {
          invoice_number: "SUP-1",
          supplier: "Private supplier",
          product_service: "Service",
          invoice_date: "2026-01-01",
          due_date: "2026-01-31",
          amount: "10",
          currency: "EUR",
          payment_status: "Unpaid",
          owner_id: manager,
        });
        await db.query(
          "insert into storage.objects(bucket_id,name,owner_id) values('supplier-invoices',$1,$2)",
          [supplierInvoice + "/file.pdf", manager],
        );
        await as(viewer);
        assert.equal(await n("supplier_invoices"), 1);
        assert.equal(await n("storage.objects"), 1);
        assert.equal(
          (
            await db.query<{ v: boolean }>(
              "select supplier_invoice_can_write() v",
            )
          ).rows[0].v,
          false,
        );
        assert.equal(
          (
            await db.query(
              "update supplier_invoices set notes='attack' returning id",
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (await db.query("delete from storage.objects returning id")).rows
            .length,
          0,
        );
        await assert.rejects(
          db.query(
            "insert into storage.objects(bucket_id,name) values('supplier-invoices',$1)",
            [supplierInvoice + "/attack.pdf"],
          ),
          /row-level security/,
        );
        await as(legacy);
        await assert.rejects(
          db.query("select set_supplier_invoice_access($1,true)", [legacy]),
          /Super Admin required/,
        );
      },
    );
    await t.test(
      "Invitations only grant administrator-stored permissions after verified recipient acceptance, once",
      async () => {
        await as(legacy);
        await assert.rejects(
          db.query("select team_create_invitation($1,$2,$3,$4,$5,false)", [
            "invited@example.invalid",
            "Invitee",
            "it",
            "manager",
            JSON.stringify(modules()),
          ]),
          /Super Admin required/,
        );
        await as(root);
        await db.query("select team_create_invitation($1,$2,$3,$4,$5,false)", [
          "invited@example.invalid",
          "Invitee",
          "it",
          "viewer",
          JSON.stringify(modules(false)),
        ]);
        await as(unknown);
        await assert.rejects(
          db.query("select accept_crm_invitation()"),
          /No pending/,
        );
        await as(invitee);
        await db.exec("select accept_crm_invitation()");
        assert.equal(await cap("platform.read"), true);
        assert.equal(await cap("platform.write"), false);
        await assert.rejects(
          db.query("select accept_crm_invitation()"),
          /No pending/,
        );
        await as(root);
        const id = (
          await db.query<{ v: string }>(
            "select team_create_invitation($1,$2,$3,$4,$5,false) v",
            [
              "unknown@example.invalid",
              "Cancelled",
              "it",
              "employee",
              JSON.stringify(modules()),
            ],
          )
        ).rows[0].v;
        await db.query("select team_cancel_invitation($1)", [id]);
        await as(unknown);
        await assert.rejects(
          db.query("select accept_crm_invitation()"),
          /No pending/,
        );
        await as(root);
        const expired = (
          await db.query<{ v: string }>(
            "select team_create_invitation($1,$2,$3,$4,$5,false) v",
            [
              "unknown@example.invalid",
              "Expired invite",
              "it",
              "employee",
              JSON.stringify(modules()),
            ],
          )
        ).rows[0].v;
        await db.exec("reset role");
        await db.query(
          "update auth.users set email_confirmed_at=null where id=$1",
          [unknown],
        );
        await as(unknown);
        await assert.rejects(
          db.query("select accept_crm_invitation()"),
          /verified authenticated/,
        );
        await db.exec("reset role");
        await db.query(
          "update auth.users set email_confirmed_at=now() where id=$1",
          [unknown],
        );
        await db.query(
          "update team_invitations set expires_at=now()-interval '1 second' where id=$1",
          [expired],
        );
        await as(unknown);
        await assert.rejects(
          db.query("select accept_crm_invitation()"),
          /No pending/,
        );
      },
    );
    await t.test(
      "Deactivation and removal revoke capabilities without deleting related business history",
      async () => {
        await as(root);
        await updateUser(employee, "employee", false);
        await as(employee);
        assert.equal(await cap("platform.read"), false);
        assert.equal(await n("it_issues"), 0);
        await as(root);
        await updateUser(manager, "manager", false, false, true);
        assert.equal(
          (
            await db.query<{ n: number }>(
              "select count(*)::int n from it_projects where id=$1",
              [project],
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (
            await db.query<{ n: number }>(
              "select count(*)::int n from it_issues where id=$1",
              [issue],
            )
          ).rows[0].n,
          1,
        );
        const roster = (
          await db.query<{ v: { id: string; removed_at: string | null }[] }>(
            "select team_users() v",
          )
        ).rows[0].v;
        assert.ok(roster.find((u) => u.id === manager)?.removed_at);
        await as(manager);
        assert.equal(await cap("events.read"), false);
        assert.equal(await n("supplier_invoices"), 0);
        await as(null);
        await assert.rejects(
          db.query("select team_users()"),
          /permission denied/,
        );
        await assert.rejects(
          db.query("select * from team_invitations"),
          /permission denied/,
        );
      },
    );
    await t.test(
      "Managers and Super Admin can delete unlinked Workspace records with audit history",
      async () => {
        await as(root);
        await db.query("delete from it_issues where project_id=$1", [project]);
        await db.query("delete from it_projects where id=$1", [project]);
        await db.query("delete from activities where id=$1", [priority]);
        await db.query("delete from conference_contacts where id=$1", [
          conference,
        ]);
        await db.query("delete from workspace_events where id=$1", [event]);
        assert.equal(await n("it_projects"), 0);
        assert.ok(
          (await n(
            "audit_records where entity='it_projects' and action='DELETE'",
          )) > 0,
        );
      },
    );
  } finally {
    await db.close();
  }
});
