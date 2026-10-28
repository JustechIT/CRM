import { test, expect } from "@playwright/test";

test("safe preview has no fabricated metrics and blocks record creation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A clearer view of your day." }),
  ).toBeVisible();
  await expect(
    page.getByText("Available when this module is connected"),
  ).toHaveCount(4);
  await page.getByRole("link", { name: "New account", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Employee access required" }),
  ).toBeVisible();
  const res = await page.request.get("/api/search?q=test");
  expect(res.status()).toBe(401);
});
test("directory filters and planned import are honest", async ({ page }) => {
  await page.goto("/directory");
  await page
    .getByRole("textbox", { name: "Search accounts" })
    .fill("Test institution");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page).toHaveURL(/q=Test/);
  await page.getByRole("link", { name: "Contacts", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Search contacts" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Import", exact: true }).click();
  await expect(
    page.getByText("Import is not operational in this increment.", {
      exact: false,
    }),
  ).toBeVisible();
});
test("global search supports keyboard access and escape", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Search workspace" }).click();
  await expect(
    page.getByRole("dialog", { name: "Search accounts and contacts" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("dialog", { name: "Search accounts and contacts" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Search accounts and contacts" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("department navigation, pinning and responsive menu work", async ({
  page,
}, info) => {
  await page.goto("/");
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  const nav =
    info.project.name === "mobile"
      ? page.getByRole("dialog", { name: "Mobile navigation" })
      : page.locator("aside.sidebar");
  await nav.getByRole("button", { name: "Sales", exact: true }).first().click();
  await nav
    .getByRole("link", { name: "Subscriptions / Renewals", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Turnitin Subscriptions / Renewals",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", {
      name: "Turnitin Subscriptions / Renewals table",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pin current page" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Unpin current page" }),
  ).toBeVisible();
  if (info.project.name === "desktop") {
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.locator(".app-shell")).toHaveClass(/is-collapsed/);
    await page.getByRole("button", { name: "Expand sidebar" }).click();
  } else {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Mobile navigation" }),
    ).not.toBeVisible();
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("login stays disabled without Supabase and unknown routes return 404", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Sign in to your workspace" }),
  ).toBeDisabled();
  await page.goto("/modules/nonexistent/thing");
  await expect(
    page.getByRole("heading", { name: "Let’s get you back on track." }),
  ).toBeVisible();
  const res = await page.goto("/does-not-exist");
  expect(res?.status()).toBe(404);
});
