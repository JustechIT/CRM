import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  sections,
  indicators,
  getSection,
  modulePath,
  isDepartment,
} from "../src/lib/departments/config";
import { validate } from "../src/lib/departments/validation";
const uuid = "11111111-1111-4111-8111-111111111111";
const samples: Record<string, Record<string, string>> = {
  campaigns: {
    name: "Campaign",
    platform: "LinkedIn",
    start_date: "2026-10-01",
    end_date: "2026-11-01",
    status: "Active",
    assigned_to: uuid,
  },
  "content-calendar": {
    title: "Content",
    platform: "Website",
    content_type: "Article",
    publish_date: "2026-10-01",
    status: "Awaiting approval",
    assigned_to: uuid,
  },
  "marketing-assets": {
    name: "Asset",
    asset_type: "Brochure",
    product_id: uuid,
    file_link: "https://example.invalid/file.pdf",
    status: "In progress",
    assigned_to: uuid,
  },
  tasks: {
    title: "Task",
    project_id: uuid,
    area: "",
    assigned_to: uuid,
    due_at: "2026-10-27",
    status: "Open",
  },
  "projects-delivery": {
    name: "Project",
    objective: "Deliver the product",
    responsible_id: uuid,
    deadline: "2026-12-01",
    status: "Active",
  },
  "quality-control": {
    name: "Check",
    project_id: "",
    area: "Delivery",
    assigned_to: uuid,
    result: "Pending",
    status: "Pending",
  },
  "follow-ups": {
    subject: "Follow-up",
    party_type: "accounts",
    party_id: uuid,
    last_contact: "2026-10-01",
    next_action: "Call",
    follow_up_date: "2026-11-01",
    status: "Open",
  },
  "training-sessions": {
    name: "Training",
    product_id: uuid,
    trainer_id: uuid,
    date: "2026-11-01",
    format: "Online",
    status: "Scheduled",
  },
  registrations: {
    participant_name: "Person",
    account_id: uuid,
    session_id: uuid,
    email: "PERSON@example.invalid",
    registration_status: "Pending",
  },
  "training-history": {
    session_id: uuid,
    account_id: uuid,
    date: "2026-10-01",
    participants: "12",
    trainer_id: uuid,
    outcome: "Completed the workshop",
  },
};
test("All ten tables follow the workbook and explicit latest-message label corrections", async () => {
  const spec = JSON.parse(
    await readFile(
      new URL(
        "../docs/specifications/justech-departments.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(sections.length, 10);
  for (const section of sections) {
    const expected = [...spec[section.sheet]];
    if (section.slug === "campaigns") expected[1] = "Platform";
    assert.deepEqual(
      section.fields.map((f) => f.label),
      expected,
    );
  }
  assert.deepEqual(
    indicators.marketing.map((i) => i.label),
    [
      "Active Campaigns",
      "Scheduled Content",
      "Content Awaiting Approval",
      "Assets in Progress",
      "Upcoming Campaigns",
      "Overdue Content",
    ],
  );
  assert.deepEqual(
    indicators.operations.map((i) => i.label),
    spec["JO - Overview"],
  );
  assert.deepEqual(
    indicators.training.map((i) => i.label),
    [
      "Total Training Sessions",
      "Upcoming Sessions",
      "Completed Sessions",
      "Total Registrations",
      "Pending Registrations",
      "Training History",
    ],
  );
});
test("Each section validates its real fields while discarding forged system columns", () => {
  for (const section of sections) {
    const result = validate(section, {
      ...samples[section.slug],
      owner_id: "forged",
      revision: 999,
      department: "workspace",
      created_at: "forged",
    });
    assert.equal(result.success, true, section.slug);
    if (result.success)
      for (const key of ["owner_id", "revision", "department", "created_at"])
        assert.equal(key in result.data, false, section.slug + " " + key);
  }
});
test("Required references, campaign date order, calendar dates and safe asset links are validated", () => {
  for (const section of sections) {
    const f = section.fields.find((field) => field.type === "reference");
    if (f)
      assert.equal(
        validate(section, { ...samples[section.slug], [f.key]: "not-a-uuid" })
          .success,
        false,
      );
  }
  const campaign = getSection("marketing", "campaigns")!;
  assert.equal(
    validate(campaign, { ...samples.campaigns, end_date: "2026-09-01" })
      .success,
    false,
  );
  assert.equal(
    validate(campaign, { ...samples.campaigns, start_date: "2026-02-30" })
      .success,
    false,
  );
  const asset = getSection("marketing", "marketing-assets")!;
  for (const bad of [
    "javascript:alert(1)",
    "file:///C:/secret",
    "ftp://example.invalid/file",
  ])
    assert.equal(
      validate(asset, { ...samples["marketing-assets"], file_link: bad })
        .success,
      false,
    );
  assert.equal(
    validate(asset, { ...samples["marketing-assets"], file_link: "" }).success,
    true,
  );
});
test("Tasks use UTC due dates and project/area selections are mutually exclusive", () => {
  const task = getSection("operations", "tasks")!;
  const valid = validate(task, samples.tasks);
  assert.equal(valid.success, true);
  if (valid.success) assert.equal(valid.data.due_at, "2026-10-27T00:00:00Z");
  assert.equal(
    validate(task, { ...samples.tasks, project_id: "", area: " Procurement " })
      .success,
    true,
  );
  assert.equal(
    validate(task, { ...samples.tasks, area: "Duplicate area" }).success,
    false,
  );
  assert.equal(
    validate(task, { ...samples.tasks, project_id: "", area: "  " }).success,
    false,
  );
});
test("Follow-ups resolve an existing contact or institution without accepting two unrelated targets", () => {
  const section = getSection("operations", "follow-ups")!;
  for (const type of ["accounts", "contacts"]) {
    const result = validate(section, {
      ...samples["follow-ups"],
      party_type: type,
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(
        result.data[type === "accounts" ? "account_id" : "contact_id"],
        uuid,
      );
      assert.equal(
        result.data[type === "accounts" ? "contact_id" : "account_id"],
        null,
      );
      assert.equal("party_id" in result.data, false);
    }
  }
  assert.equal(
    validate(section, { ...samples["follow-ups"], party_type: "untrusted" })
      .success,
    false,
  );
  assert.equal(
    validate(section, { ...samples["follow-ups"], last_contact: "2026-12-01" })
      .success,
    false,
  );
});
test("Training checks participant counts, email and defined status/format values", () => {
  const history = getSection("training", "training-history")!;
  for (const participants of ["-1", "1.5", "1e3", "2147483648"])
    assert.equal(
      validate(history, { ...samples["training-history"], participants })
        .success,
      false,
    );
  const registration = getSection("training", "registrations")!;
  assert.equal(
    validate(registration, { ...samples.registrations, email: "invalid" })
      .success,
    false,
  );
  const result = validate(registration, samples.registrations);
  if (result.success) assert.equal(result.data.email, "person@example.invalid");
  for (const section of sections) {
    if (section.statusKey)
      assert.equal(
        validate(section, {
          ...samples[section.slug],
          [section.statusKey]: "Untrusted status",
        }).success,
        false,
      );
  }
});
test("Registry exposes only the requested three departments and unique canonical routes", () => {
  for (const value of [
    "sales",
    "alfikr-marketing",
    "workspace",
    "__proto__",
    null,
  ])
    assert.equal(isDepartment(value), false);
  assert.equal(
    new Set(sections.map((s) => modulePath(s.department, s.slug))).size,
    10,
  );
  assert.equal(getSection("marketing", "training-sessions"), undefined);
});
