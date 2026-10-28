import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  parseDirectoryFile,
  checkWorkbookZip,
} from "../src/lib/imports/parser";
import {
  batchSchema,
  mappedRows,
  duplicateKey,
} from "../src/lib/imports/validation";
import { alfikrSections } from "../src/lib/alfikr/config";
import { validate } from "../src/lib/departments/validation";
const uuid = "11111111-1111-4111-8111-111111111111";
test("Al-Fikr follows every workbook header and validates money, references, currency and dates", () => {
  const expected = [
    [
      "Opportunity Name",
      "Organization",
      "Product / Package",
      "Date",
      "Due Date",
      "Value",
      "Stage",
      "Type of Action",
      "Expected Close",
      "Notes",
    ],
    [
      "Quotation ID",
      "Customer",
      "Product / Package",
      "Subscription Period",
      "Currency",
      "Amount",
      "Issue Date",
      "Valid Until",
      "Status",
      "Assigned To",
      "Notes",
    ],
    [
      "Customer",
      "Product / Package",
      "Start Date",
      "End Date",
      "Contract Duration",
      "Status",
      "Annual Value",
      "Assigned To",
      "Notes",
    ],
    [
      "Campaign Name",
      "Platform",
      "Start Date",
      "End Date",
      "Status",
      "Assigned To",
    ],
    [
      "Content Title",
      "Platform",
      "Content Type",
      "Publish Date",
      "Status",
      "Assigned To",
    ],
    [
      "Content ID",
      "Title",
      "Author",
      "Publisher",
      "Language",
      "Content Type",
      "ISBN / Identifier",
      "Category",
      "Publication Year",
      "File / Link",
      "Availability Status",
      "Assigned To",
      "Notes",
    ],
    [
      "Content Title",
      "Publisher / Source",
      "Workflow Stage",
      "Assigned To",
      "Date Received",
      "Due Date",
      "Review Result",
      "Status",
      "Notes",
    ],
  ];
  alfikrSections.forEach((s, i) =>
    assert.deepEqual(
      s.fields.map((f) => f.label),
      expected[i],
    ),
  );
  const s = alfikrSections.find((s) => s.slug === "subscriptions")!;
  const row = {
    account_id: uuid,
    product_id: uuid,
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    contract_duration: "Annual",
    status: "Active",
    annual_value: "100.005",
    currency: "eur",
    assigned_to: uuid,
    notes: "",
    owner_id: "forged",
  };
  const r = validate(s, row);
  assert.ok(r.success);
  if (r.success) {
    assert.equal(r.data.currency, "EUR");
    assert.equal("owner_id" in r.data, false);
  }
  for (const d of [
    { currency: "" },
    { end_date: "2025-12-31" },
    { annual_value: "-1" },
  ])
    assert.equal(validate(s, { ...row, ...d }).success, false);
});
test("CSV parsing handles UTF-8 BOM, semicolons, escaped quotes and multiline fields without executing formulas", async () => {
  const r = await parseDirectoryFile(
    Buffer.from(
      '\uFEFFName;Notes\r\n"Test; institution";"Line 1\nLine 2"\r\nOther;"=1+2"',
    ),
    "file.csv",
  );
  assert.deepEqual(r.headers, ["Name", "Notes"]);
  assert.equal(r.rows[0][0], "Test; institution");
  assert.equal(r.rows[0][1], "Line 1\nLine 2");
  assert.equal(r.rows[1][1], "=1+2");
  await assert.rejects(
    parseDirectoryFile(Buffer.alloc(0), "empty.csv"),
    /non-empty/,
  );
  await assert.rejects(
    parseDirectoryFile(Buffer.from("Name\nOnly"), "file.exe"),
    /csv or .xlsx/,
  );
  await assert.rejects(
    parseDirectoryFile(
      Buffer.from("Name\n" + Array(501).fill("Record").join("\n")),
      "large.csv",
    ),
    /500 rows/,
  );
});
test("XLSX reading supports multiple worksheets and bounded ZIP expansion", async () => {
  const buffer = await readFile(
    new URL("./fixtures/directory-import.xlsx", import.meta.url),
  );
  const r = await parseDirectoryFile(buffer, "data.xlsx");
  assert.deepEqual(r.sheets, ["Institutions", "Contacts"]);
  assert.equal(r.rows[0][0], "Test institution");
  const contacts = await parseDirectoryFile(buffer, "data.xlsx", "Contacts");
  assert.equal(contacts.rows[0][1], "Person");
  await assert.rejects(
    parseDirectoryFile(buffer, "data.xlsx", "Missing"),
    /existing worksheet/,
  );
  const bomb = Buffer.alloc(68);
  bomb.writeUInt32LE(0x02014b50, 0);
  bomb.writeUInt32LE(21 * 1024 * 1024, 24);
  bomb.writeUInt32LE(0x06054b50, 46);
  bomb.writeUInt16LE(1, 56);
  bomb.writeUInt32LE(0, 62);
  assert.throws(() => checkWorkbookZip(bomb), /too large/);
});
test("Import mapping uses explicit defaults, validates each row and strips forged ownership", () => {
  const parsed = batchSchema.parse({
    entity: "accounts",
    rows: [[" Test institution ", "TN", "invalid-email"]],
    mapping: { name: 0, country: 1, email: 2, owner_id: 0 },
    defaults: {
      institution_type: "University",
      status: "Active",
      business: "Al-Fikr",
    },
  });
  assert.ok(mappedRows(parsed)[0].error);
  parsed.rows[0][2] = "valid@example.invalid";
  const r = mappedRows(parsed)[0];
  assert.equal(r.error, "");
  assert.ok(r.data && "business" in r.data);
  if (r.data && "business" in r.data) {
    assert.equal(r.data.business, "Al-Fikr");
    assert.equal(r.data.name, "Test institution");
  }
  assert.equal("owner_id" in (r.data ?? {}), false);
  assert.equal(
    duplicateKey("accounts", { name: "TEST ", country: "TN", city: "" }),
    duplicateKey("accounts", { name: "test", country: "tn", city: "" }),
  );
});

