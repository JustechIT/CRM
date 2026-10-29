import { test, expect } from "@playwright/test";
import { alfikrSections } from "../../src/lib/alfikr/config";
test("All seven Al-Fikr tables match their workbook columns and open safe Add forms", async ({
  page,
}) => {
  for (const s of alfikrSections) {
    await page.goto(`/modules/${s.department}/${s.slug}`);
    await expect(page.locator(".department-table th")).toHaveText(
      s.fields.map((f) => f.label),
    );
    await page
      .getByRole("link", { name: `New ${s.singular}`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: `New ${s.singular}`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Create ${s.singular}`, exact: true }),
    ).toBeDisabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("Al-Fikr overviews show six real-data indicators and keep annual currency values separate", async ({
  page,
}) => {
  for (const scope of ["alfikr-sales", "alfikr-marketing", "alfikr-content"]) {
    await page.goto(`/modules/${scope}/overview`);
    await expect(page.locator(".department-indicators > section")).toHaveCount(
      6,
    );
    await expect(page.getByText("Planned module", { exact: true })).toHaveCount(
      0,
    );
  }
  await page.goto("/modules/alfikr-sales/overview");
  await expect(page.locator(".sales-currency-values span")).toHaveText([
    "TND",
    "EUR",
    "USD",
  ]);
  await expect(page.locator(".sales-currency-values strong")).toHaveText([
    "0",
    "0",
    "0",
  ]);
  await page.getByRole("spinbutton", { name: "Year" }).fill("2027");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(page).toHaveURL(/year=2027/);
});
test("Al-Fikr search, status and sorting remain in their own module", async ({
  page,
}) => {
  await page.goto("/modules/alfikr-sales/quotations");
  await page
    .getByRole("searchbox", { name: "Search", exact: true })
    .fill("library");
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("Pending");
  await page
    .getByRole("combobox", { name: "Sort by", exact: true })
    .selectOption("amount");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(page).toHaveURL(/q=library/);
  await expect(page).toHaveURL(/status=Pending/);
  await expect(page).toHaveURL(/sort=amount/);
});
test("Directory import has a real file workflow and a downloadable blank template without preview writes", async ({
  page,
}) => {
  await page.goto("/directory/import");
  await expect(
    page.getByRole("heading", { name: "1. Choose your file", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Read file", exact: true }),
  ).toBeDisabled();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download blank template", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("accounts-template.csv");
  for (const part of ["parse", "preview", "commit"]) {
    const r = await page.request.post(`/api/directory/import/${part}`, {
      headers: { Origin: "http://127.0.0.1:3000" },
      data: { entity: "accounts", owner_id: "forged" },
    });
    expect(r.status()).toBe(403);
  }
});
test("Settings and My Profile are honest account screens; notifications do not invent activity", async ({
  page,
}) => {
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", {
      name: "Appearance & notifications",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save settings", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("no in-app user invitations", { exact: false }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Open My Profile", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "My Profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Sign in to view your profile",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(
    page.getByText("Sign in to see your assigned work and reminders.", {
      exact: true,
    }),
  ).toBeVisible();
});
test("New API endpoints reject unauthorized profile, preference, notification, product and mail requests", async ({
  page,
}) => {
  for (const path of ["/api/preferences", "/api/notifications"])
    expect((await page.request.get(path)).status()).toBe(401);
  expect((await page.request.get("/api/team/readiness")).status()).toBe(403);
  for (const path of [
    "/api/preferences",
    "/api/profile",
    "/api/notifications",
  ]) {
    const r = await page.request.patch(path, {
      headers: { Origin: "http://127.0.0.1:3000" },
      data: { user_id: "forged", role: "super_admin", full_name: "Forged" },
    });
    expect(r.status()).toBe(401);
  }
  expect(
    (
      await page.request.post("/api/alfikr/products", {
        headers: { Origin: "http://127.0.0.1:3000" },
        data: { name: "Forged" },
      })
    ).status(),
  ).toBe(403);
  for (const path of [
    "/modules/alfikr-sales/subscriptions",
    "/modules/alfikr-marketing/campaigns",
    "/modules/alfikr-content/content-catalog",
  ])
    expect(
      (
        await page.request.post(path, { form: { owner_id: "forged" } })
      ).status(),
    ).toBe(401);
  expect((await page.request.get("/")).status()).toBe(200);
});

test("Default invitation callback renders without dropping browser-only tokens", async ({ page }) => {
  await page.goto("/auth/confirm#access_token=synthetic-test-only&refresh_token=synthetic-test-only&type=invite");
  await expect(page.getByRole("heading", { name: "Join your Justech workspace" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept invitation", exact: true })).toBeDisabled();
  await expect(page).toHaveURL(/\/auth\/confirm$/);
  await page.goto("/auth/confirm#error=access_denied&error_code=otp_expired");
  await expect(page.locator(".form-error")).toContainText("expired or was already used");
  await expect(page).toHaveURL(/\/auth\/confirm$/);
});

test("Module access can be applied by group without selecting private invoices or enabling Viewer writes", async ({ page }) => {
  await page.goto("/team?new=1");
  await page.getByRole("button", { name: "View all", exact: true }).click();
  await expect(page.getByText("11 of 11 modules selected.", { exact: false })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Explicitly authorize Supplier Invoices" })).not.toBeChecked();
  await page.getByRole("button", { name: "Clear access", exact: true }).click();
  await page.getByLabel("Apply permissions to").selectOption("justech");
  await page.getByRole("button", { name: "View & edit all", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Justech Sales: write", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Marketing: read", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Al-Fikr Sales: read", exact: true })).not.toBeChecked();
  await page.getByRole("combobox", { name: "Role", exact: true }).selectOption("viewer");
  await expect(page.getByRole("checkbox", { name: "Justech Sales: write", exact: true })).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Full access", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Send invitation", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const response = await page.request.patch("/api/team/invitations", {
    headers: { Origin: "http://127.0.0.1:3000" },
    data: { id: "11111111-1111-4111-8111-111111111111" },
  });
  expect(response.status()).toBe(403);
});

test("Password recovery is reachable from login and rejects expired or unverified links", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot your password?", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Forgot your password?", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send recovery email", exact: true })).toBeDisabled();
  await page.goto("/reset-password");
  await expect(page.getByRole("button", { name: "Save new password", exact: true })).toBeDisabled();
  await page.goto("/login#error=access_denied&error_code=otp_expired&type=recovery");
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.locator(".form-error")).toContainText("expired or was already used");
  await expect(page.getByRole("button", { name: "Save new password", exact: true })).toBeDisabled();
  await page.goto("/#access_token=synthetic-test-only&refresh_token=synthetic-test-only&type=recovery");
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.getByRole("heading", { name: "Reset your password", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save new password", exact: true })).toBeDisabled();
});
