import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const admin = "11111111-1111-4111-8111-111111111111",
  sales = "22222222-2222-4222-8222-222222222222",
  ops = "33333333-3333-4333-8333-333333333333",
  souhail = "44444444-4444-4444-8444-444444444444",
  bj = "55555555-5555-4555-8555-555555555555",
  ahmed = "66666666-6666-4666-8666-666666666666";
test("Additive finance migrations preserve Sales and enforce private account access", async (t) => {
  const db = new PGlite();
  const as = async (id: string | null) =>
    db.exec(
      `reset role;select set_config('request.jwt.claim.sub','${id ?? ""}',false);set role ${id ? "authenticated" : "anon"};`,
    );
  const count = async (table: string) =>
    (await db.query<{ n: number }>(`select count(*)::int n from ${table}`))
      .rows[0].n;
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon;grant select,insert,delete on storage.objects to authenticated;grant select on storage.objects to anon;create policy unrelated_broad_read on storage.objects for select to anon,authenticated using(true);`);
    const migrate = async (file: string) =>
      db.exec(
        await readFile(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    for (const file of [
      "0001_crm.sql",
      "0002_justech_sales.sql",
      "0003_justech_marketing.sql",
      "0004_justech_operations.sql",
      "0005_justech_training.sql",
    ])
      await migrate(file);
    for (const [id, email, role] of [
      [admin, "unrelated-admin@example.invalid", "administrator"],
      [sales, "sales@example.invalid", "sales"],
      [ops, "ops@example.invalid", "operations"],
      [souhail, "souhail@justech.tn", "sales"],
      [bj, "bj@justech.tn", "marketing"],
      [ahmed, "ahmed.hammami@justech.tn", "training"],
    ]) {
      await db.query("insert into auth.users values($1,$2)", [id, email]);
      await db.query(
        "insert into employee_profiles(id,full_name) values($1,$2)",
        [id, email],
      );
      await db.query("insert into user_roles values($1,$2)", [id, role]);
    }
    const account = (
      await db.query<{ id: string }>(
        "insert into accounts(name,institution_type,owner_id) values('Test customer','University',$1) returning id",
        [admin],
      )
    ).rows[0].id;
    const product = (
      await db.query<{ id: string }>(
        "insert into products(name,subscription_kind,owner_id) values('Test product','Other',$1) returning id",
        [admin],
      )
    ).rows[0].id;
    const quotation = (
      await db.query<{ id: string }>(
        "insert into sales_quotations(lcid,type,client,nom,ref_eng,compte_no,ccy,amount,drawings,account_id,product_id,owner_id) values('LC-OLD','Legacy type','Legacy client','Legacy name','Legacy reference','123','TND',100,7,$1,$2,$3) returning id",
        [account, product, admin],
      )
    ).rows[0].id;
    const subscription = (
      await db.query<{ id: string }>(
        "insert into sales_subscriptions(account_id,product_id,start_date,end_date,contract_duration,status,kind,annual_amount,currency,owner_id) values($1,$2,'2026-01-01','2026-12-31','Annual','Active','Other',1000,'TND',$3) returning id",
        [account, product, admin],
      )
    ).rows[0].id;
    const renewal = (
      await db.query<{ id: string }>(
        "insert into sales_renewals(account_id,product_id,expiry_date,renewal_stage,next_action,owner_id) values($1,$2,'2026-12-31','Contacted','Keep this follow-up',$3) returning id",
        [account, product, admin],
      )
    ).rows[0].id;
    for (const file of [
      "0006_sales_payments_caution.sql",
      "0007_private_supplier_invoices.sql",
      "0008_supplier_invoice_storage.sql",
    ])
      await migrate(file);
    await t.test(
      "Caution retains IDs, hidden legacy fields and numeric amount; Operations replaces Sales access",
      async () => {
        await as(ops);
        assert.equal(await count("operations_caution_list"), 1);
        await db.query(
          "update sales_quotations set refunded='Yes',nom='Changed name',amount=123.456 where id=$1",
          [quotation],
        );
        await assert.rejects(
          db.query(
            "update sales_quotations set client='overwrite' where id=$1",
            [quotation],
          ),
          /permission denied/,
        );
        await db.query(
          "insert into sales_quotations(lcid,nom,amount,account_id,product_id,refunded,owner_id) values('LC-NEW','New',200,$1,$2,'No',$3)",
          [account, product, ops],
        );
        await assert.rejects(
          db.query("update sales_quotations set refunded='Maybe'"),
          /check constraint/,
        );
        await as(sales);
        assert.equal(await count("sales_quotations"), 0);
        await assert.rejects(
          db.query(
            "insert into sales_quotations(lcid,amount,account_id,product_id,owner_id) values('DENIED',1,$1,$2,$3)",
            [account, product, sales],
          ),
          /row-level security/,
        );
        await db.exec("reset role");
        const old = (
          await db.query<Record<string, unknown>>(
            "select * from sales_quotations where id=$1",
            [quotation],
          )
        ).rows[0];
        assert.equal(old.client, "Legacy client");
        assert.equal(old.type, "Legacy type");
        assert.equal(old.ccy, "TND");
        assert.equal(old.ref_eng, "Legacy reference");
        assert.equal(Number(old.drawings), 7);
        assert.equal(Number(old.amount), 123.456);
      },
    );
    let payment = "";
    await t.test(
      "Payments CRUD, matching references, currency-safe balances and old renewals remain usable",
      async () => {
        await as(sales);
        const s = (
          await db.query<{
            creation_date: string;
            payment_status: string;
            received_amount: string;
            remaining_balance: string;
          }>("select * from sales_subscriptions_list where id=$1", [
            subscription,
          ])
        ).rows[0];
        assert.ok(s.creation_date);
        assert.equal(s.payment_status, "Unpaid");
        assert.equal(Number(s.received_amount), 0);
        assert.equal(Number(s.remaining_balance), 1000);
        assert.equal(
          (
            await db.query<{ next_action: string }>(
              "select next_action from sales_renewals where id=$1",
              [renewal],
            )
          ).rows[0].next_action,
          "Keep this follow-up",
        );
        payment = (
          await db.query<{ id: string }>(
            "insert into sales_payments(account_id,product_id,subscription_id,invoice_reference,amount,currency,payment_date,payment_method,payment_status,owner_id) values($1,$2,$3,'PAY-1',250,'TND','2026-10-28','Bank transfer','Partially Paid',$4) returning id",
            [account, product, subscription, sales],
          )
        ).rows[0].id;
        await assert.rejects(
          db.query(
            "insert into sales_payments(account_id,product_id,subscription_id,invoice_reference,amount,currency,payment_date,payment_method,payment_status,owner_id) values($1,$2,$3,'WRONG',10,'USD','2026-10-28','Cash','Paid',$4)",
            [account, product, subscription, sales],
          ),
          /must match/,
        );
        await db.query(
          "insert into sales_payments(account_id,product_id,subscription_id,invoice_reference,amount,currency,payment_date,payment_method,payment_status,owner_id) values($1,$2,$3,'UNPAID',999,'TND','2026-10-28','Cash','Unpaid',$4)",
          [account, product, subscription, sales],
        );
        let v = (
          await db.query<{ remaining_balance: string }>(
            "select remaining_balance from sales_subscriptions_list where id=$1",
            [subscription],
          )
        ).rows[0];
        assert.equal(Number(v.remaining_balance), 750);
        await db.query("update sales_payments set amount=300 where id=$1", [
          payment,
        ]);
        v = (
          await db.query<{ remaining_balance: string }>(
            "select remaining_balance from sales_subscriptions_list where id=$1",
            [subscription],
          )
        ).rows[0];
        assert.equal(Number(v.remaining_balance), 700);
        await assert.rejects(
          db.query(
            "update sales_subscriptions set currency='USD' where id=$1",
            [subscription],
          ),
          /Reassign linked payments/,
        );
        assert.equal(
          (
            await db.query(
              "delete from sales_subscriptions where id=$1 returning id",
              [subscription],
            )
          ).rows.length,
          0,
        );
      },
    );
    await t.test(
      "No account including Administrator has private access before explicit bootstrap",
      async () => {
        for (const id of [admin, sales, ops, souhail, bj, ahmed]) {
          await as(id);
          assert.equal(
            (
              await db.query<{ ok: boolean }>(
                "select supplier_invoice_allowed() ok",
              )
            ).rows[0].ok,
            false,
          );
          assert.equal(await count("supplier_invoices"), 0);
          await assert.rejects(
            db.query(
              "insert into supplier_invoice_access(user_id) values($1)",
              [id],
            ),
            /permission denied/,
          );
          await assert.rejects(
            db.query("select set_supplier_invoice_access($1,true)", [id]),
            /access manager required/,
          );
        }
      },
    );
    await db.exec("reset role");
    await db.exec(
      await readFile(
        new URL("../docs/setup/supplier-invoice-access.sql", import.meta.url),
        "utf8",
      ),
    );
    let invoice = "";
    await t.test(
      "Only the three identified users have invoice CRUD; only Souhail can manage grants",
      async () => {
        for (const id of [souhail, bj, ahmed]) {
          await as(id);
          assert.equal(
            (
              await db.query<{ ok: boolean }>(
                "select supplier_invoice_allowed() ok",
              )
            ).rows[0].ok,
            true,
          );
          assert.equal(
            (
              await db.query<{ ok: boolean }>(
                "select supplier_invoice_allowed(true) ok",
              )
            ).rows[0].ok,
            id === souhail,
          );
        }
        await as(bj);
        invoice = (
          await db.query<{ id: string }>(
            "insert into supplier_invoices(invoice_number,supplier,product_service,invoice_date,due_date,amount,currency,payment_status,owner_id) values('SUP-1','Private supplier','Service','2026-10-01','2026-10-31',500,'EUR','Unpaid',$1) returning id",
            [bj],
          )
        ).rows[0].id;
        await db.query(
          "update supplier_invoices set notes='Retained private note' where id=$1",
          [invoice],
        );
        await assert.rejects(
          db.query("select set_supplier_invoice_access($1,true)", [admin]),
          /access manager required/,
        );
        await as(admin);
        assert.equal(await count("supplier_invoices"), 0);
        assert.equal(
          await count("audit_records where entity='supplier_invoices'"),
          0,
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
          (await db.query("delete from supplier_invoices returning id")).rows
            .length,
          0,
        );
        await as(souhail);
        await db.query("select set_supplier_invoice_access($1,true)", [admin]);
        await as(admin);
        assert.equal(await count("supplier_invoices"), 1);
        await assert.rejects(
          db.query("select set_supplier_invoice_access($1,true)", [sales]),
          /access manager required/,
        );
        await as(souhail);
        await db.query("select set_supplier_invoice_access($1,false)", [admin]);
        await as(admin);
        assert.equal(await count("supplier_invoices"), 0);
        await as(souhail);
        await assert.rejects(
          db.query("select set_supplier_invoice_access($1,false)", [souhail]),
          /own access/,
        );
      },
    );
    await t.test(
      "Private storage is locked to authorized active accounts; revocation immediately removes access",
      async () => {
        await as(bj);
        await db.query(
          "insert into storage.objects(bucket_id,name) values('supplier-invoices',$1)",
          [invoice + "/test.pdf"],
        );
        await db.query(
          "update supplier_invoices set file_path=$1,file_name='invoice.pdf' where id=$2",
          [invoice + "/test.pdf", invoice],
        );
        assert.equal(await count("storage.objects"), 1);
        await assert.rejects(
          db.query("update supplier_invoices set file_path=$1 where id=$2", [
            admin + "/other.pdf",
            invoice,
          ]),
          /check constraint/,
        );
        for (const id of [admin, sales, ops]) {
          await as(id);
          assert.equal(await count("storage.objects"), 0);
          await assert.rejects(
            db.query(
              "insert into storage.objects(bucket_id,name) values('supplier-invoices',$1)",
              [invoice + "/attack.pdf"],
            ),
            /row-level security/,
          );
          assert.equal(
            (await db.query("delete from storage.objects returning name")).rows
              .length,
            0,
          );
        }
        await as(souhail);
        await db.query("select set_supplier_invoice_access($1,false)", [bj]);
        await as(bj);
        assert.equal(await count("supplier_invoices"), 0);
        assert.equal(await count("storage.objects"), 0);
        await db.exec("reset role");
        await db.query(
          "update employee_profiles set status='inactive' where id=$1",
          [ahmed],
        );
        await as(ahmed);
        assert.equal(await count("supplier_invoices"), 0);
        assert.equal(await count("storage.objects"), 0);
        await as(null);
        await assert.rejects(
          db.query("select * from supplier_invoices"),
          /permission denied/,
        );
        assert.equal(await count("storage.objects"), 0);
      },
    );
    await t.test(
      "Authorized deletes retain audit metadata and Sales payment delete respects role",
      async () => {
        await as(sales);
        assert.equal(
          (await db.query("delete from sales_payments returning id")).rows
            .length,
          0,
        );
        await as(admin);
        await db.query("delete from sales_payments where id=$1", [payment]);
        await as(souhail);
        await db.query("delete from supplier_invoices where id=$1", [invoice]);
        await db.exec("delete from storage.objects");
        assert.equal(await count("supplier_invoices"), 0);
        assert.equal(await count("storage.objects"), 0);
        assert.ok(
          (await count(
            "audit_records where entity='supplier_invoices' and action='DELETE'",
          )) > 0,
        );
      },
    );
  } finally {
    await db.close();
  }
});
