import { test, expect } from "@playwright/test";
test("Caution replaces old quotations routes and provides exact new fields", async ({
  page,
}) => {
  await page.goto("/modules/justech-sales/quotations");
  await expect(page).toHaveURL(/justech-operations\/caution/);
  await expect(page.locator(".department-table th")).toHaveText([
    "LCID",
    "NOM",
    "COMPTENO",
    "AMOUNT",
    "Customer",
    "Product",
    "Subscription Period",
    "Refunded",
  ]);
  await page.getByRole("link", { name: "New caution", exact: true }).click();
  await expect(page.locator('input[name="amount"]')).toHaveAttribute(
    "type",
    "number",
  );
  await expect(page.getByLabel("Refunded")).toHaveValue("No");
  await page.getByLabel("Refunded").selectOption("Yes");
  await expect(page.getByLabel("Refunded")).toHaveValue("Yes");
  await expect(
    page.getByRole("button", { name: "Create caution" }),
  ).toBeDisabled();
});
test("Payments table and form offer subscription linking and payment statuses", async ({
  page,
}) => {
  await page.goto("/modules/justech-sales/payments");
  await expect(page.locator(".sales-table th")).toHaveText([
    "Customer",
    "Product",
    "Invoice / Reference Number",
    "Amount",
    "Currency",
    "Payment Date",
    "Payment Method",
    "Payment Status",
    "Notes",
    "Subscription",
  ]);
  await page.getByRole("link", { name: "New payment", exact: true }).click();
  await expect(page.getByLabel("Payment Status")).toHaveValue("Unpaid");
  await page.getByLabel("Payment Status").selectOption("Paid");
  await expect(page.locator('input[name="payment_date"]')).toHaveAttribute(
    "type",
    "date",
  );
  await expect(
    page.getByRole("combobox", { name: "Subscription", exact: true }),
  ).not.toHaveAttribute("required");
  await expect(
    page.getByRole("button", { name: "Create payment", exact: true }),
  ).toBeDisabled();
});
test("Renewal tracking stays inside subscriptions with legacy links preserved", async ({
  page,
}) => {
  await page.goto("/modules/justech-sales/renewals");
  await expect(page).toHaveURL(/subscriptions\?tracking=1/);
  await expect(
    page.getByRole("navigation", {
      name: "Subscriptions and renewal tracking",
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "New renewal", exact: true }).click();
  await expect(page).toHaveURL(/subscriptions\?.*tracking=1/);
  await expect(
    page.getByRole("heading", { name: "New renewal", exact: true }),
  ).toBeVisible();
  await page.goto("/modules/justech-sales/subscriptions");
  await expect(
    page.getByRole("columnheader", { name: "Creation Date", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Payment Status", exact: true }),
  ).toBeVisible();
});
test("Private invoices are hidden and direct pages APIs files and forged grants deny access", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Supplier Invoices", exact: true }),
  ).toHaveCount(0);
  await page.goto("/finance/supplier-invoices");
  await expect(
    page.getByRole("heading", { name: "Supplier Invoices", exact: true }),
  ).toHaveCount(0);
  const id = "11111111-1111-4111-8111-111111111111";
  for (const path of [
    `/api/finance/supplier-invoices?id=${id}`,
    `/api/finance/supplier-invoices/${id}/file`,
  ]) {
    const r = await page.request.get(path);
    expect(r.status()).toBe(403);
    expect(r.headers()["cache-control"]).toContain("no-store");
  }
  for (const method of ["POST", "PATCH", "DELETE"]) {
    const r = await page.request.fetch("/api/finance/supplier-invoices", {
      method,
      headers: { Origin: "http://127.0.0.1:3000" },
      data: { id },
    });
    expect(r.status()).toBe(403);
  }
  const upload = await page.request.post(
    `/api/finance/supplier-invoices/${id}/file`,
    {
      headers: { Origin: "http://127.0.0.1:3000" },
      multipart: {
        file: {
          name: "test.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-test"),
        },
      },
    },
  );
  expect(upload.status()).toBe(403);
  const grant = await page.request.post("/team", {
    form: { user_id: id, allowed: "true" },
  });
  expect(grant.status()).toBe(401);
  expect((await page.request.get("/")).status()).toBe(200);
});
