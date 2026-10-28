import test from "node:test";
import assert from "node:assert/strict";
import { accountSchema, contactSchema, queryTerm } from "../src/lib/validation";
import {
  allPages,
  navigation,
  activeDepartment,
  safeReturnPath,
} from "../src/lib/navigation";
const account = {
  name: "Test institution",
  institution_type: "University",
  status: "Prospect",
  business: "Both",
};
test("account validation trims values and rejects missing names, invalid emails and unsafe URLs", () => {
  assert.equal(
    accountSchema.parse({ ...account, name: "  Test institution  " }).name,
    "Test institution",
  );
  for (const invalid of [
    { name: "" },
    { email: "not-an-email" },
    { website: "javascript:alert(1)" },
    { business: "Unknown" },
    { notes: "a".repeat(5001) },
  ])
    assert.equal(
      accountSchema.safeParse({ ...account, ...invalid }).success,
      false,
    );
});
test("contacts require an associated institution and both names", () => {
  const c = {
    first_name: "Test",
    last_name: "Person",
    account_id: "11111111-1111-4111-8111-111111111111",
  };
  assert.equal(contactSchema.safeParse(c).success, true);
  for (const change of [
    { account_id: "" },
    { first_name: "" },
    { last_name: "" },
    { email: "invalid" },
  ])
    assert.equal(contactSchema.safeParse({ ...c, ...change }).success, false);
});
test("search terms have bounded length and cannot inject PostgREST filter syntax", () => {
  assert.equal(queryTerm("%a_,(b).\\"), " a   b   ");
  assert.equal(queryTerm("a".repeat(101)).length, 100);
  assert.equal(queryTerm(null), "");
});
test("navigation has unique routes and complete department structure", () => {
  assert.equal(new Set(allPages.map((p) => p.href)).size, allPages.length);
  assert.equal(
    navigation
      .filter((s) => ["Justech", "Al-Fikr"].includes(s.label))
      .flatMap((s) => s.items).length,
    7,
  );
  assert.equal(
    activeDepartment("/modules/justech-sales/subscriptions"),
    "/modules/justech-sales/overview",
  );
  assert.equal(activeDepartment("/directory"), null);
});
test("return paths cannot redirect to external destinations", () => {
  for (const path of ["//evil.test", "https://evil.test", "/\\evil.test", null])
    assert.equal(safeReturnPath(path), "/");
  assert.equal(safeReturnPath("/directory"), "/directory");
});
