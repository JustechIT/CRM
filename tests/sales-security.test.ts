import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Justech Sales migrations, permissions and real relational workflows", async (t) => {
  const db = new PGlite();
  const sales = "11111111-1111-4111-8111-111111111111",
    admin = "22222222-2222-4222-8222-222222222222",
    marketing = "33333333-3333-4333-8333-333333333333",
    inactive = "44444444-4444-4444-8444-444444444444";
  try {
    await db.exec(
      "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to authenticated;",
    );
    for (const file of ["0001_crm.sql", "0002_justech_sales.sql"])
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    for (const [id, role] of [
      [sales, "sales"],
      [admin, "administrator"],
      [marketing, "marketing"],
      [inactive, "administrator"],
    ]) {
      await db.query("insert into auth.users values($1)", [id]);
      await db.query(
        "insert into employee_profiles(id,full_name,status) values($1,$2,$3)",
        [id, `Synthetic ${role}`, id === inactive ? "inactive" : "active"],
      );
      await db.query("insert into user_roles values($1,$2)", [id, role]);
    }
    const account = (
      await db.query<{ id: string }>(
        "insert into accounts(name,institution_type,owner_id) values('Sales test institution','University',$1) returning id",
        [sales],
      )
    ).rows[0].id;
    const hidden = (
      await db.query<{ id: string }>(
        "insert into products(name,business,subscription_kind,owner_id) values('Al-Fikr test product','Al-Fikr','Other',$1) returning id",
        [sales],
      )
    ).rows[0].id;
    const as = async (id: string, role = "authenticated") =>
      db.exec(
        `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role ${role};`,
      );
    let turnitin = "",
      other = "",
      opportunity = "",
      quotation = "",
      subscription = "",
      renewal = "";
    await t.test(
      "sales employees create products and all exact workbook fields",
      async () => {
        await as(sales);
        turnitin = (
          await db.query<{ id: string }>(
            "insert into products(name,subscription_kind,owner_id) values('Synthetic Turnitin','Turnitin',$1) returning id",
            [sales],
          )
        ).rows[0].id;
        other = (
          await db.query<{ id: string }>(
            "insert into products(name,subscription_kind,owner_id) values('Synthetic Other','Other',$1) returning id",
            [sales],
          )
        ).rows[0].id;
        opportunity = (
          await db.query<{ id: string }>(
            "insert into sales_opportunities(name,account_id,product_id,date,due_date,value,stage,action_type,expected_close,note,owner_id) values('Synthetic opportunity',$1,$2,'2026-10-01','2026-10-10',123.456,'Negotiation','Call','2026-11-01','Test note',$3) returning id",
            [account, turnitin, sales],
          )
        ).rows[0].id;
        await db.query(
          "insert into sales_opportunities(name,account_id,product_id,date,due_date,stage,owner_id) values('Won opportunity',$1,$2,'2026-10-01','2026-10-10','WON',$3)",
          [account, other, sales],
        );
        quotation = (
          await db.query<{ id: string }>(
            "insert into sales_quotations(lcid,type,client,nom,ref_eng,compte_no,ccy,amount,drawings,liability_amount,total_lc,total_liab,total_drawings,account_id,product_id,subscription_period,decision_status,owner_id) values('LC-001','Test type','Legacy client','Legacy NOM','REF-1','000123','TND',100.005,2.001,3.002,400.003,500.004,600.005,$1,$2,'2026–2027','Pending',$3) returning id",
            [account, turnitin, sales],
          )
        ).rows[0].id;
        subscription = (
          await db.query<{ id: string }>(
            "insert into sales_subscriptions(account_id,product_id,start_date,end_date,contract_duration,status,kind,owner_id) values($1,$2,'2026-01-01','2026-12-31','1 year','Active','Turnitin',$3) returning id",
            [account, turnitin, sales],
          )
        ).rows[0].id;
        await db.query(
          "insert into sales_subscriptions(account_id,product_id,start_date,end_date,contract_duration,status,kind,owner_id) values($1,$2,'2026-01-01','2027-12-31','2 years','ACTIVE','Other',$3),($1,$2,'2027-01-01','2027-12-31','1 year','Upcoming','Other',$3)",
          [account, other, sales],
        );
        renewal = (
          await db.query<{ id: string }>(
            "insert into sales_renewals(account_id,product_id,expiry_date,renewal_stage,next_action,follow_up_date,owner_id) values($1,$2,'2026-12-31','Contacted','Arrange a call','2026-10-20',$3) returning id",
            [account, turnitin, sales],
          )
        ).rows[0].id;
        await db.query(
          "insert into sales_renewals(account_id,product_id,expiry_date,renewal_stage,follow_up_date,owner_id) values($1,$2,'2027-12-31','RENEWED','2026-10-20',$3)",
          [account, other, sales],
        );
      },
    );
    await t.test(
      "overview uses actual authorized records and never invents revenue",
      async () => {
        const result = await db.query<{ metrics: Record<string, unknown> }>(
          "select sales_overview('2026-10-27') as metrics",
        );
        assert.deepEqual(result.rows[0].metrics, {
          active_opportunities: 1,
          pending_quotations: 1,
          active_subscriptions: 2,
          upcoming_renewals: 1,
          annual_sales_revenue: { TND: "0", EUR: "0", USD: "0" },
          overdue_follow_ups: 2,
        });
      },
    );
    await t.test(
      "annual revenue separates currencies, selected years and renewed terms",
      async () => {
        await db.query(
          "update sales_subscriptions set annual_amount=100.005,currency='TND' where id=$1",
          [subscription],
        );
        await db.query(
          "update sales_subscriptions set annual_amount=10.001,currency='EUR' where kind='Other' and status='ACTIVE'",
        );
        await db.query(
          "update sales_subscriptions set annual_amount=999,currency='USD' where status='Upcoming'",
        );
        const revenue = async (year: number) =>
          (
            await db.query<{
              metrics: { annual_sales_revenue: Record<string, string> };
            }>("select sales_overview('2026-10-27',$1) as metrics", [year])
          ).rows[0].metrics.annual_sales_revenue;
        assert.deepEqual(await revenue(2026), {
          TND: "100.005",
          EUR: "10.001",
          USD: "0",
        });
        await db.query(
          "insert into sales_subscriptions(account_id,product_id,start_date,end_date,contract_duration,status,kind,annual_amount,currency,owner_id) values($1,$2,'2026-07-01','2027-06-30','1 year','Confirmed','Turnitin',150,'USD',$3),($1,$2,'2026-10-01','2027-09-30','1 year','Cancelled','Turnitin',999,'USD',$3)",
          [account, turnitin, sales],
        );
        assert.deepEqual(await revenue(2026), {
          TND: "0",
          EUR: "10.001",
          USD: "150.000",
        });
        await db.query(
          "insert into sales_renewals(account_id,product_id,expiry_date,renewal_stage,owner_id) values($1,$2,'2027-06-30','Renewed',$3)",
          [account, turnitin, sales],
        );
        assert.deepEqual(await revenue(2026), {
          TND: "0",
          EUR: "10.001",
          USD: "150.000",
        });
        assert.deepEqual(await revenue(2025), { TND: "0", EUR: "0", USD: "0" });
        assert.deepEqual(await revenue(2028), { TND: "0", EUR: "0", USD: "0" });
        // A newer unpriced confirmed term must not silently reuse the previous price.
        await db.query(
          "insert into sales_subscriptions(account_id,product_id,start_date,end_date,contract_duration,status,kind,owner_id) values($1,$2,'2026-11-01','2027-10-31','1 year','Confirmed','Turnitin',$3)",
          [account, turnitin, sales],
        );
        assert.deepEqual(await revenue(2026), {
          TND: "0",
          EUR: "10.001",
          USD: "0",
        });
        await assert.rejects(
          db.query(
            "update sales_subscriptions set annual_amount=1,currency='' where id=$1",
            [subscription],
          ),
          /check constraint/,
        );
      },
    );
    await t.test(
      "legacy financial columns stay independent and decimal precision is retained",
      async () => {
        const r = await db.query<{
          amount: string;
          total_lc: string;
          compte_no: string;
        }>(
          "select amount::text,total_lc::text,compte_no from sales_quotations where id=$1",
          [quotation],
        );
        assert.equal(r.rows[0].amount, "100.005");
        assert.equal(r.rows[0].total_lc, "400.003");
        assert.equal(r.rows[0].compte_no, "000123");
        await assert.rejects(
          db.query(
            "insert into sales_quotations(lcid,ccy,amount,account_id,product_id,owner_id) values('lc-001','TND',1,$1,$2,$3)",
            [account, turnitin, sales],
          ),
          /duplicate key/,
        );
        await assert.rejects(
          db.query("update sales_quotations set amount=-1 where id=$1", [
            quotation,
          ]),
          /check constraint/,
        );
      },
    );
    await t.test(
      "subscription dates, duplicate periods and product categories are enforced",
      async () => {
        await assert.rejects(
          db.query(
            "update sales_subscriptions set end_date='2025-01-01' where id=$1",
            [subscription],
          ),
          /check constraint/,
        );
        await assert.rejects(
          db.query("update sales_subscriptions set kind='Other' where id=$1", [
            subscription,
          ]),
          /product does not belong/,
        );
        await assert.rejects(
          db.query(
            "update products set subscription_kind='Other' where id=$1",
            [turnitin],
          ),
          /current category/,
        );
        await assert.rejects(
          db.query(
            "insert into sales_subscriptions(account_id,product_id,start_date,end_date,contract_duration,status,kind,owner_id) values($1,$2,'2026-01-01','2026-12-31','1 year','Active','Turnitin',$3)",
            [account, turnitin, sales],
          ),
          /duplicate key/,
        );
        await assert.rejects(
          db.query("update sales_opportunities set product_id=$1 where id=$2", [
            hidden,
            opportunity,
          ]),
          /Justech product/,
        );
      },
    );
    await t.test(
      "list views search linked names and retain row security",
      async () => {
        const r = await db.query<{
          account_name: string;
          product_name: string;
        }>(
          "select account_name,product_name from sales_quotations_list where search_text ilike '%Sales test institution%' and search_text ilike '%000123%'",
        );
        assert.equal(r.rows.length, 1);
        assert.equal(r.rows[0].product_name, "Synthetic Turnitin");
        await as(marketing);
        for (const table of [
          "sales_opportunities",
          "sales_quotations_list",
          "sales_subscriptions_list",
          "sales_renewals_list",
          "products",
        ])
          assert.equal(
            (await db.query(`select * from ${table}`)).rows.length,
            0,
          );
        await assert.rejects(
          db.query("select sales_overview('2026-10-27')"),
          /Sales access required/,
        );
        await assert.rejects(
          db.query(
            "insert into products(name,subscription_kind,owner_id) values('Forbidden','Other',$1)",
            [marketing],
          ),
          /row-level security/,
        );
        await as(sales);
      },
    );
    await t.test(
      "forged owners and protected metadata are rejected by PostgreSQL",
      async () => {
        await assert.rejects(
          db.query(
            "insert into products(name,subscription_kind,owner_id) values('Forged','Other',$1)",
            [admin],
          ),
          /row-level security/,
        );
        for (const table of [
          "products",
          "sales_opportunities",
          "sales_quotations",
          "sales_subscriptions",
          "sales_renewals",
        ]) {
          await assert.rejects(
            db.query(`update ${table} set owner_id=$1`, [admin]),
            /permission denied/,
          );
          await assert.rejects(
            db.query(`update ${table} set revision=999`),
            /permission denied/,
          );
        }
        await assert.rejects(
          db.query("insert into user_roles values($1,'administrator')", [
            sales,
          ]),
          /permission denied/,
        );
      },
    );
    await t.test("optimistic concurrency prevents lost updates", async () => {
      const a = await db.query<{ revision: number }>(
        "update sales_opportunities set note='First editor' where id=$1 and revision=1 returning revision",
        [opportunity],
      );
      assert.equal(a.rows[0].revision, 2);
      const b = await db.query(
        "update sales_opportunities set note='Stale editor' where id=$1 and revision=1 returning id",
        [opportunity],
      );
      assert.equal(b.rows.length, 0);
    });
    await t.test(
      "inactive and anonymous identities cannot access Sales",
      async () => {
        await as(inactive);
        assert.equal(
          (await db.query("select * from sales_opportunities_list")).rows
            .length,
          0,
        );
        await assert.rejects(
          db.query("select sales_overview('2026-10-27')"),
          /Sales access required/,
        );
        await as("", "anon");
        await assert.rejects(
          db.query("select * from sales_subscriptions_list"),
          /permission denied/,
        );
        await as(sales);
      },
    );
    await t.test(
      "only administrator deletions succeed, with audit and stale-version protection",
      async () => {
        assert.equal(
          (
            await db.query(
              "delete from sales_renewals where id=$1 returning id",
              [renewal],
            )
          ).rows.length,
          0,
        );
        await as(admin);
        assert.equal(
          (
            await db.query(
              "delete from sales_opportunities where id=$1 and revision=1 returning id",
              [opportunity],
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "delete from sales_renewals where id=$1 and revision=1 returning id",
              [renewal],
            )
          ).rows.length,
          1,
        );
        const audit = await db.query<{ action: string }>(
          "select action from audit_records where record_id=$1 order by id",
          [renewal],
        );
        assert.deepEqual(
          audit.rows.map((r) => r.action),
          ["INSERT", "DELETE"],
        );
        await assert.rejects(
          db.query("delete from audit_records"),
          /permission denied/,
        );
        await assert.rejects(
          db.query("delete from accounts where id=$1", [account]),
          /foreign key/,
        );
      },
    );
  } finally {
    await db.close();
  }
});
