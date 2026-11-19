import assert from "node:assert/strict";
import test from "node:test";
import { ids, latestDatabase } from "./helpers/latest-db";

test("typed directory names link atomically and follow directory updates", async () => {
  const { db, as, insert } = await latestDatabase();
  try {
    const opportunity = {
      name: "New opportunity",
      organization_name: "University Example",
      product_text: "Product",
      date: "2026-11-18",
      stage: "New",
      owner_id: ids.root,
      directory_names: JSON.stringify({ organization: "University Example" }),
    };
    const first = await insert("sales_opportunities", opportunity);
    const second = await insert("sales_opportunities", {
      ...opportunity,
      directory_names: JSON.stringify({ organization: " university  example " }),
    });
    const organizations = await db.query<{ id: string }>(
      "select id from accounts where name='University Example'",
    );
    assert.equal(organizations.rows.length, 1);
    const [organization] = organizations.rows;
    const linked = await db.query<{ account_id: string; directory_names: null }>(
      "select account_id,directory_names from sales_opportunities where id in ($1,$2)",
      [first, second],
    );
    assert.deepEqual(linked.rows, Array(2).fill({ account_id: organization.id, directory_names: null }));
    await db.query("update accounts set name='University Renamed' where id=$1", [organization.id]);
    const display = await db.query<{ organization_name: string }>(
      "select organization_name from sales_opportunities_list where id=$1", [first],
    );
    assert.equal(display.rows[0].organization_name, "University Renamed");

    const followup = {
      subject: "Follow up",
      next_action: "Send information",
      follow_up_date: "2026-11-20",
      status: "Open",
      owner_id: ids.root,
      directory_names: JSON.stringify({ contact: "Amina", organization: "" }),
    };
    const followupId = await insert("operations_followups", followup);
    const [contact] = (await db.query<{ id: string; account_id: null; email: string }>(
      "select id,account_id,email from contacts where first_name='Amina'",
    )).rows;
    assert.equal(contact.account_id, null);
    assert.equal(contact.email, "");
    await insert("operations_followups", {
      ...followup,
      directory_names: JSON.stringify({ contact: " amina ", organization: "" }),
    });
    const counts = await db.query<{ n: number }>("select count(*)::int n from contacts where first_name='Amina'");
    assert.equal(counts.rows[0].n, 1);
    await db.query("update contacts set last_name='Diallo',address='Tunis' where id=$1", [contact.id]);
    const [followupDisplay] = (await db.query<{ contact_name: string; party_label: string }>(
      "select contact_name,party_label from operations_followups_list where id=$1", [followupId],
    )).rows;
    assert.deepEqual(followupDisplay, { contact_name: "Amina Diallo", party_label: "Amina Diallo" });
    const directoryMatch = await db.query<{ id: string }>(
      "select id from directory_contacts_list where display_name ilike $1",
      ["%Amina Diallo%"],
    );
    assert.deepEqual(directoryMatch.rows, [{ id: contact.id }]);

    const conference = await insert("conference_contacts", {
      contact_person: "Amina Diallo",
      contact_type: "Partner",
      status: "Not Contacted",
      responsible_id: ids.root,
      owner_id: ids.root,
      directory_names: JSON.stringify({
        contact: "Amina Diallo",
        organization: "Conference Organization",
      }),
    });
    const conferenceRecord = await db.query<{ contact_id: string }>(
      "select contact_id from conference_contacts where id=$1", [conference],
    );
    assert.equal(conferenceRecord.rows[0].contact_id, contact.id);

    const product = await insert("products", {
      name: "Test product",
      subscription_kind: "Other",
      owner_id: ids.root,
    });
    const session = await insert("training_sessions", {
      name: "Training session",
      product_id: product,
      trainer_id: ids.root,
      date: "2026-11-20",
      format: "Online",
      status: "Scheduled",
      owner_id: ids.root,
    });
    const registration = await insert("training_registrations", {
      participant_name: "Amina Diallo",
      session_id: session,
      email: "registration@example.invalid",
      registration_status: "Pending",
      owner_id: ids.root,
      directory_names: JSON.stringify({
        contact: "Amina Diallo",
        organization: "University Renamed",
      }),
    });
    await db.query("update contacts set last_name='D.' where id=$1", [contact.id]);
    const registrationRecord = await db.query<{ contact_id: string; participant_name: string }>(
      "select contact_id,participant_name from training_registrations_list where id=$1",
      [registration],
    );
    assert.deepEqual(registrationRecord.rows[0], { contact_id: contact.id, participant_name: "Amina D." });
    const conferenceDisplay = await db.query<{ contact_person: string }>(
      "select contact_person from conference_contacts_list where id=$1", [conference],
    );
    assert.equal(conferenceDisplay.rows[0].contact_person, "Amina D.");

    await assert.rejects(insert("operations_followups", {
      ...followup,
      status: "Invalid",
      directory_names: JSON.stringify({ contact: "Rollback Candidate", organization: "" }),
    }), { code: "23514" });
    const rolledBack = await db.query("select id from contacts where first_name='Rollback'");
    assert.equal(rolledBack.rows.length, 0);

    // A module writer can reuse a visible directory name. Creating a new one
    // still needs directory.write, and a directory reader cannot create it by RPC.
    await db.query("select team_update_user($1,$2,$3,$4,true,$5,false,false)", [
      ids.manager, "manager", "it", "manager",
      JSON.stringify([
        { module: "directory", read: true, write: false, delete: false },
        { module: "sales", read: true, write: true, delete: false },
      ]),
    ]);
    await as(ids.manager);
    await insert("sales_opportunities", {
      ...opportunity,
      owner_id: ids.manager,
      organization_name: "University Renamed",
      directory_names: JSON.stringify({ organization: "University Renamed" }),
    });
    await assert.rejects(insert("sales_opportunities", {
      ...opportunity,
      owner_id: ids.manager,
      organization_name: "Forbidden Organization",
      directory_names: JSON.stringify({ organization: "Forbidden Organization" }),
    }), /directory write permission/);
  } finally {
    await db.close();
  }
});
