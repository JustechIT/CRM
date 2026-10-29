import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPermissionPreset,
  permissionGroups,
} from "../src/lib/team/permissions";
import {
  deliverInvitation,
  invitationDeliveryMessage,
} from "../src/lib/team/delivery";
import { latestDatabase, ids } from "./helpers/latest-db";

test("Bulk permission presets remain scoped, require explicit action and never include private finance", () => {
  const current = [
    { module: "directory", read: true, write: false, delete: false },
  ];
  const justech = permissionGroups.find((g) => g.id === "justech")!.modules;
  const result = applyPermissionPreset(current, justech, "edit", "employee");
  assert.deepEqual(result[0], current[0]);
  assert.equal(result.length, 5);
  assert.ok(result.slice(1).every((g) => g.read && g.write && !g.delete));
  assert.equal(current.length, 1);
  const full = applyPermissionPreset(
    result,
    permissionGroups[0].modules,
    "full",
    "manager",
  );
  assert.equal(full.length, 11);
  assert.ok(full.every((g) => g.read && g.write && g.delete));
  assert.ok(full.every((g) => !g.module.includes("supplier")));
  const viewer = applyPermissionPreset(
    full,
    permissionGroups[0].modules,
    "full",
    "viewer",
  );
  assert.ok(viewer.every((g) => g.read && !g.write && !g.delete));
  const cleared = applyPermissionPreset(full, justech, "none", "manager");
  assert.ok(
    cleared
      .filter((g) => justech.includes(g.module))
      .every((g) => !g.read && !g.write && !g.delete),
  );
  assert.ok(cleared.find((g) => g.module === "directory")!.write);
  assert.deepEqual(
    applyPermissionPreset(
      [],
      ["supplier_invoices", "super_admin"],
      "full",
      "manager",
    ),
    [],
  );
});

test("Registered-auth fallback supports legacy provider errors and preserves meaningful rate-limit failures", async () => {
  let recovered = false;
  const result = await deliverInvitation({
    invite: async () => ({
      status: 422,
      message: "A user with this email address has already been registered",
    }),
    recover: async () => {
      recovered = true;
      return { code: "over_email_send_rate_limit" };
    },
    record: async (sent, code) => {
      assert.equal(sent, false);
      assert.equal(code, "over_email_send_rate_limit");
    },
  });
  assert.ok(recovered);
  assert.equal(result.sent, false);
  assert.match(
    invitationDeliveryMessage(result.errorCode!),
    /temporarily limited/,
  );
  assert.match(
    invitationDeliveryMessage("email_address_not_authorized"),
    /recipient restrictions/,
  );
});

test("Invitation resend is administrator-only, renewed in place, cooled down and cannot restore employees or grant access", async () => {
  const { db, as } = await latestDatabase();
  try {
    await as(ids.root);
    const { rows } = await db.query<{ id: string }>(
      `select team_create_invitation('new@example.invalid','New','sales','employee','[{"module":"sales","read":true,"write":true,"delete":false}]',false) as id`,
    );
    const id = rows[0].id;
    await db.query("select team_cancel_invitation($1)", [id]);
    for (const person of [null, ids.manager, ids.employee, ids.viewer]) {
      await as(person);
      await assert.rejects(
        db.query("select team_prepare_invitation_resend($1)", [id]),
      );
    }
    await as(ids.root);
    const response = await db.query<{ email: string }>(
      "select team_prepare_invitation_resend($1) as email",
      [id],
    );
    assert.equal(response.rows[0].email, "new@example.invalid");
    const entry = (
      await db.query<{
        status: string;
        modules: { module: string }[];
        supplier_access: boolean;
        future: boolean;
      }>(
        "select status,modules,supplier_access,expires_at>now() as future from team_invitations where id=$1",
        [id],
      )
    ).rows[0];
    assert.equal(entry.status, "Pending");
    assert.ok(entry.future);
    assert.equal(entry.modules[0].module, "sales");
    assert.equal(entry.supplier_access, false);
    await assert.rejects(
      db.query("select team_prepare_invitation_resend($1)", [id]),
      /Wait one minute/,
    );
    await db.query(
      "select record_invitation_delivery($1,false,'over_email_send_rate_limit')",
      [id],
    );
    // A failed resend remains visible/retryable but grants no employee access.
    assert.equal(
      (await db.query("select * from employee_profiles where full_name='New'"))
        .rows.length,
      0,
    );
    await db.exec("reset role");
    await db.query(
      "update team_invitations set last_attempt_at=now()-interval '2 minutes' where id=$1",
      [id],
    );
    await as(ids.root);
    await db.query("select team_prepare_invitation_resend($1)", [id]);
    assert.equal(
      (
        await db.query(
          "select * from team_invitations where email='new@example.invalid'",
        )
      ).rows.length,
      1,
    );
    await db.exec("reset role");
    await db.query(
      "update team_invitations set status='Accepted' where id=$1",
      [id],
    );
    await as(ids.root);
    await assert.rejects(
      db.query("select team_prepare_invitation_resend($1)", [id]),
      /unavailable/,
    );
    await db.exec("reset role");
    await db.query(
      "update team_invitations set status='Cancelled',email='manager@example.invalid',last_attempt_at=null where id=$1",
      [id],
    );
    await as(ids.root);
    await assert.rejects(
      db.query("select team_prepare_invitation_resend($1)", [id]),
      /Employee exists/,
    );
  } finally {
    await db.close();
  }
});
