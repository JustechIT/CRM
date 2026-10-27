import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { salesDefinitions, overviewIndicators } from "../src/lib/sales/config";
import {
  validateSales,
  contractDuration,
  decimal,
  productSchema,
} from "../src/lib/sales/validation";
import { csvCell, salesCsv } from "../src/lib/sales/csv";
import {
  formatAmount,
  isActiveSubscription,
  isOpenOpportunity,
  isOpenRenewal,
  addDays,
} from "../src/lib/sales/metrics";
const refs = {
  account_id: "11111111-1111-4111-8111-111111111111",
  product_id: "22222222-2222-4222-8222-222222222222",
};
test("Sales column names and ordering match the source workbook plus the user's two approved columns", async () => {
  const spec = JSON.parse(
    await readFile(
      new URL("../docs/specifications/justech-sales.json", import.meta.url),
      "utf8",
    ),
  );
  for (const [section, sheet] of [
    ["opportunities", "JS - Opportunities"],
    ["quotations", "JS - Quotations"],
    ["renewals", "JS - Renewals"],
  ] as const)
    assert.deepEqual(
      salesDefinitions[section].fields.map((f) => f.label),
      spec[sheet],
    );
  for (const sheet of [
    "JS - Turnitin Subscriptions",
    "JS - Other Subscriptions",
  ])
    assert.deepEqual(
      salesDefinitions.subscriptions.fields.map((f) => f.label),
      [...spec[sheet], "Annual Amount", "Currency"],
    );
  assert.deepEqual([...overviewIndicators], spec["JS - Overview"]);
});
test("amount validation preserves exact three-decimal strings and rejects invalid financial input", () => {
  for (const value of ["0", "100.005", "999999999999.999"])
    assert.equal(decimal.parse(value), value);
  for (const value of [
    "-1",
    "1e3",
    "1,000",
    "1.2345",
    "1000000000000",
    "Infinity",
    "NaN",
  ])
    assert.equal(decimal.safeParse(value).success, false);
  assert.equal(formatAmount("999999999999.999"), "999,999,999,999.999");
});
test("opportunities validate required references and real calendar dates; mass-assigned metadata is stripped", () => {
  const value = {
    ...refs,
    name: " New opportunity ",
    date: "2026-10-27",
    due_date: "",
    expected_close: "",
    value: "0",
    stage: "New",
    owner_id: "forged",
    revision: 999,
  };
  const r = validateSales("opportunities", value);
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal("owner_id" in r.data, false);
    assert.equal("revision" in r.data, false);
    assert.equal("name" in r.data ? r.data.name : null, "New opportunity");
  }
  for (const change of [
    { account_id: "" },
    { product_id: "bad" },
    { date: "2026-02-30" },
    { due_date: "2026-10-26" },
    { expected_close: "2026-10-01" },
  ])
    assert.equal(
      validateSales("opportunities", { ...value, ...change }).success,
      false,
    );
});
test("subscription revenue needs a currency, supports zero values and calculates inclusive durations", () => {
  const value = {
    ...refs,
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    contract_duration: "",
    status: "Confirmed",
    kind: "Turnitin",
    annual_amount: "100.005",
    currency: "tnd",
  };
  const r = validateSales("subscriptions", value);
  assert.equal(r.success, true);
  if (r.success && "currency" in r.data) {
    assert.equal(r.data.currency, "TND");
    assert.equal(r.data.contract_duration, "365 days");
  }
  for (const change of [
    { end_date: "2025-12-31" },
    { currency: "" },
    { annual_amount: "-1" },
    { kind: "Invalid" },
  ])
    assert.equal(
      validateSales("subscriptions", { ...value, ...change }).success,
      false,
    );
  assert.equal(
    validateSales("subscriptions", {
      ...value,
      annual_amount: "0",
      currency: "EUR",
    }).success,
    true,
  );
  assert.equal(
    validateSales("subscriptions", {
      ...value,
      annual_amount: "",
      currency: "",
    }).success,
    true,
  );
  assert.equal(contractDuration("2024-01-01", "2024-12-31"), "366 days");
  assert.equal(contractDuration("2026-10-27", "2026-10-27"), "1 day");
});
test("quotation fields stay literal and totals are not silently recalculated", () => {
  const r = validateSales("quotations", {
    ...refs,
    lcid: "LC001",
    client: "Legacy code",
    nom: "Legacy NOM",
    compte_no: "000123",
    ccy: "eur",
    amount: "10.005",
    drawings: "2.001",
    liability_amount: "",
    total_lc: "999.999",
    total_liab: "",
    total_drawings: "",
    decision_status: "Pending",
  });
  assert.equal(r.success, true);
  if (r.success && "total_lc" in r.data) {
    assert.equal(r.data.total_lc, "999.999");
    assert.equal(r.data.compte_no, "000123");
    assert.equal(r.data.ccy, "EUR");
  }
});
test("renewals require existing references and product validation does not accept an arbitrary section", () => {
  assert.equal(
    validateSales("renewals", {
      ...refs,
      expiry_date: "2026-12-31",
      renewal_stage: "Contacted",
      next_action: "Call",
      follow_up_date: "2026-11-01",
    }).success,
    true,
  );
  assert.equal(
    productSchema.safeParse({ name: "Test", subscription_kind: "Other" })
      .success,
    true,
  );
  assert.equal(
    productSchema.safeParse({ name: "", subscription_kind: "Other" }).success,
    false,
  );
  assert.equal(
    productSchema.safeParse({ name: "Test", subscription_kind: "Untrusted" })
      .success,
    false,
  );
});
test("CSV exports preserve workbook headers and neutralize spreadsheet formula injection", () => {
  assert.equal(
    csvCell('He said "yes", then left'),
    '"He said ""yes"", then left"',
  );
  for (const value of ["=HYPERLINK(1)", " +SUM(1)", "\t@SUM(1)", "-1+2"])
    assert.equal(csvCell(value).startsWith("\"'"), true);
  const csv = salesCsv("renewals", [
    {
      account_name: "Example, institution",
      product_name: "Test",
      expiry_date: "2026-12-31",
      renewal_stage: "Contacted",
      next_action: "=malicious",
      follow_up_date: "2026-11-01",
    },
  ]);
  assert.ok(
    csv.startsWith(
      '\uFEFF"Organization","Product","Expiry Date","Renewal Stage","Next Action","Follow-up Date"\r\n',
    ),
  );
  assert.ok(csv.includes('"\'=malicious"'));
});
test("open/closed and UTC date boundaries support consistent Sales indicators", () => {
  assert.equal(isOpenOpportunity(" WON "), false);
  assert.equal(isOpenOpportunity("Negotiation"), true);
  assert.equal(isOpenRenewal("NOT RENEWING"), false);
  assert.equal(
    isActiveSubscription("Active", "2026-01-01", "2026-12-31", "2026-10-27"),
    true,
  );
  assert.equal(
    isActiveSubscription("Cancelled", "2026-01-01", "2026-12-31", "2026-10-27"),
    false,
  );
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("CSV collector handles backend row limits without silently truncating exports", async () => {
  const { collectSalesExport } = await import("../src/lib/sales/export");
  const all = Array.from({ length: 1205 }, (_, i) => ({ id: String(i) }));
  const offsets: number[] = [];
  const rows = await collectSalesExport(async (offset) => {
    offsets.push(offset);
    return { records: all.slice(offset, offset + 500), count: all.length };
  });
  assert.equal(rows.length, 1205);
  assert.deepEqual(offsets, [0, 500, 1000]);
  assert.equal(rows.at(-1)?.id, "1204");
  assert.deepEqual(
    await collectSalesExport(async () => ({ records: [], count: 0 })),
    [],
  );
  await assert.rejects(
    collectSalesExport(async () => ({ records: [], count: 5001 })),
    /exceeds 5,000/,
  );
  await assert.rejects(
    collectSalesExport(async () => ({ records: [], count: 1 })),
    /data changed/,
  );
  await assert.rejects(
    collectSalesExport(async () => ({
      records: [{ id: "1" }, { id: "1" }],
      count: 2,
    })),
    /data changed/,
  );
  await assert.rejects(
    collectSalesExport(async (offset) => ({
      records: [{ id: String(offset) }],
      count: offset ? 3 : 2,
    })),
    /data changed/,
  );
});
