import test from "node:test";
import assert from "node:assert/strict";
import { workspaceSections } from "../src/lib/workspace/config";
import { validate } from "../src/lib/departments/validation";
import {
  modulePath,
  getSection,
  isModuleScope,
  isDepartment,
} from "../src/lib/departments/config";
import { userSchema } from "../src/lib/team/config";
const uid = "11111111-1111-4111-8111-111111111111";
test("Workspace tables retain requested columns and project navigation stays scoped", () => {
  const expected = [
    [
      "Priority / Task",
      "Department",
      "Assigned To",
      "Deadline",
      "Priority",
      "Status",
    ],
    [
      "Project Name",
      "Platform",
      "Description",
      "Project Owner",
      "Start Date",
      "Deadline",
      "Status",
    ],
    ["Issue / Task", "Platform", "Type", "Assigned To", "Priority", "Status"],
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
    ["Event Name", "Activities", "Responsible", "Date", "Status", "Notes"],
  ];
  workspaceSections.forEach((s, i) =>
    assert.deepEqual(
      s.fields.map((f) => f.label),
      expected[i],
    ),
  );
  assert.equal(
    modulePath("platform", "projects"),
    "/modules/workspace/platform",
  );
  assert.equal(
    modulePath("platform", "issues", { project: uid }),
    "/modules/workspace/platform/issues?project=" + uid,
  );
  assert.equal(
    modulePath("events", "conferences"),
    "/modules/workspace/events?section=conferences",
  );
  assert.equal(isModuleScope("priorities"), true);
  assert.equal(isDepartment("priorities"), false);
});
test("Priorities validate existing department IDs, assigned employees, real dates and defined dropdown values", () => {
  const s = getSection("priorities", "priorities")!,
    data = {
      title: "Priority",
      team_department: "sales",
      assigned_to: uid,
      due_at: "2026-10-28",
      priority: "Urgent",
      status: "To Do",
      owner_id: "forged",
      workspace_kind: "operations",
    };
  const r = validate(s, data);
  assert.ok(r.success);
  if (r.success) {
    assert.equal(r.data.due_at, "2026-10-28T00:00:00Z");
    assert.equal("owner_id" in r.data, false);
    assert.equal("workspace_kind" in r.data, false);
  }
  for (const d of [
    { team_department: "unknown" },
    { assigned_to: "bad" },
    { due_at: "2026-02-30" },
    { priority: "Critical" },
    { status: "Open" },
  ])
    assert.equal(validate(s, { ...data, ...d }).success, false);
});
test("Project and issue validation requires a valid parent and correct dates without inventing progress", () => {
  const p = getSection("platform", "projects")!,
    data = {
      name: "Platform",
      platform: "CRM",
      description: "",
      responsible_id: uid,
      start_date: "2026-10-01",
      deadline: "2026-11-01",
      status: "Planned",
      progress: 100,
    };
  const r = validate(p, data);
  assert.ok(r.success);
  if (r.success) {
    assert.equal(r.data.description, "");
    assert.equal("progress" in r.data, false);
  }
  assert.equal(validate(p, { ...data, deadline: "2026-09-01" }).success, false);
  const i = getSection("platform", "issues")!,
    issue = {
      title: "Issue",
      platform: "CRM",
      issue_type: "Bug",
      assigned_to: uid,
      priority: "High",
      status: "To Do",
      project_id: uid,
    };
  assert.ok(validate(i, issue).success);
  assert.equal(validate(i, { ...issue, project_id: "" }).success, false);
});
test("Conference follow-up metadata is editable without adding columns to the requested table", () => {
  const s = getSection("events", "conferences")!,
    data = {
      account_id: uid,
      contact_type: "University",
      contact_person: "Person",
      email_phone: "",
      country: "",
      status: "Follow-up",
      date_contacted: "2026-10-01",
      topic: "",
      next_step: "Call",
      responsible_id: uid,
      follow_up_date: "2026-10-28",
    };
  const r = validate(s, data);
  assert.ok(r.success);
  if (r.success) {
    assert.equal(r.data.email_phone, "");
    assert.equal(r.data.follow_up_date, "2026-10-28");
  }
  assert.equal(
    validate(s, { ...data, follow_up_date: "2026-09-01" }).success,
    false,
  );
});
test("Team permission forms cannot request another Super Admin, forged modules or ambiguous grants", () => {
  const u = {
    full_name: "Person",
    email: "person@example.invalid",
    department: "it",
    role: "employee",
    active: true,
    supplier_access: false,
    modules: [{ module: "platform", read: true, write: true, delete: false }],
  };
  assert.ok(userSchema.safeParse(u).success);
  for (const d of [
    { role: "super_admin" },
    { email: "souhail@justech" },
    { modules: [{ module: "unknown", read: true, write: true, delete: true }] },
    {
      modules: [
        { module: "platform", read: false, write: true, delete: false },
      ],
    },
  ])
    assert.equal(userSchema.safeParse({ ...u, ...d }).success, false);
});

test("Unauthorized modules, restricted invoices and management links are excluded independently of legacy role labels", async () => {
  const { allPages, isPageAllowed } = await import("../src/lib/navigation");
  const access = {
    modules: ["platform", "priorities"],
    team: false,
    supplier: false,
  };
  const visible = allPages
    .filter((p) => isPageAllowed(p.href, access))
    .map((p) => p.href);
  assert.ok(visible.includes("/modules/workspace/platform"));
  assert.ok(visible.includes("/modules/workspace/priorities"));
  for (const path of [
    "/modules/justech-sales/payments",
    "/modules/justech-operations/caution",
    "/modules/workspace/events",
    "/finance/supplier-invoices",
    "/team",
    "/directory",
  ])
    assert.equal(visible.includes(path), false, path);
  assert.equal(
    isPageAllowed("/finance/supplier-invoices", {
      modules: ["sales", "platform", "events"],
      team: true,
      supplier: false,
    }),
    false,
  );
  assert.equal(
    isPageAllowed("/team", { modules: [], team: true, supplier: false }),
    true,
  );
});
