import test from "node:test";
import assert from "node:assert/strict";
import { invoiceSchema } from "../src/lib/finance/config";
import { validateSales } from "../src/lib/sales/validation";
import { getSection } from "../src/lib/departments/config";
import { validate } from "../src/lib/departments/validation";
import { navigation, safeReturnPath } from "../src/lib/navigation";
const account_id = "11111111-1111-4111-8111-111111111111",
  product_id = "22222222-2222-4222-8222-222222222222";
test("Supplier invoices validate money, currencies, dates and strip forged private metadata", () => {
  const data = {
    invoice_number: " SUP-1 ",
    supplier: "Supplier",
    product_service: "Service",
    invoice_date: "2026-10-01",
    due_date: "2026-10-31",
    amount: "100.005",
    currency: "eur",
    payment_status: "Unpaid",
    notes: "",
    owner_id: account_id,
    file_path: "attack",
    revision: 99,
  };
  const r = invoiceSchema.safeParse(data);
  assert.ok(r.success);
  if (r.success) {
    assert.equal(r.data.currency, "EUR");
    assert.equal(r.data.invoice_number, "SUP-1");
    assert.equal("file_path" in r.data, false);
    assert.equal("owner_id" in r.data, false);
  }
  for (const change of [
    { amount: "-1" },
    { amount: "1.1234" },
    { currency: "EU" },
    { due_date: "2026-09-30" },
    { invoice_date: "2026-02-30" },
    { payment_status: "Unknown" },
  ])
    assert.equal(
      invoiceSchema.safeParse({ ...data, ...change }).success,
      false,
    );
});
test("Payments keep decimal strings, validate subscription IDs and discard forged ownership", () => {
  const data = {
    account_id,
    product_id,
    subscription_id: "",
    invoice_reference: "INV-1",
    amount: "250.005",
    currency: "tnd",
    payment_date: "2026-10-28",
    payment_method: "Bank transfer",
    payment_status: "Partially Paid",
    notes: "",
    owner_id: account_id,
  };
  const r = validateSales("payments", data);
  assert.ok(r.success);
  if (r.success && "subscription_id" in r.data) {
    assert.equal(r.data.subscription_id, null);
    assert.equal(r.data.amount, "250.005");
    assert.equal("owner_id" in r.data, false);
  }
  for (const change of [
    { subscription_id: "invalid" },
    { currency: "" },
    { payment_status: "Pending" },
    { amount: "1e3" },
    { payment_date: "2026-02-30" },
  ])
    assert.equal(
      validateSales("payments", { ...data, ...change }).success,
      false,
    );
});
test("Caution exposes exactly the eight new fields and ignores hidden legacy-column submissions", () => {
  const section = getSection("operations", "caution")!;
  assert.deepEqual(
    section.fields.map((f) => f.label),
    [
      "LCID",
      "NOM",
      "COMPTENO",
      "AMOUNT",
      "Customer",
      "Product",
      "Subscription Period",
      "Refunded",
    ],
  );
  const r = validate(section, {
    lcid: "LC-1",
    nom: "Name",
    compte_no: "001",
    amount: "100.123",
    account_id,
    product_id,
    subscription_period: "2026",
    refunded: "Yes",
    ccy: "EUR",
    client: "forged",
  });
  assert.ok(r.success);
  if (r.success) {
    assert.equal("ccy" in r.data, false);
    assert.equal("client" in r.data, false);
  }
});
test("Navigation moves Caution to Operations and combines subscription and renewal navigation", () => {
  const justech = navigation.find((g) => g.label === "Justech")!;
  const sales = justech.items.find((i) => i.label === "Sales")!;
  assert.deepEqual(
    sales.children?.map((i) => i.label),
    ["Overview", "Opportunities", "Subscriptions / Renewals", "Payments"],
  );
  assert.ok(
    justech.items
      .find((i) => i.label === "Operations")
      ?.children?.some((i) => i.label === "Caution"),
  );
  assert.equal(safeReturnPath("//bad.invalid"), "/");
});
