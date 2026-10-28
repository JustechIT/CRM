import { superAdmin } from "@/lib/team/access";
import { database, employee } from "@/lib/supabase";
import { PageHeader, EmptyState } from "@/components/ui";
import { ProfileForm, PasswordForm } from "@/components/preferences/forms";
export default async function Profile() {
  const p = await employee(),
    admin = await superAdmin();
  let email = "",
    roles: string[] = [],
    departments: string[] = [];
  if (p) {
    const db = await database();
    const [u, r, d, defsR, defsD] = await Promise.all([
      db.auth.getUser(),
      db.from("user_roles").select("role_id").eq("user_id", p.id),
      db.from("user_departments").select("department_id").eq("user_id", p.id),
      db.from("roles").select("id,name"),
      db.from("departments").select("id,name"),
    ]);
    email = u.data.user?.email ?? "";
    roles = (r.data ?? []).map(
      (v) => defsR.data?.find((x) => x.id === v.role_id)?.name ?? v.role_id,
    );
    departments = (d.data ?? []).map(
      (v) =>
        defsD.data?.find((x) => x.id === v.department_id)?.name ??
        v.department_id,
    );
  }
  return (
    <>
      <PageHeader
        title="My Profile"
        description="Your name, account information and password."
      />
      {!p ? (
        <EmptyState
          title="Sign in to view your profile"
          description="Connect your employee account to update your real profile."
        />
      ) : (
        <>
          <section className="panel sales-record-detail">
            <dl>
              <div>
                <dt>Full Name</dt>
                <dd>{p.full_name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{email}</dd>
              </div>
              <div>
                <dt>Department</dt>
                <dd>{departments.join(", ") || "Not assigned"}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{roles.join(", ") || "Not assigned"}</dd>
              </div>
              <div>
                <dt>Account status</dt>
                <dd>{p.status}</dd>
              </div>
            </dl>
            <p className="muted">
              Your email identifies your login. Roles and permissions can only
              be changed by the designated Super Admin.
            </p>
          </section>
          <div className="dashboard-grid">
            <section className="panel">
              <h2>Personal information</h2>
              {admin ? (
                <ProfileForm key={p.id} name={p.full_name} enabled />
              ) : (
                <p>
                  Contact the designated Super Admin to change your name or
                  account information.
                </p>
              )}
            </section>
            <section className="panel">
              <h2>Change password</h2>
              <PasswordForm enabled />
            </section>
          </div>
        </>
      )}
    </>
  );
}
