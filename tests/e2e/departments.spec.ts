import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const spec = JSON.parse(
  readFileSync("docs/specifications/justech-departments.json", "utf8"),
);
const cases = [
  ["marketing", "campaigns", "JM - Campaigns", "campaign", 2],
  ["marketing", "content-calendar", "JM - Content Calendar", "content item", 1],
  ["marketing", "marketing-assets", "JM - Marketing Assets", "asset", 0],
  ["operations", "tasks", "JO - Tasks", "task", 1],
  ["operations", "projects-delivery", "JO - Projects & Delivery", "project", 1],
  ["operations", "quality-control", "JO - Quality Control", "quality check", 0],
  ["operations", "follow-ups", "JO - Follow-up", "follow-up", 2],
  [
    "training",
    "training-sessions",
    "JT - Training Sessions",
    "training session",
    1,
  ],
  ["training", "registrations", "JT - Registrations", "registration", 0],
  [
    "training",
    "training-history",
    "JT - Training History",
    "training history entry",
    1,
  ],
] as const;
const metrics = {
  marketing: [
    "Active Campaigns",
    "Scheduled Content",
    "Content Awaiting Approval",
    "Assets in Progress",
    "Upcoming Campaigns",
    "Overdue Content",
  ],
  operations: [
    "Total Tasks",
    "Open Tasks",
    "Active Projects",
    "Pending Quality Checks",
    "Upcoming Follow-ups",
    "Overdue Follow-ups",
  ],
  training: [
    "Total Training Sessions",
    "Upcoming Sessions",
    "Completed Sessions",
    "Total Registrations",
    "Pending Registrations",
    "Training History",
  ],
};
test("All ten lists display the specified columns within the existing CRM", async ({
  page,
}) => {
  for (const [dept, slug, sheet] of cases) {
    await page.goto(`/modules/justech-${dept}/${slug}`);
    const headings = [...spec[sheet]];
    if (slug === "campaigns") headings[1] = "Platform";
    await expect(page.locator(".department-table th")).toHaveText(headings);
    await expect(page.getByText("Planned module", { exact: true })).toHaveCount(
      0,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("All ten Add forms have usable fields and date pickers with safe save blocking", async ({
  page,
}) => {
  for (const [dept, slug, sheet, singular, dates] of cases) {
    await page.goto(`/modules/justech-${dept}/${slug}`);
    await page
      .getByRole("link", { name: `New ${singular}`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: `New ${singular}`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Create ${singular}`, exact: true }),
    ).toBeDisabled();
    const headings = [...spec[sheet]];
    if (slug === "campaigns") headings[1] = "Platform";
    for (const label of headings)
      await expect(
        page
          .locator(".department-form")
          .locator("label,legend")
          .filter({ hasText: label })
          .first(),
      ).toBeVisible();
    await expect(page.locator(".department-form input[type=date]")).toHaveCount(
      dates,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("Each Overview shows the six requested database-driven indicators", async ({
  page,
}) => {
  for (const [dept, labels] of Object.entries(metrics)) {
    await page.goto(`/modules/justech-${dept}/overview`);
    await expect(
      page.locator(".department-indicators .metric > div > span"),
    ).toHaveText(labels);
    await expect(page.locator(".department-indicators strong")).toHaveText(
      Array(6).fill("—"),
    );
    await expect(
      page.getByText("Connect your workspace", { exact: true }),
    ).toBeVisible();
  }
});
test("Search, status and sort filters work across all three departments", async ({
  page,
}) => {
  for (const [dept, slug] of [
    ["marketing", "campaigns"],
    ["operations", "tasks"],
    ["training", "registrations"],
  ]) {
    await page.goto(`/modules/justech-${dept}/${slug}`);
    await page
      .getByRole("searchbox", { name: "Search", exact: true })
      .fill("institution");
    await page
      .getByRole("combobox", { name: "Order", exact: true })
      .selectOption("desc");
    const chosenStatus =
      dept === "marketing"
        ? "Active"
        : dept === "operations"
          ? "Open"
          : "Pending";
    await page
      .getByRole("combobox", {
        name: dept === "training" ? "Registration Status" : "Status",
        exact: true,
      })
      .selectOption(chosenStatus);
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/q=institution/);
    await expect(page).toHaveURL(/direction=desc/);
    await expect(page).toHaveURL(new RegExp("status=" + chosenStatus));
    await page.getByRole("link", { name: "Reset", exact: true }).click();
    await expect(page).not.toHaveURL(/q=/);
  }
});
test("Operations offers clear project/area and contact/organization choices", async ({
  page,
}) => {
  await page.goto("/modules/justech-operations/tasks?new=1");
  await page.getByLabel("Link to", { exact: true }).selectOption("area");
  await expect(
    page.getByRole("textbox", { name: "Area", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Area", exact: true })
    .fill("Internal delivery");
  await page.goto("/modules/justech-operations/follow-ups?new=1");
  await page
    .getByLabel("Reference type", { exact: true })
    .selectOption("contacts");
  await expect(
    page.getByRole("combobox", { name: "Contact *", exact: true }),
  ).toBeDisabled();
});
test("Legacy Operations URLs open the new sections and navigation stays responsive", async ({
  page,
}, info) => {
  await page.goto("/modules/justech-operations/requests");
  await expect(page).toHaveURL(/justech-operations\/tasks$/);
  await page.goto("/modules/justech-operations/activities");
  await expect(page).toHaveURL(/justech-operations\/follow-ups$/);
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  const nav =
    info.project.name === "mobile"
      ? page.getByRole("dialog", { name: "Mobile navigation" })
      : page.locator("aside.sidebar");
  await nav
    .getByRole("link", { name: "Projects & Delivery", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Projects & Delivery", exact: true }),
  ).toBeVisible();
});
test("Each department rejects unauthorized lookups and forged POSTs while staying responsive", async ({
  page,
}) => {
  for (const dept of ["marketing", "operations", "training"]) {
    const lookup = await page.request.get(
      `/api/departments/lookups?department=${dept}&entity=employees`,
    );
    expect(lookup.status()).toBe(401);
    const denied = await page.request.post(
      `/modules/justech-${dept}/overview`,
      { form: { owner_id: "forged", department: "workspace" } },
    );
    expect(denied.status()).toBe(401);
    expect((await denied.json()).error).toContain("No record was saved");
    expect(
      (await page.request.get(`/modules/justech-${dept}/overview`)).status(),
    ).toBe(200);
  }
});
test("Al-Fikr sections remain untouched starter pages", async ({ page }) => {
  for (const path of [
    "/modules/alfikr-sales/overview",
    "/modules/alfikr-marketing/overview",
  ]) {
    await page.goto(path);
    await expect(
      page.getByText("Planned module", { exact: true }),
    ).toBeVisible();
  }
});
