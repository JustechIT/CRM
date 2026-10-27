import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Marketing, Operations and Training persist records with module isolation and Sales compatibility", async (t) => {
  const db = new PGlite();
  const ids = {
    administrator: "11111111-1111-4111-8111-111111111111",
    marketing: "22222222-2222-4222-8222-222222222222",
    operations: "33333333-3333-4333-8333-333333333333",
    training: "44444444-4444-4444-8444-444444444444",
    sales: "55555555-5555-4555-8555-555555555555",
    inactive: "66666666-6666-4666-8666-666666666666",
    outsider: "77777777-7777-4777-8777-777777777777",
    management: "88888888-8888-4888-8888-888888888888",
  };
  const as = async (user: keyof typeof ids | "anon") =>
    db.exec(
      `reset role;select set_config('request.jwt.claim.sub','${user === "anon" ? "" : ids[user]}',false);set role ${user === "anon" ? "anon" : "authenticated"};`,
    );
  const insert = async (table: string, data: Record<string, unknown>) => {
    const keys = Object.keys(data);
    return (
      await db.query<{ id: string }>(
        `insert into ${table}(${keys.join(",")}) values(${keys.map((_, i) => "$" + (i + 1)).join(",")}) returning id`,
        Object.values(data),
      )
    ).rows[0].id;
  };
  const main: Record<
    string,
    { id: string; table: string; field: string; next: string }
  > = {};
  let account = "",
    otherAccount = "",
    contact = "",
    product = "",
    hiddenProduct = "",
    legacy = "",
    project = "",
    session = "",
    scheduled = "",
    cancelled = "";
  try {
    await db.exec(
      "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to authenticated;",
    );
    for (const file of [
      "0001_crm.sql",
      "0002_justech_sales.sql",
      "0003_justech_marketing.sql",
      "0004_justech_operations.sql",
      "0005_justech_training.sql",
    ])
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    for (const [role, id] of Object.entries(ids)) {
      await db.query("insert into auth.users values($1)", [id]);
      if (role !== "outsider") {
        await db.query(
          "insert into employee_profiles(id,full_name,status) values($1,$2,$3)",
          [
            id,
            `Synthetic ${role}`,
            role === "inactive" ? "inactive" : "active",
          ],
        );
        await db.query("insert into user_roles values($1,$2)", [
          id,
          role === "inactive" ? "administrator" : role,
        ]);
      }
    }
    account = await insert("accounts", {
      name: "Synthetic institution",
      institution_type: "University",
      owner_id: ids.administrator,
    });
    otherAccount = await insert("accounts", {
      name: "Another institution",
      institution_type: "Library",
      owner_id: ids.administrator,
    });
    contact = await insert("contacts", {
      first_name: "Synthetic",
      last_name: "Contact",
      email: "person@example.invalid",
      account_id: account,
      owner_id: ids.administrator,
    });
    product = await insert("products", {
      name: "Shared product",
      subscription_kind: "Other",
      owner_id: ids.sales,
    });
    hiddenProduct = await insert("products", {
      name: "Al-Fikr only",
      business: "Al-Fikr",
      subscription_kind: "Other",
      owner_id: ids.sales,
    });
    legacy = await insert("activities", {
      title: "Existing unrelated activity",
      assigned_to: ids.operations,
    });
    const remember = (
      key: string,
      id: string,
      table: string,
      field: string,
      next: string,
    ) => (main[key] = { id, table, field, next });
    await t.test(
      "Marketing creates campaigns, content and assets using shared employees and products",
      async () => {
        await as("marketing");
        remember(
          "campaign",
          await insert("marketing_campaigns", {
            name: "Current campaign",
            platform: "LinkedIn",
            start_date: "2026-01-01",
            end_date: "2026-12-31",
            status: "Active",
            assigned_to: ids.marketing,
            owner_id: ids.marketing,
          }),
          "marketing_campaigns",
          "name",
          "Updated campaign",
        );
        for (const status of ["Scheduled", "Cancelled"])
          await insert("marketing_campaigns", {
            name: `Future ${status}`,
            platform: "Email",
            start_date: "2026-11-01",
            end_date: "2026-12-01",
            status,
            assigned_to: ids.marketing,
            owner_id: ids.marketing,
          });
        remember(
          "content",
          await insert("marketing_content", {
            title: "Scheduled post",
            platform: "LinkedIn",
            content_type: "Post",
            publish_date: "2026-11-01",
            status: "Scheduled",
            assigned_to: ids.marketing,
            owner_id: ids.marketing,
          }),
          "marketing_content",
          "title",
          "Updated post",
        );
        for (const status of ["Awaiting approval", "Draft", "Published"])
          await insert("marketing_content", {
            title: `Content ${status}`,
            platform: "Website",
            content_type: "Article",
            publish_date: "2026-10-01",
            status,
            assigned_to: ids.marketing,
            owner_id: ids.marketing,
          });
        remember(
          "asset",
          await insert("marketing_assets", {
            name: "Product brochure",
            asset_type: "Brochure",
            product_id: product,
            file_link: "https://example.invalid/brochure.pdf",
            status: "In progress",
            assigned_to: ids.marketing,
            owner_id: ids.marketing,
          }),
          "marketing_assets",
          "file_link",
          "https://example.invalid/updated.pdf",
        );
        const r = await db.query<{ metrics: Record<string, number> }>(
          "select department_overview('marketing','2026-10-27') as metrics",
        );
        assert.deepEqual(r.rows[0].metrics, {
          active_campaigns: 1,
          scheduled_content: 1,
          content_awaiting_approval: 1,
          assets_in_progress: 1,
          upcoming_campaigns: 1,
          overdue_content: 2,
        });
        assert.equal(
          (await db.query("select * from products where id=$1", [product])).rows
            .length,
          1,
        );
        assert.equal(
          (
            await db.query("select * from products where id=$1", [
              hiddenProduct,
            ])
          ).rows.length,
          0,
        );
        await assert.rejects(
          db.query(
            "update marketing_campaigns set end_date='2025-01-01' where id=$1",
            [main.campaign.id],
          ),
          /check constraint/,
        );
        await assert.rejects(
          db.query(
            "update marketing_assets set file_link='javascript:alert(1)' where id=$1",
            [main.asset.id],
          ),
          /check constraint/,
        );
        await assert.rejects(
          db.query("update marketing_assets set product_id=$1 where id=$2", [
            hiddenProduct,
            main.asset.id,
          ]),
          /accessible Justech product/,
        );
        await assert.rejects(
          db.query(
            "update marketing_campaigns set assigned_to=$1 where id=$2",
            [ids.inactive, main.campaign.id],
          ),
          /active employee/,
        );
      },
    );
    await t.test(
      "Operations reuses scoped activities and creates related projects, quality checks and follow-ups",
      async () => {
        await as("operations");
        project = await insert("operations_projects", {
          name: "Delivery project",
          objective: "Deliver a platform",
          responsible_id: ids.operations,
          deadline: "2026-12-01",
          status: "Active",
          owner_id: ids.operations,
        });
        remember(
          "project",
          project,
          "operations_projects",
          "objective",
          "Updated objective",
        );
        remember(
          "task",
          await insert("activities", {
            title: "Project task",
            project_id: project,
            area: "",
            assigned_to: ids.operations,
            due_at: "2026-11-01T00:00:00Z",
            status: "Open",
            department: "operations",
            owner_id: ids.operations,
          }),
          "activities",
          "title",
          "Updated task",
        );
        for (const status of ["Open", "Completed"])
          await insert("activities", {
            title: `Area task ${status}`,
            area: "Procurement",
            assigned_to: ids.operations,
            due_at: "2026-11-01T00:00:00Z",
            status,
            department: "operations",
            owner_id: ids.operations,
          });
        remember(
          "quality",
          await insert("operations_quality_checks", {
            name: "Check delivery",
            project_id: project,
            area: "",
            assigned_to: ids.operations,
            result: "Pending",
            status: "Pending",
            owner_id: ids.operations,
          }),
          "operations_quality_checks",
          "result",
          "Passed",
        );
        await insert("operations_quality_checks", {
          name: "Completed check",
          area: "Procurement",
          assigned_to: ids.operations,
          result: "Passed",
          status: "Completed",
          owner_id: ids.operations,
        });
        remember(
          "followup",
          await insert("operations_followups", {
            subject: "Contact follow-up",
            contact_id: contact,
            last_contact: "2026-10-01",
            next_action: "Call",
            follow_up_date: "2026-10-20",
            status: "Open",
            owner_id: ids.operations,
          }),
          "operations_followups",
          "next_action",
          "Email",
        );
        for (const [status, date] of [
          ["Open", "2026-11-10"],
          ["Completed", "2026-10-01"],
        ])
          await insert("operations_followups", {
            subject: "Institution follow-up",
            account_id: account,
            next_action: "Email",
            follow_up_date: date,
            status,
            owner_id: ids.operations,
          });
        const r = await db.query<{ metrics: Record<string, number> }>(
          "select department_overview('operations','2026-10-27') as metrics",
        );
        assert.deepEqual(r.rows[0].metrics, {
          total_tasks: 3,
          open_tasks: 2,
          active_projects: 1,
          pending_quality_checks: 1,
          upcoming_followups: 1,
          overdue_followups: 1,
        });
        assert.equal(
          (await db.query("select * from activities where id=$1", [legacy]))
            .rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "update activities set title='Forbidden' where id=$1 returning id",
              [legacy],
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query<{ duplicate: string | null }>(
              "select to_regclass('public.operations_tasks') as duplicate",
            )
          ).rows[0].duplicate,
          null,
        );
        await assert.rejects(
          db.query("update activities set area='Also an area' where id=$1", [
            main.task.id,
          ]),
          /check constraint/,
        );
        await assert.rejects(
          db.query(
            "update operations_followups set account_id=$1 where id=$2",
            [account, main.followup.id],
          ),
          /check constraint/,
        );
        await assert.rejects(
          db.query(
            "update operations_followups set last_contact='2027-01-01' where id=$1",
            [main.followup.id],
          ),
          /check constraint/,
        );
        const names = await db.query<{ party_label: string }>(
          "select party_label from operations_followups_list where id=$1",
          [main.followup.id],
        );
        assert.match(
          names.rows[0].party_label,
          /Synthetic Contact.*Synthetic institution/,
        );
      },
    );
    await t.test(
      "Training persists sessions, registrations and completed history with live overview counts",
      async () => {
        await as("training");
        session = await insert("training_sessions", {
          name: "Completed training",
          product_id: product,
          trainer_id: ids.training,
          date: "2026-10-01",
          format: "Online",
          status: "Completed",
          owner_id: ids.training,
        });
        remember(
          "session",
          session,
          "training_sessions",
          "name",
          "Updated session",
        );
        scheduled = await insert("training_sessions", {
          name: "Future training",
          product_id: product,
          trainer_id: ids.training,
          date: "2026-11-01",
          format: "Hybrid",
          status: "Scheduled",
          owner_id: ids.training,
        });
        cancelled = await insert("training_sessions", {
          name: "Cancelled training",
          product_id: product,
          trainer_id: ids.training,
          date: "2026-11-01",
          format: "Online",
          status: "Cancelled",
          owner_id: ids.training,
        });
        remember(
          "registration",
          await insert("training_registrations", {
            participant_name: "Historical participant",
            account_id: account,
            session_id: session,
            email: "person@example.invalid",
            registration_status: "Confirmed",
            contact_id: contact,
            owner_id: ids.training,
          }),
          "training_registrations",
          "participant_name",
          "Updated participant",
        );
        await insert("training_registrations", {
          participant_name: "Pending participant",
          account_id: account,
          session_id: scheduled,
          email: "pending@example.invalid",
          registration_status: "Pending",
          owner_id: ids.training,
        });
        remember(
          "history",
          await insert("training_history", {
            session_id: session,
            account_id: account,
            date: "2026-10-01",
            participants: 12,
            trainer_id: ids.training,
            outcome: "Delivered introduction",
            owner_id: ids.training,
          }),
          "training_history",
          "outcome",
          "Updated outcome",
        );
        const r = await db.query<{ metrics: Record<string, number> }>(
          "select department_overview('training','2026-10-27') as metrics",
        );
        assert.deepEqual(r.rows[0].metrics, {
          total_sessions: 3,
          upcoming_sessions: 1,
          completed_sessions: 1,
          total_registrations: 2,
          pending_registrations: 1,
          training_history: 1,
        });
        await assert.rejects(
          insert("training_registrations", {
            participant_name: "Duplicate",
            account_id: account,
            session_id: session,
            email: "PERSON@example.invalid",
            registration_status: "Pending",
            owner_id: ids.training,
          }),
          /duplicate key/,
        );
        await assert.rejects(
          insert("training_registrations", {
            participant_name: "No admission",
            account_id: account,
            session_id: cancelled,
            email: "cancelled@example.invalid",
            registration_status: "Pending",
            owner_id: ids.training,
          }),
          /Cancelled sessions/,
        );
        await assert.rejects(
          insert("training_registrations", {
            participant_name: "Wrong institution",
            account_id: otherAccount,
            session_id: session,
            contact_id: contact,
            email: "wrong@example.invalid",
            registration_status: "Pending",
            owner_id: ids.training,
          }),
          /does not belong/,
        );
        await assert.rejects(
          insert("training_history", {
            session_id: scheduled,
            account_id: account,
            date: "2026-11-01",
            participants: 10,
            trainer_id: ids.training,
            outcome: "Not completed",
            owner_id: ids.training,
          }),
          /completed session/,
        );
        await assert.rejects(
          db.query(
            "update training_sessions set status='Scheduled' where id=$1",
            [session],
          ),
          /History exists/,
        );
        await assert.rejects(
          db.query("update training_history set participants=-1 where id=$1", [
            main.history.id,
          ]),
          /check constraint/,
        );
        await assert.rejects(
          db
            .query("delete from training_sessions where id=$1", [session])
            .then((r) => {
              if (!r.affectedRows) throw new Error("delete denied by RLS");
            }),
          /denied|foreign key/,
        );
      },
    );
    await t.test(
      "Operations completion timestamps follow status without touching unrelated activities",
      async () => {
        await as("operations");
        assert.equal(
          (
            await db.query<{ recorded: boolean }>(
              "select completed_at is not null as recorded from activities where department='operations' and status='Completed'",
            )
          ).rows[0].recorded,
          true,
        );
      },
    );
    await t.test(
      "All ten sections support persisted updates and reject stale versions",
      async () => {
        for (const [key, entry] of Object.entries(main)) {
          await as(
            ["campaign", "content", "asset"].includes(key)
              ? "marketing"
              : ["task", "project", "quality", "followup"].includes(key)
                ? "operations"
                : "training",
          );
          const before = (
            await db.query<{ revision: number }>(
              `select revision from ${entry.table} where id=$1`,
              [entry.id],
            )
          ).rows[0].revision;
          const updated = await db.query<{ revision: number }>(
            `update ${entry.table} set ${entry.field}=$1 where id=$2 and revision=$3 returning revision`,
            [entry.next, entry.id, before],
          );
          assert.equal(updated.rows[0].revision, before + 1);
          assert.equal(
            (
              await db.query<{ value: string }>(
                `select ${entry.field} as value from ${entry.table} where id=$1`,
                [entry.id],
              )
            ).rows[0].value,
            entry.next,
          );
          assert.equal(
            (
              await db.query(
                `update ${entry.table} set ${entry.field}=$1 where id=$2 and revision=$3 returning id`,
                ["Stale editor", entry.id, before],
              )
            ).rows.length,
            0,
          );
        }
      },
    );
    await t.test(
      "Module roles cannot read other departments, forge ownership or change protected system columns",
      async () => {
        for (const user of [
          "marketing",
          "operations",
          "training",
          "sales",
        ] as const) {
          await as(user);
          for (const [dept, table] of [
            ["marketing", "marketing_campaigns_list"],
            ["operations", "operations_tasks_list"],
            ["training", "training_sessions_list"],
          ])
            if (user !== dept) {
              assert.equal(
                (await db.query(`select * from ${table}`)).rows.length,
                0,
              );
              await assert.rejects(
                db.query("select department_overview($1,'2026-10-27')", [dept]),
                /Department access required/,
              );
            }
        }
        await as("marketing");
        await assert.rejects(
          insert("marketing_campaigns", {
            name: "Forged owner",
            platform: "Email",
            start_date: "2026-01-01",
            end_date: "2026-12-31",
            status: "Draft",
            assigned_to: ids.marketing,
            owner_id: ids.administrator,
          }),
          /row-level security/,
        );
        for (const entry of Object.values(main)) {
          await assert.rejects(
            db.query(`update ${entry.table} set owner_id=$1`, [
              ids.administrator,
            ]),
            /permission denied/,
          );
          await assert.rejects(
            db.query(`update ${entry.table} set revision=999`),
            /permission denied/,
          );
        }
        await assert.rejects(
          db.query("insert into user_roles values($1,'administrator')", [
            ids.marketing,
          ]),
          /permission denied/,
        );
        await as("management");
        for (const dept of ["marketing", "operations", "training"]) {
          const r = await db.query<{ allowed: boolean }>(
            "select has_permission($1) as allowed",
            [dept + ".read"],
          );
          assert.equal(r.rows[0].allowed, true);
          assert.equal(
            (
              await db.query<{ allowed: boolean }>(
                "select has_permission($1) as allowed",
                [dept + ".delete"],
              )
            ).rows[0].allowed,
            false,
          );
        }
      },
    );
    await t.test(
      "Shared catalog access does not grant Sales access or break existing Sales persistence",
      async () => {
        await as("marketing");
        assert.equal(
          (await db.query("select * from sales_opportunities")).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "update products set name='Forbidden rename' where id=$1 returning id",
              [product],
            )
          ).rows.length,
          0,
        );
        await as("sales");
        const opportunity = await insert("sales_opportunities", {
          name: "Preserved Sales opportunity",
          account_id: account,
          product_id: product,
          date: "2026-10-01",
          stage: "New",
          owner_id: ids.sales,
        });
        assert.ok(opportunity);
        const r = await db.query<{ metrics: { active_opportunities: number } }>(
          "select sales_overview('2026-10-27') as metrics",
        );
        assert.equal(r.rows[0].metrics.active_opportunities, 1);
      },
    );
    await t.test(
      "Anonymous, inactive and unprofiled users cannot view module data or indicators",
      async () => {
        for (const user of ["inactive", "outsider"] as const) {
          await as(user);
          for (const table of [
            "marketing_campaigns_list",
            "operations_tasks_list",
            "training_history_list",
          ])
            assert.equal(
              (await db.query(`select * from ${table}`)).rows.length,
              0,
            );
          for (const dept of ["marketing", "operations", "training"])
            await assert.rejects(
              db.query("select department_overview($1)", [dept]),
              /Department access required/,
            );
        }
        await as("anon");
        for (const table of [
          "marketing_campaigns_list",
          "operations_tasks_list",
          "training_history_list",
        ])
          await assert.rejects(
            db.query(`select * from ${table}`),
            /permission denied/,
          );
      },
    );
    await t.test(
      "All ten record types support administrator deletion with immutable audit history",
      async () => {
        await as("marketing");
        assert.equal(
          (
            await db.query(
              "delete from marketing_campaigns where id=$1 returning id",
              [main.campaign.id],
            )
          ).rows.length,
          0,
        );
        await as("administrator");
        for (const key of [
          "quality",
          "task",
          "followup",
          "history",
          "registration",
          "session",
          "project",
          "asset",
          "content",
          "campaign",
        ]) {
          const entry = main[key];
          assert.equal(
            (
              await db.query(
                `delete from ${entry.table} where id=$1 and revision=1 returning id`,
                [entry.id],
              )
            ).rows.length,
            0,
          );
          assert.equal(
            (
              await db.query(
                `delete from ${entry.table} where id=$1 returning id`,
                [entry.id],
              )
            ).rows.length,
            1,
          );
          const audit = await db.query<{ action: string }>(
            "select action from audit_records where record_id=$1 order by id",
            [entry.id],
          );
          assert.deepEqual(
            audit.rows.map((r) => r.action),
            ["INSERT", "UPDATE", "DELETE"],
          );
        }
        await assert.rejects(
          db.query("delete from audit_records"),
          /permission denied/,
        );
        await db.exec("reset role");
        assert.equal(
          (
            await db.query<{ title: string }>(
              "select title from activities where id=$1",
              [legacy],
            )
          ).rows[0].title,
          "Existing unrelated activity",
        );
      },
    );
  } finally {
    await db.close();
  }
});
