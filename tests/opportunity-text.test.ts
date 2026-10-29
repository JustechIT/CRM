import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { latestDatabase, ids } from "./helpers/latest-db";
import { alfikrSections } from "../src/lib/alfikr/config";
import { validate } from "../src/lib/departments/validation";
import { salesCsv } from "../src/lib/sales/csv";
import { validateSales } from "../src/lib/sales/validation";

test("Both opportunity forms accept real organization text and keep other reference validation", () => {
  const raw = {
    organization_name: "  Université d'Été — Tunis  ",
    product_id: ids.root,
    name: "Opportunity",
    date: "2026-10-29",
    due_date: "",
    value: "",
    stage: "New",
    action_type: "",
    expected_close: "",
    note: "",
    notes: "",
    account_id: "forged",
  };
  const section = alfikrSections.find((s) => s.slug === "opportunities")!;
  const exported = salesCsv("opportunities", [
    { ...raw, organization_name: "Université d'Été — Tunis" },
  ]);
  assert.ok(exported.includes("Université d'Été — Tunis"));
  assert.ok(exported.includes('"Organization"'));
  for (const check of [
    (value: typeof raw) => validateSales("opportunities", value),
    (value: typeof raw) => validate(section, value),
  ]) {
    const result = check(raw);
    assert.ok(result.success);
    if (result.success) {
      assert.equal(
        "organization_name" in result.data
          ? result.data.organization_name
          : null,
        "Université d'Été — Tunis",
      );
      assert.equal("account_id" in result.data, false);
    }
    assert.equal(check({ ...raw, organization_name: "  " }).success, false);
    assert.equal(
      check({ ...raw, organization_name: "x".repeat(251) }).success,
      false,
    );
    assert.equal(check({ ...raw, product_id: "not-a-product" }).success, false);
  }
});

test("Organization-text migration preserves legacy rows and relationships and supports persistent typed opportunities without duplicate accounts", async () => {
  const { db, as, insert } = await latestDatabase("0014");
  try {
    await as(ids.root);
    const account = await insert("accounts", {
      name: "Existing organization",
      institution_type: "University",
      business: "Both",
      owner_id: ids.root,
    });
    const product = (
      await db.query<{ id: string }>(
        "select create_alfikr_product('Shared product') as id",
      )
    ).rows[0].id;
    // One shared product keeps both modules' original product checks intact.
    await db.exec("reset role");
    await db.query("update products set business='Both' where id=$1", [
      product,
    ]);
    await as(ids.root);
    const legacy: {
      table: string;
      id: string;
      before: Record<string, unknown>;
    }[] = [];
    for (const table of ["sales_opportunities", "alfikr_sales_opportunities"]) {
      const id = await insert(table, {
        account_id: account,
        product_id: product,
        name: "Existing opportunity",
        date: "2026-10-29",
        stage: "New",
        owner_id: ids.root,
      });
      const before = (
        await db.query<{ row: Record<string, unknown> }>(
          `select to_jsonb(s) as row from ${table} s where id=$1`,
          [id],
        )
      ).rows[0].row;
      legacy.push({ table, id, before });
    }
    await db.exec("reset role");
    await db.exec(
      "create view legacy_opportunity_report as select id,account_name from sales_opportunities_list",
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/0015_opportunity_organization_text.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await as(ids.root);
    for (const { table, id, before } of legacy) {
      const after = (
        await db.query<{ row: Record<string, unknown> }>(
          `select to_jsonb(s) as row from ${table} s where id=$1`,
          [id],
        )
      ).rows[0].row;
      assert.deepEqual(after, { ...before, organization_name: "" });
      const display = (
        await db.query<{ organization_name: string }>(
          `select organization_name from ${table}_list where id=$1`,
          [id],
        )
      ).rows[0];
      assert.equal(display.organization_name, "Existing organization");
      await db.query(
        `update ${table} set organization_name='Revised organization text' where id=$1`,
        [id],
      );
      assert.equal(
        (
          await db.query<{ account_id: string }>(
            `select account_id from ${table} where id=$1`,
            [id],
          )
        ).rows[0].account_id,
        account,
      );
      const created = await insert(table, {
        organization_name: "Université d'Été — Tunis",
        product_id: product,
        name: "Typed organization",
        date: "2026-10-29",
        stage: "New",
        owner_id: ids.root,
      });
      const saved = (
        await db.query<{
          organization_name: string;
          account_id: string | null;
        }>(
          `select organization_name,account_id from ${table}_list where id=$1 and search_text ilike '%Université%' order by organization_name`,
          [created],
        )
      ).rows[0];
      assert.equal(saved.organization_name, "Université d'Été — Tunis");
      assert.equal(saved.account_id, null);
      await assert.rejects(
        insert(table, {
          organization_name: " ",
          product_id: product,
          name: "Invalid",
          date: "2026-10-29",
          stage: "New",
          owner_id: ids.root,
        }),
      );
      await assert.rejects(
        db.query(`update ${table} set organization_name=$1 where id=$2`, [
          "x".repeat(251),
          created,
        ]),
      );
      await as(ids.viewer);
      assert.equal(
        (
          await db.query(
            `update ${table} set organization_name='Forbidden' where id=$1 returning id`,
            [created],
          )
        ).rows.length,
        0,
      );
      await as(null);
      await assert.rejects(db.query(`select * from ${table}_list`));
      await as(ids.root);
    }
    assert.equal(
      (
        await db.query(
          "select * from accounts where name='Existing organization'",
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from accounts where name like '%Université%'"))
        .rows.length,
      0,
    );
    await db.exec("reset role");
    assert.equal(
      (await db.query("select * from legacy_opportunity_report")).rows.length,
      2,
    );
    const constraints = await db.query<{ is_nullable: string }>(
      "select is_nullable from information_schema.columns where table_schema='public' and table_name in ('sales_subscriptions','alfikr_sales_subscriptions') and column_name='account_id'",
    );
    assert.equal(constraints.rows.length, 2);
    assert.ok(constraints.rows.every((c) => c.is_nullable === "NO"));
  } finally {
    await db.close();
  }
});
