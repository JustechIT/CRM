import test from "node:test";
import assert from "node:assert/strict";
import { changeRecoveredPassword } from "../src/lib/team/password-recovery";
test("Password recovery verifies the provider identity, changes only its password and signs out", async () => {
  const calls: string[] = [];
  const result = await changeRecoveredPassword(
    {
      getUser: async () => {
        calls.push("verify");
        return {
          data: { user: { id: "authenticated-provider-user" } },
          error: null,
        };
      },
      updateUser: async (attributes) => {
        calls.push("update");
        assert.deepEqual(attributes, { password: "A-different-password-123!" });
        return { error: null };
      },
      signOut: async () => {
        calls.push("signout");
        return { error: null };
      },
    },
    "A-different-password-123!",
    "A-different-password-123!",
  );
  assert.deepEqual(calls, ["verify", "update", "signout"]);
  assert.ok(result.signedOut);
});
test("Invalid passwords or unauthenticated recovery cannot perform an update", async () => {
  let updates = 0;
  const auth = {
    getUser: async () => ({ data: { user: null }, error: null }),
    updateUser: async () => {
      updates++;
      return { error: null };
    },
    signOut: async () => ({ error: null }),
  };
  await assert.rejects(
    changeRecoveredPassword(auth, "short", "short"),
    /12 characters/,
  );
  await assert.rejects(
    changeRecoveredPassword(auth, "A-valid-long-password", "mismatch"),
    /match/,
  );
  await assert.rejects(
    changeRecoveredPassword(
      auth,
      "A-valid-long-password",
      "A-valid-long-password",
    ),
    /expired/,
  );
  assert.equal(updates, 0);
});
test("Rejected password updates preserve the session; successful changes survive a signout outage", async () => {
  let signouts = 0;
  const auth = {
    getUser: async () => ({ data: { user: { id: "verified" } }, error: null }),
    updateUser: async () => ({
      error: new Error("provider rejection") as Error | null,
    }),
    signOut: async () => {
      signouts++;
      throw Error("offline");
    },
  };
  await assert.rejects(
    changeRecoveredPassword(
      auth,
      "A-valid-long-password",
      "A-valid-long-password",
    ),
    /could not be changed/,
  );
  assert.equal(signouts, 0);
  auth.updateUser = async () => ({ error: null });
  assert.deepEqual(
    await changeRecoveredPassword(
      auth,
      "A-valid-long-password",
      "A-valid-long-password",
    ),
    { signedOut: false },
  );
});
