import Link from "next/link";
import { PageHeader, SetupNotice } from "@/components/ui";
import { isConfigured, employee } from "@/lib/supabase";
import { superAdmin } from "@/lib/team/access";
import {
  PreferencesForm,
  InvitationCheck,
} from "@/components/preferences/forms";
export default async function Settings() {
  const p = await employee(),
    admin = await superAdmin();
  const delivery = admin
    ? await admin.db
        .from("team_invitations")
        .select("id,email,status,mailed_at,delivery_error")
        .order("created_at", { ascending: false })
        .limit(5)
    : null;
  return (
    <>
      <PageHeader
        title="Settings"
        description="Make the workspace comfortable and keep invitations ready."
      />
      {!isConfigured() && <SetupNotice />}
      <div className="dashboard-grid">
        <section className="panel">
          <h2>Appearance & notifications</h2>
          <p className="muted">These settings belong to your account.</p>
          <PreferencesForm enabled={!!p} />
        </section>
        <section className="panel prose">
          <h2>Account & access</h2>
          <p>
            View your account details and change your password in My Profile.
            Your Super Admin manages user information, roles and restricted
            access.
          </p>
          <Link className="button" href="/profile">
            Open My Profile
          </Link>
          {admin && (
            <Link className="button" href="/team">
              Manage team
            </Link>
          )}
        </section>
      </div>
      {admin && (
        <section className="panel prose">
          <h2>User invitations</h2>
          <InvitationCheck />
          <h3>Recent invitation attempts</h3>
          {delivery?.error ? (
            <p>
              Delivery history is unavailable. Apply the latest database update.
            </p>
          ) : delivery?.data?.length ? (
            <ul>
              {delivery.data.map((i) => (
                <li key={i.id}>
                  {i.email} —{" "}
                  {i.delivery_error
                    ? "Email service reported a send error"
                    : i.mailed_at
                      ? "Accepted by email service"
                      : "Delivery not tracked"}{" "}
                  · {i.status}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No invitations have been attempted.</p>
          )}

          <p>To enable invitation emails:</p>
          <ol>
            <li>
              Open your CRM folder and open <code>.env.local</code> in Notepad.
            </li>
            <li>
              In Supabase → Settings → API Keys, copy the server-side Secret
              key.
            </li>
            <li>
              Add a new line: <code>SUPABASE_SECRET_KEY=your-secret-key</code>.
              Keep it private; do not send it in chat.
            </li>
            <li>
              Save the file, stop the CRM with Ctrl+C, then start it again.
            </li>
            <li>
              In Supabase Authentication → URL Configuration, allow your website
              address followed by <code>/auth/confirm</code> and{" "}
              <code>/invite</code>.
            </li>
            <li>
              Run the setup check, then invite a new email from Team Management.
            </li>
          </ol>
          <p className="muted">
            The key stays on the server. Supabase must also be allowed to
            deliver emails to your recipients. A successful setup check verifies
            the key, not inbox delivery.
          </p>
        </section>
      )}
    </>
  );
}
