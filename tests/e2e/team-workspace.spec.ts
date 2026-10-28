import { test, expect } from "@playwright/test";
const cases = [
  [
    "/modules/workspace/priorities",
    "priority",
    [
      "Priority / Task",
      "Department",
      "Assigned To",
      "Deadline",
      "Priority",
      "Status",
    ],
  ],
  [
    "/modules/workspace/platform",
    "IT project",
    [
      "Project Name",
      "Platform",
      "Description",
      "Project Owner",
      "Start Date",
      "Deadline",
      "Status",
    ],
  ],
  [
    "/modules/workspace/events?section=conferences",
    "conference contact",
    [
      "Organization / Institution",
      "Type",
      "Contact Person",
      "Email / Phone",
      "Country",
      "Status",
      "Date Contacted",
      "Topic / Purpose",
      "Next Step",
    ],
  ],
  [
    "/modules/workspace/events",
    "event",
    ["Event Name", "Activities", "Responsible", "Date", "Status", "Notes"],
  ],
] as const;
test("All Workspace tables show their exact columns and usable Add forms without fake records", async ({
  page,
}) => {
  for (const [path, singular, columns] of cases) {
    await page.goto(path);
    await expect(page.locator(".department-table th")).toHaveText([...columns]);
    await expect(page.getByText("Planned module", { exact: true })).toHaveCount(
      0,
    );
    await page
      .getByRole("link", { name: `New ${singular}`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: `New ${singular}`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Create ${singular}`, exact: true }),
    ).toBeDisabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("Priorities offer My Priorities and employee department priority status filters", async ({
  page,
}) => {
  await page.goto("/modules/workspace/priorities");
  const filters = page.getByRole("form", { name: "Filter Team Priorities" });
  await expect(
    filters.getByRole("combobox", { name: "Employee", exact: true }),
  ).toBeVisible();
  await expect(
    filters.getByRole("combobox", { name: "Department", exact: true }),
  ).toBeVisible();
  await filters.getByLabel("My Priorities").check();
  await filters
    .getByRole("combobox", { name: "Priority", exact: true })
    .selectOption("Urgent");
  await filters
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("On Hold");
  await filters.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/mine=1/);
  await expect(page).toHaveURL(/priority=Urgent/);
  await expect(page).toHaveURL(/status=On\+Hold/);
});
test("Conferences and Events tabs remain separate, and follow-up dates and ownership are editable", async ({
  page,
}) => {
  await page.goto("/modules/workspace/events");
  await page.getByRole("link", { name: "Conferences", exact: true }).click();
  await expect(page).toHaveURL(/section=conferences/);
  await page
    .getByRole("link", { name: "New conference contact", exact: true })
    .click();
  await expect(page.locator('input[name="follow_up_date"]')).toHaveAttribute(
    "type",
    "date",
  );
  await expect(
    page.getByRole("combobox", { name: "Responsible *", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Events", exact: true }).click();
  await expect(page.locator(".department-table th")).toHaveText([
    ...cases[3][2],
  ]);
});
test("IT tasks stay scoped to a project, use appropriate dropdowns, and reject missing parent context", async ({
  page,
}) => {
  const id = "11111111-1111-4111-8111-111111111111";
  await page.goto(`/modules/workspace/platform/issues?project=${id}&new=1`);
  await expect(page.locator('input[name="project_id"]')).toHaveValue(id);
  await expect(page.getByLabel("Type", { exact: false })).toHaveValue("Task");
  await expect(
    page.getByRole("button", { name: "Create task / issue", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("link", { name: "Back to project", exact: true }),
  ).toHaveAttribute("href", `/modules/workspace/platform?record=${id}`);
  await expect(
    page.getByRole("link", { name: "Cancel", exact: true }),
  ).toHaveAttribute("href", `/modules/workspace/platform?record=${id}`);
  await page.goto("/modules/workspace/platform/issues");
  await expect(
    page.getByRole("heading", { name: "Tasks / Issues", exact: true }),
  ).toHaveCount(0);
});
test("Team Management has exact user columns; real invitation and acceptance stay blocked in setup preview", async ({
  page,
}) => {
  await page.goto("/team");
  await expect(page.locator("table th")).toHaveText([
    "Full Name",
    "Email",
    "Department",
    "Role",
    "Account Status",
    "Date Added",
  ]);
  await page.getByRole("link", { name: "Add user", exact: true }).click();
  await expect(
    page.getByText("Super Admin verification required", { exact: true }),
  ).toBeVisible();
  await page.goto("/invite");
  await expect(
    page.getByRole("button", { name: "Accept invitation", exact: true }),
  ).toBeDisabled();
});
test("Forged Workspace and Team Management requests cannot grant permissions or mutate records", async ({
  page,
}) => {
  for (const path of ["/api/team/users", "/api/team/invitations"]) {
    const r = await page.request.post(path, {
      headers: { Origin: "http://127.0.0.1:3000" },
      data: { email: "souhail@justech.tn", role: "super_admin" },
    });
    expect([403, 405]).toContain(r.status());
  }
  const edit = await page.request.patch("/api/team/users", {
    headers: { Origin: "http://127.0.0.1:3000" },
    data: { role: "super_admin" },
  });
  expect(edit.status()).toBe(403);
  expect((await page.request.get("/api/team/users")).status()).toBe(403);
  for (const path of [
    "/modules/workspace/priorities",
    "/modules/workspace/platform",
    "/modules/workspace/events",
    "/team",
  ]) {
    const r = await page.request.post(path, {
      form: { full_name: "Forged", role: "super_admin" },
    });
    expect(r.status()).toBe(401);
  }
  for (const dept of ["priorities", "platform", "events"])
    expect(
      (
        await page.request.get(
          `/api/departments/lookups?department=${dept}&entity=employees`,
        )
      ).status(),
    ).toBe(401);
  expect((await page.request.get("/")).status()).toBe(200);
});