test("Invitation dispatch tests provider acceptance, existing identities, send errors and tracking failures without sending live mail", async () => {
  const { deliverInvitation } = await import("../src/lib/team/delivery");
  const records: { sent: boolean; code: string | null }[] = [];
  let recoverCalled = false;
  const success = await deliverInvitation({
    invite: async () => null,
    recover: async () => {
      recoverCalled = true;
      return null;
    },
    record: async (sent, code) => {
      records.push({ sent, code });
    },
  });
  assert.deepEqual(success, { sent: true, tracked: true });
  assert.equal(recoverCalled, false);
  const recover = await deliverInvitation({
    invite: async () => ({ code: "email_exists" }),
    recover: async () => {
      recoverCalled = true;
      return null;
    },
    record: async () => {},
  });
  assert.equal(recover.sent, true);
  assert.equal(recoverCalled, true);
  const failed = await deliverInvitation({
    invite: async () => ({ code: "email_send_failed" }),
    recover: async () => null,
    record: async (sent, code) => {
      records.push({ sent, code });
    },
  });
  assert.equal(failed.sent, false);
  assert.deepEqual(records.at(-1), { sent: false, code: "email_send_failed" });
  const network = await deliverInvitation({
    invite: async () => {
      throw Error("offline");
    },
    recover: async () => null,
    record: async () => {},
  });
  assert.equal(network.sent, false);
  const tracking = await deliverInvitation({
    invite: async () => null,
    recover: async () => null,
    record: async () => {
      throw Error("offline");
    },
  });
  assert.deepEqual(tracking, { sent: true, tracked: false });
});
test("Private invoice uploads validate actual signatures, size and safe filenames", async () => {
  const { invoiceFileInfo } = await import("../src/lib/finance/files");
  assert.equal(
    invoiceFileInfo(Buffer.from("%PDF-1.7"), "invoice.pdf")?.mime,
    "application/pdf",
  );
  assert.equal(
    invoiceFileInfo(new Uint8Array([255, 216, 255, 0]), "invoice.jpg")?.mime,
    "image/jpeg",
  );
  assert.equal(
    invoiceFileInfo(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      "invoice.png",
    )?.mime,
    "image/png",
  );
  assert.equal(
    invoiceFileInfo(Buffer.from("<svg></svg>"), "invoice.svg"),
    null,
  );
  assert.equal(invoiceFileInfo(Buffer.alloc(10485761), "huge.pdf"), null);
  assert.equal(invoiceFileInfo(Buffer.from("%PDF-1.7"), "\r\n"), null);
  assert.equal(
    invoiceFileInfo(Buffer.from("%PDF-1.7"), "safe\nname.pdf")?.filename,
    "safename.pdf",
  );
});

test("Origin checks accept the real incoming host and reject other sites despite an internal localhost URL", async () => {
  const { requestHasSameOrigin, publicOrigin } =
    await import("../src/lib/server/request");
  const incoming = {
    url: "http://localhost:3000/api/profile",
    headers: new Headers({
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
    }),
  };
  assert.equal(publicOrigin(incoming), "http://127.0.0.1:3000");
  assert.equal(requestHasSameOrigin(incoming), true);
  incoming.headers.set("origin", "https://evil.example");
  assert.equal(requestHasSameOrigin(incoming), false);
  incoming.headers.delete("origin");
  assert.equal(requestHasSameOrigin(incoming), false);
  const secure = {
    url: "http://internal:3000/api/profile",
    headers: new Headers({
      host: "crm.example.test",
      origin: "https://crm.example.test",
      "x-forwarded-proto": "https",
    }),
  };
  assert.equal(requestHasSameOrigin(secure), true);
  secure.headers.set("origin", "http://crm.example.test");
  assert.equal(requestHasSameOrigin(secure), false);
});

test("Non-UTF-8 CSV is rejected instead of silently replacing accented characters", async () => {
  await assert.rejects(
    parseDirectoryFile(
      Buffer.from([78, 97, 109, 101, 10, 67, 97, 102, 233]),
      "latin1.csv",
    ),
    /CSV UTF-8/,
  );
});

test("Import request IDs are valid unique v4 identifiers without requiring browser randomUUID", async () => {
  const { importRequestId } = await import("../src/lib/imports/request-id");
  const a = importRequestId(),
    b = importRequestId();
  assert.match(
    a,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.notEqual(a, b);
});
