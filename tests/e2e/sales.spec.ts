import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const spec = JSON.parse(
  readFileSync("docs/specifications/justech-sales.json", "utf8"),
);
const base = "/modules/justech-sales";
const sections = [
  {
    path: "opportunities",
    sheet: "JS - Opportunities",
    singular: "opportunity",
  },
  {
    path: "subscriptions?kind=Turnitin",
    sheet: "JS - Turnitin Subscriptions",
    singular: "subscription",
  },
  {
    path: "subscriptions?kind=Other",
    sheet: "JS - Other Subscriptions",
    singular: "subscription",
  },
  { path: "renewals", sheet: "JS - Renewals", singular: "renewal" },
];
test("Sales tables retain every workbook column and approved subscription additions", async ({
  page,
}) => {
  for (const section of sections) {
    await page.goto(`${base}/${section.path}`);
    const expected =
      section.singular === "subscription"
        ? [
            ...spec[section.sheet].slice(0, 2),
            "Creation Date",
            "Payment Status",
            ...spec[section.sheet].slice(2),
            "Annual Amount",
            "Currency",
          ]
        : spec[section.sheet];
    await expect(page.locator(".sales-table th")).toHaveText(expected);
    await expect(
      page.getByRole("button", { name: "Export CSV" }),
    ).toBeDisabled();
    await expect(page.getByText("Planned module", { exact: true })).toHaveCount(
      0,
    );
  }
});
test("each Sales form opens in the existing shell and saving requires permissions", async ({
  page,
}) => {
  for (const section of sections) {
    await page.goto(`${base}/${section.path}`);
    await page
      .getByRole("link", { name: `New ${section.singular}`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: `New ${section.singular}`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `Create ${section.singular}`,
        exact: true,
      }),
    ).toBeDisabled();
    const names =
      section.singular === "subscription"
        ? [
            ...spec[section.sheet].slice(0, 2),
            "Creation Date",
            "Payment Status",
            ...spec[section.sheet].slice(2),
            "Annual Amount",
            "Currency",
          ]
        : spec[section.sheet];
    for (const name of names)
      await expect(
        page.locator(".sales-form label").filter({ hasText: name }).first(),
      ).toBeVisible();
    await expect(page.locator(".brand").first()).toBeAttached();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("year selector and currency-separated zero revenue work without fake records", async ({
  page,
}) => {
  await page.goto(`${base}/overview`);
  for (const label of spec["JS - Overview"].filter(
    (v: string) => v !== "Pending Quotations",
  ))
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  await expect(page.locator(".sales-currency-values strong")).toHaveText([
    "0",
    "0",
    "0",
  ]);
  await expect(page.locator(".sales-currency-values span")).toHaveText([
    "TND",
    "EUR",
    "USD",
  ]);
  await page.getByLabel("Revenue year").fill("2027");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(page).toHaveURL(/year=2027/);
  await expect(page.locator(".sales-revenue .badge")).toHaveText("2027");
});
test("filters and subscription tabs remain simple and preserve their section", async ({
  page,
}) => {
  await page.goto(`${base}/subscriptions?kind=Other`);
  await page
    .getByRole("searchbox", { name: "Search", exact: true })
    .fill("institution");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/kind=Other/);
  await expect(page).toHaveURL(/q=institution/);
  await expect(
    page.getByRole("link", { name: "Other Subscriptions", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page
    .getByRole("link", { name: "Turnitin Subscriptions", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Turnitin Subscriptions / Renewals" }),
  ).toBeVisible();
});
test("Caution table scrolls inside its panel without page overflow", async ({
  page,
}) => {
  await page.goto(`${base}/quotations`);
  const region = page.getByRole("region", { name: "Caution table" });
  const first = page.getByRole("columnheader", { name: "LCID", exact: true });
  const before = await first.boundingBox();
  await region.evaluate((el) => {
    el.scrollLeft = 600;
  });
  const after = await first.boundingBox();
  expect(Math.abs((before?.x ?? 0) - (after?.x ?? 0))).toBeLessThan(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("Sales APIs and forged form submissions are rejected without employee access", async ({
  page,
}) => {
  for (const path of [
    "/api/sales/lookups?entity=products",
    "/api/sales/lookups?entity=accounts",
    "/api/sales/export?section=quotations",
  ]) {
    const r = await page.request.get(path);
    expect(r.status()).toBe(401);
  }
  const denied = await page.request.post(`${base}/opportunities?new=1`, {
    form: { name: "Forged request", owner_id: "forged" },
  });
  expect(denied.status()).toBe(401);
  expect((await denied.json()).error).toContain("No record was saved");
  const healthy = await page.request.get(`${base}/overview`);
  expect(healthy.status()).toBe(200);
});
test("shared product management stays inside Sales and Al-Fikr is implemented", async ({
  page,
}) => {
  await page.goto(`${base}/subscriptions?catalog=1`);
  await expect(
    page.getByRole("heading", { name: "Product catalog", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add product", exact: true }),
  ).toBeDisabled();
  await page.goto("/modules/alfikr-marketing/overview");
  await expect(page.getByText("Planned module", { exact: true })).toHaveCount(
    0,
  );
});
