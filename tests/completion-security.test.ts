import test from "node:test";
import assert from "node:assert/strict";
import { latestDatabase, ids } from "./helpers/latest-db";
test("Al-Fikr, imports, personal settings, notifications and real dashboard data remain permission protected", async (t) => {
  const { db, as, insert } = await latestDatabase();
  let account = "",
    product = "",
    catalog = "";
  try {
    await t.test(
      "All seven Al-Fikr sections persist exact business fields, linked organizations/products and employee assignments",
      async () => {
        await as(ids.root);
        account = await insert("accounts", {
          name: "Al-Fikr institution",
          institution_type: "University",
          business: "Both",
          owner_id: ids.root,
        });
        product = (
          await db.query<{ v: string }>(
            "select create_alfikr_product('Digital library') v",
          )
        ).rows[0].v;
        const refs = {
          account_id: account,
          product_id: product,
          owner_id: ids.root,
        };
        await insert("alfikr_sales_opportunities", {
          ...refs,
          name: "Library opportunity",
          date: "2026-10-01",
          due_date: "2026-10-02",
          value: "12.345",
          stage: "Qualified",
          action_type: "Call",
        });
        await insert("alfikr_sales_quotations", {
          ...refs,
          quotation_id: "AF-Q-1",
          currency: "EUR",
          amount: "100.005",
          issue_date: "2026-10-01",
          valid_until: "2026-11-01",
          status: "Pending",
          assigned_to: ids.manager,
        });
        await insert("alfikr_sales_subscriptions", {
          ...refs,
          start_date: "2026-01-01",
          end_date: "2026-12-31",
          contract_duration: "Annual",
          status: "Active",
          annual_value: "100.005",
          currency: "EUR",
          assigned_to: ids.manager,
        });
        await insert("alfikr_marketing_campaigns", {
          name: "Library campaign",
          platform: "Email",
          start_date: "2026-01-01",
          end_date: "2026-12-31",
          status: "Active",
          assigned_to: ids.manager,
          owner_id: ids.root,
        });
        await insert("alfikr_marketing_content_calendar", {
          title: "Library publication",
          platform: "LinkedIn",
          content_type: "Post",
          publish_date: "2026-10-01",
          status: "Awaiting Approval",
          assigned_to: ids.manager,
          owner_id: ids.root,
        });
        catalog = await insert("alfikr_content_content_catalog", {
          content_id: "BK-1",
          title: "Digital resource",
          language: "Arabic",
          content_type: "Book",
          availability: "In Preparation",
          assigned_to: ids.manager,
          owner_id: ids.root,
        });
        await insert("alfikr_content_content_workflow", {
          catalog_id: catalog,
          workflow_stage: "Review",
          assigned_to: ids.manager,
          date_received: "2026-10-01",
          due_date: "2026-11-01",
          review_result: "Pending",
          status: "Active",
          owner_id: ids.root,
        });
        await db.query(
          "update alfikr_content_content_catalog set availability='Published' where id=$1",
          [catalog],
        );
        assert.ok(
          (
            await db.query<{ published_at: unknown }>(
              "select published_at from alfikr_content_content_catalog where id=$1",
              [catalog],
            )
          ).rows[0].published_at,
        );
        await assert.rejects(
          db.query("delete from alfikr_content_content_catalog where id=$1", [
            catalog,
          ]),
          /foreign key/,
        );
        const onlyJustech = await insert("products", {
          name: "Justech-only",
          subscription_kind: "Other",
          owner_id: ids.root,
        });
        await assert.rejects(
          insert("alfikr_sales_opportunities", {
            ...refs,
            product_id: onlyJustech,
            name: "Wrong business",
            date: "2026-10-01",
            stage: "New",
          }),
          /Al-Fikr or shared product/,
        );
      },
    );
    await t.test(
      "Al-Fikr overviews use actual records, avoid duplicated annual terms and separate currencies",
      async () => {
        await as(ids.root);
        await insert("alfikr_sales_subscriptions", {
          account_id: account,
          product_id: product,
          start_date: "2026-06-01",
          end_date: "2027-05-31",
          contract_duration: "Annual",
          status: "Confirmed",
          annual_value: "200.005",
          currency: "EUR",
          assigned_to: ids.manager,
          owner_id: ids.root,
        });
        const s = (
          await db.query<{ v: Record<string, unknown> }>(
            "select alfikr_overview('alfikr-sales','2026-10-28',2026) v",
          )
        ).rows[0].v;
        assert.equal(s["Open Opportunities"], 1);
        assert.equal(s["Pending Quotations"], 1);
        assert.deepEqual(s["Annual Subscription Value"], { EUR: "200.005" });
        assert.equal(s["Follow-ups Due"], 1);
        const m = (
          await db.query<{ v: Record<string, number> }>(
            "select alfikr_overview('alfikr-marketing','2026-10-28',2026) v",
          )
        ).rows[0].v;
        assert.equal(m["Active Campaigns"], 1);
        assert.equal(m["Awaiting Approval"], 1);
        assert.equal(m["Overdue Content"], 1);
      },
    );
    await t.test(
      "Every Al-Fikr table supports persisted updates with stale-version protection",
      async () => {
        await as(ids.root);
        for (const [table, column] of [
          ["alfikr_sales_opportunities", "notes"],
          ["alfikr_sales_quotations", "notes"],
          ["alfikr_sales_subscriptions", "notes"],
          ["alfikr_marketing_campaigns", "platform"],
          ["alfikr_marketing_content_calendar", "platform"],
          ["alfikr_content_content_catalog", "notes"],
          ["alfikr_content_content_workflow", "notes"],
        ]) {
          const before = (
            await db.query<{ id: string; revision: number }>(
              `select id,revision from ${table} order by id limit 1`,
            )
          ).rows[0];
          const changed = await db.query<{ revision: number }>(
            `update ${table} set ${column}=$1 where id=$2 and revision=$3 returning revision`,
            ["Reviewed", before.id, before.revision],
          );
          assert.equal(changed.rows[0].revision, before.revision + 1);
          assert.equal(
            (
              await db.query(
                `update ${table} set ${column}=$1 where id=$2 and revision=$3 returning id`,
                ["Stale", before.id, before.revision],
              )
            ).rows.length,
            0,
          );
        }
      },
    );
    await t.test(
      "Bulk import preview resolves institutions, flags duplicates and rejects unauthorized previews in one request",
      async () => {
        await as(ids.manager);
        const base = {
          institution_type: "University",
          status: "Active",
          business: "Al-Fikr",
          country: "",
          city: "",
        };
        const preview = (
          await db.query<{
            v: {
              duplicate: boolean;
              error: string;
              data: Record<string, unknown>;
            }[];
          }>("select preview_directory_matches($1,$2) v", [
            "accounts",
            JSON.stringify([
              {
                row: 2,
                data: { ...base, name: "Al-Fikr institution" },
                error: "",
              },
              {
                row: 3,
                data: { ...base, name: "New preview institution" },
                error: "",
              },
              {
                row: 4,
                data: { ...base, name: "new PREVIEW institution" },
                error: "",
              },
              { row: 5, data: null, error: "Name is required" },
            ]),
          ])
        ).rows[0].v;
        assert.equal(preview[0].duplicate, true);
        assert.equal(preview[1].duplicate, false);
        assert.equal(preview[2].duplicate, true);
        assert.equal(preview[3].error, "Name is required");
        const contact = (
          await db.query<{
            v: { data: { account_id: string }; error: string }[];
          }>("select preview_directory_matches($1,$2) v", [
            "contacts",
            JSON.stringify([
              {
                row: 2,
                data: { first_name: "Person", last_name: "Preview", email: "" },
                institution: "Al-Fikr institution",
                error: "",
              },
            ]),
          ])
        ).rows[0].v;
        assert.equal(contact[0].data.account_id, account);
        assert.equal(contact[0].error, "");
        await as(ids.viewer);
        await assert.rejects(
          db.query("select preview_directory_matches($1,$2)", [
            "accounts",
            "[]",
          ]),
          /write access required/,
        );
      },
    );
    await t.test(
      "Viewers cannot write, employees cannot alter others’ records, and business isolation is enforced",
      async () => {
        await as(ids.viewer);
        assert.equal(
          (
            await db.query(
              "update alfikr_sales_quotations set notes='Forged' returning id",
            )
          ).rows.length,
          0,
        );
        await assert.rejects(
          db.query("select create_alfikr_product('Forbidden')"),
          /write access required/,
        );
        await as(ids.employee);
        assert.equal(
          (
            await db.query(
              "update alfikr_marketing_campaigns set platform='Denied' returning id",
            )
          ).rows.length,
          0,
        );
        const visible = (
          await db.query<{ business: string }>("select business from products")
        ).rows;
        assert.ok(
          visible.every((p) => ["Al-Fikr", "Both"].includes(p.business)),
        );
        assert.equal(
          (await db.query("select * from sales_subscriptions")).rows.length,
          0,
        );
      },
    );
    await t.test(
      "Import is atomic, duplicate-safe, owner-bound and idempotent; contacts retain existing institution links",
      async () => {
        await as(ids.manager);
        const request = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
        const rows = [
          {
            name: "Imported university",
            institution_type: "University",
            country: "Tunisia",
            city: "Tunis",
            status: "Active",
            business: "Al-Fikr",
            owner_id: ids.viewer,
          },
          {
            name: "Imported university",
            institution_type: "University",
            country: "Tunisia",
            city: "Tunis",
            status: "Active",
            business: "Al-Fikr",
          },
        ];
        const r = (
          await db.query<{ v: { inserted: number; skipped: number } }>(
            "select import_directory($1,$2,$3) v",
            ["accounts", JSON.stringify(rows), request],
          )
        ).rows[0].v;
        assert.equal(r.inserted, 1);
        assert.equal(r.skipped, 1);
        const again = (
          await db.query<{ v: { inserted: number } }>(
            "select import_directory($1,$2,$3) v",
            ["accounts", JSON.stringify(rows), request],
          )
        ).rows[0].v;
        assert.equal(again.inserted, 1);
        const a = (
          await db.query<{ id: string; owner_id: string }>(
            "select id,owner_id from accounts where name='Imported university'",
          )
        ).rows;
        assert.equal(a.length, 1);
        assert.equal(a[0].owner_id, ids.manager);
        await db.query("select import_directory($1,$2,$3)", [
          "contacts",
          JSON.stringify([
            {
              first_name: "Imported",
              last_name: "Person",
              account_id: a[0].id,
              email: "imported@example.invalid",
            },
          ]),
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        ]);
        assert.equal(
          (
            await db.query<{ account_id: string }>(
              "select account_id from contacts where email='imported@example.invalid'",
            )
          ).rows[0].account_id,
          a[0].id,
        );
        await assert.rejects(
          db.query("select import_directory($1,$2,$3)", [
            "accounts",
            JSON.stringify([
              { ...rows[0], name: "Must roll back" },
              { ...rows[0], name: "" },
            ]),
            "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          ]),
          /check constraint/,
        );
        assert.equal(
          (
            await db.query(
              "select id from accounts where name='Must roll back'",
            )
          ).rows.length,
          0,
        );
        await as(ids.viewer);
        await assert.rejects(
          db.query("select import_directory($1,$2,$3)", [
            "accounts",
            JSON.stringify(rows),
            "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          ]),
          /write access required/,
        );
        assert.equal(
          (await db.query("select * from directory_import_jobs")).rows.length,
          0,
        );
      },
    );
    await t.test(
      "Personal preferences are editable while user information remains administrator-managed",
      async () => {
        await as(ids.viewer);
        await assert.rejects(
          db.query("select update_my_profile('Viewer renamed')"),
          /Super Admin required/,
        );
        assert.equal(
          (
            await db.query<{ full_name: string }>(
              "select full_name from employee_profiles where id=$1",
              [ids.viewer],
            )
          ).rows[0].full_name,
          "viewer",
        );
        assert.equal(
          (
            await db.query<{ role_id: string }>(
              "select role_id from user_roles where user_id=$1",
              [ids.viewer],
            )
          ).rows[0].role_id,
          "viewer",
        );
        await db.query(
          "insert into user_preferences(user_id,theme,notifications_enabled,sidebar_collapsed) values($1,'dark',false,true)",
          [ids.viewer],
        );
        await assert.rejects(
          db.query(
            "insert into user_preferences(user_id,theme) values($1,'dark')",
            [ids.root],
          ),
          /row-level security/,
        );
        await assert.rejects(
          db.query("update employee_profiles set status='active' where id=$1", [
            ids.manager,
          ]),
          /permission denied/,
        );
      },
    );
    await t.test(
      "Verified Super Admin can update their own display name without changing the verified identity or role",
      async () => {
        await as(ids.root);
        const before = (
          await db.query(
            "select role_id from user_roles where user_id=$1 order by role_id",
            [ids.root],
          )
        ).rows;
        await db.query("select update_my_profile('Souhail updated')");
        assert.equal(
          (await db.query<{ v: boolean }>("select is_super_admin() v")).rows[0]
            .v,
          true,
        );
        assert.deepEqual(
          (
            await db.query(
              "select role_id from user_roles where user_id=$1 order by role_id",
              [ids.root],
            )
          ).rows,
          before,
        );
      },
    );
    await t.test(
      "Notifications contain only accessible assigned records; read state belongs to the current user",
      async () => {
        await as(ids.root);
        await insert("activities", {
          workspace_kind: "priorities",
          title: "Assigned notification",
          team_department: "it",
          assigned_to: ids.employee,
          due_at: "2026-10-01",
          status: "To Do",
          owner_id: ids.root,
        });
        await as(ids.employee);
        const notes = (
          await db.query<{
            event_key: string;
            title: string;
            is_read: boolean;
          }>("select * from my_notifications()")
        ).rows;
        assert.equal(notes.length, 1);
        assert.equal(notes[0].title, "Assigned notification");
        assert.equal(notes[0].is_read, false);
        await db.query("select mark_notifications_read($1)", [
          [notes[0].event_key],
        ]);
        assert.equal(
          (
            await db.query<{ is_read: boolean }>(
              "select is_read from my_notifications()",
            )
          ).rows[0].is_read,
          true,
        );
        await assert.rejects(
          db.query(
            "insert into notification_reads(user_id,event_key) values($1,$2)",
            [ids.manager, notes[0].event_key],
          ),
          /row-level security/,
        );
        await as(ids.viewer);
        assert.equal(
          (await db.query("select * from my_notifications()")).rows.length,
          0,
        );
      },
    );
    await t.test(
      "Only the verified Super Admin can record invitation delivery outcomes without granting recipient permissions",
      async () => {
        await as(ids.root);
        const id = (
          await db.query<{ v: string }>(
            "select team_create_invitation($1,$2,$3,$4,$5,false) v",
            [
              "delivery@example.invalid",
              "Delivery test",
              "it",
              "viewer",
              JSON.stringify([
                {
                  module: "directory",
                  read: true,
                  write: false,
                  delete: false,
                },
              ]),
            ],
          )
        ).rows[0].v;
        await db.query("select record_invitation_delivery($1,true,null)", [id]);
        const state = (
          await db.query<{ mailed_at: unknown; status: string }>(
            "select mailed_at,status from team_invitations where id=$1",
            [id],
          )
        ).rows[0];
        assert.ok(state.mailed_at);
        assert.equal(state.status, "Pending");
        await as(ids.manager);
        await assert.rejects(
          db.query("select record_invitation_delivery($1,false,$2)", [
            id,
            "send_failed",
          ]),
          /Super Admin required/,
        );
      },
    );
    await t.test(
      "Dashboard counts reflect actual records and do not expose unauthorized modules or private invoice content",
      async () => {
        await as(ids.root);
        await assert.rejects(
          insert("supplier_invoices", {
            invoice_number: "PRIVATE",
            supplier: "Private supplier",
            product_service: "Service",
            invoice_date: "2026-01-01",
            due_date: "2026-02-01",
            amount: "10",
            currency: "EUR",
            payment_status: "Unpaid",
            owner_id: ids.root,
          }),
          /row-level security/,
        );
        const h = (
          await db.query<{
            v: {
              opportunities: number;
              tasks: number;
              activity: { entity: string }[];
            };
          }>("select home_dashboard() v")
        ).rows[0].v;
        assert.equal(h.opportunities, 1);
        assert.equal(h.tasks, 1);
        assert.ok(h.activity.every((a) => !a.entity.startsWith("supplier_")));
        await as(ids.viewer);
        const v = (
          await db.query<{
            v: {
              caution: number | null;
              opportunities: number;
              activity: unknown[];
            };
          }>("select home_dashboard() v")
        ).rows[0].v;
        assert.equal(v.caution, null);
        assert.equal(v.opportunities, 1);
        assert.equal(v.activity.length, 0);
        await as(null);
        await assert.rejects(
          db.query("select home_dashboard()"),
          /permission denied/,
        );
        await assert.rejects(
          db.query("select update_my_profile('Forged')"),
          /permission denied/,
        );
      },
    );
    await t.test(
      "All Al-Fikr rows can be deleted in relationship order by authorized users",
      async () => {
        await as(ids.root);
        for (const table of [
          "alfikr_content_content_workflow",
          "alfikr_content_content_catalog",
          "alfikr_marketing_content_calendar",
          "alfikr_marketing_campaigns",
          "alfikr_sales_quotations",
          "alfikr_sales_subscriptions",
          "alfikr_sales_opportunities",
        ]) {
          const removed = await db.query(`delete from ${table} returning id`);
          assert.ok(removed.rows.length > 0, table);
          assert.equal(
            (await db.query(`select * from ${table}`)).rows.length,
            0,
          );
        }
      },
    );
  } finally {
    await db.close();
  }
});

test("Invitation readiness rejects existing employees and wrong sessions before any password setup", async () => {
  const { db, as } = await latestDatabase();
  try {
    await as(ids.root);
    assert.equal(
      (await db.query<{ v: unknown }>("select invitation_for_me() v")).rows[0]
        .v,
      null,
    );
    await db.query("select team_create_invitation($1,$2,$3,$4,$5,false)", [
      "recipient@example.invalid",
      "Invited recipient",
      "it",
      "viewer",
      JSON.stringify([
        { module: "directory", read: true, write: false, delete: false },
      ]),
    ]);
    const guest = "55555555-5555-4555-8555-555555555555";
    await db.exec("reset role");
    await db.query("insert into auth.users values($1,$2,now())", [
      guest,
      "recipient@example.invalid",
    ]);
    await as(guest);
    assert.equal(
      (await db.query<{ v: { email: string } }>("select invitation_for_me() v"))
        .rows[0].v.email,
      "recipient@example.invalid",
    );
    await as(ids.viewer);
    assert.equal(
      (await db.query<{ v: unknown }>("select invitation_for_me() v")).rows[0]
        .v,
      null,
    );
    await db.exec("reset role");
    await db.query(
      "update team_invitations set status='Cancelled' where email='recipient@example.invalid'",
    );
    await as(guest);
    assert.equal(
      (await db.query<{ v: unknown }>("select invitation_for_me() v")).rows[0]
        .v,
      null,
    );
  } finally {
    await db.close();
  }
});
