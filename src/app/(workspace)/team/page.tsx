import Link from "next/link";
import { notFound } from "next/navigation";
import { superAdmin } from "@/lib/team/access";
import { database, employee, isConfigured } from "@/lib/supabase";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import {
  UserForm,
  RemoveUser,
  CancelInvitation,
} from "@/components/team/user-form";
import type { TeamUser } from "@/lib/team/config";
import { activateAdministrator } from "./activation";
export default async function Team({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const access = await superAdmin();
  let ready = false;
  if (!access && isConfigured() && (await employee())) {
    const db = await database();
    const r = await db.rpc("team_admin_activation_ready");
    ready = r.data === true && !r.error;
  }
  if (ready)
    return (
      <>
        <PageHeader
          title="Activate Team Management"
          description="Your signed-in account matches the verified designated Supabase identity."
        />
        <section className="panel">
          <p>
            Activate Super Admin for this account. Existing users keep their
            current permissions until you explicitly edit them. Supplier Invoice
            access stays separately authorized.
          </p>
          <form action={activateAdministrator}>
            <button className="button primary">Activate Super Admin</button>
          </form>
        </section>
      </>
    );
  if (!access && isConfigured()) notFound();
  const r = access ? await access.db.rpc("team_users") : null;
  if (r?.error)
    return (
      <EmptyState
        title="Team Management unavailable"
        description="Check your connection and migration 0010. No users or permissions were changed."
      />
    );
  const users = (r?.data ?? []) as TeamUser[];
  const selected = users.find((u) => u.id === p.user);
  if (p.user && !selected) notFound();
  if (selected) {
    const root = selected.role_id === "super_admin";
    return (
      <>
        <PageHeader
          title={selected.full_name}
          description={
            root
              ? "Protected Super Admin account. Its role and access cannot be changed here."
              : "Edit the employee and explicitly authorize their modules."
          }
        >
          <Link className="button" href="/team">
            Back to users
          </Link>
        </PageHeader>
        {root ? (
          <section className="panel">
            <p>{selected.email}</p>
            <Badge>Super Admin · Protected</Badge>
          </section>
        ) : (
          <>
            <section className="panel">
              <UserForm key={selected.id} user={selected} />
            </section>
            <RemoveUser user={selected} />
          </>
        )}
      </>
    );
  }
  if (p.new === "1")
    return (
      <>
        <PageHeader
          title="Invite user"
          description="A verified invitation creates an employee with exactly the permissions you choose."
        />
        <section className="panel">
          {access ? (
            <UserForm />
          ) : (
            <EmptyState
              title="Super Admin verification required"
              description="Connect Supabase and verify the designated account before sending invitations."
            />
          )}
        </section>
      </>
    );
  const q = typeof p.q === "string" ? p.q.trim().toLowerCase() : "",
    status = typeof p.status === "string" ? p.status : "",
    role = typeof p.role === "string" ? p.role : "",
    department = typeof p.department === "string" ? p.department : "";
  const all = users.filter(
    (u) =>
      (status === "removed" ? !!u.removed_at : !u.removed_at) &&
      (!q ||
        `${u.full_name} ${u.email} ${u.legacy_roles}`
          .toLowerCase()
          .includes(q)) &&
      (!status || status === "removed" || u.status === status) &&
      (!role || u.role_id === role) &&
      (!department || u.departments.some((d) => d.id === department)),
  );
  const sort = ["full_name", "email", "date_added", "status"].includes(
    String(p.sort),
  )
    ? String(p.sort)
    : "full_name";
  const direction = p.direction === "desc" ? -1 : 1;
  all.sort(
    (a, b) =>
      String(a[sort as keyof TeamUser]).localeCompare(
        String(b[sort as keyof TeamUser]),
      ) * direction,
  );
  const page = Math.max(1, Math.min(10000, parseInt(String(p.page)) || 1));
  const rows = all.slice((page - 1) * 25, page * 25);
  const pageUrl = (n: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(p))
      if (typeof v === "string") q.set(k, v);
    q.set("page", String(n));
    return "/team?" + q;
  };
  const invites = access
    ? await access.db
        .from("team_invitations")
        .select("id,email,status,expires_at")
        .eq("status", "Pending")
        .order("created_at", { ascending: false })
        .limit(100)
    : null;
  return (
    <>
      <PageHeader
        title="Team Management"
        description="People, module access and secure invitations."
      >
        <Link className="button primary" href="/team?new=1">
          Add user
        </Link>
      </PageHeader>
      {p.saved === "1" && (
        <p className="success" role="status">
          User updated.
        </p>
      )}
      {p.invited === "1" && (
        <p className="success" role="status">
          Invitation sent. Access begins after the recipient verifies and
          accepts it.
        </p>
      )}
      {p.removed === "1" && (
        <p className="success" role="status">
          User removed from active CRM access. Business history is preserved.
        </p>
      )}
      {!access && (
        <p className="notice">
          Setup preview. User management requires the verified designated Super
          Admin. No users or privileges have been created.
        </p>
      )}
      <section className="panel">
        <form method="get" className="sales-filters">
          <label>
            Search
            <input name="q" type="search" defaultValue={q} />
          </label>
          <label>
            Account Status
            <select name="status" defaultValue={status}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="removed">Removed / Archived</option>
            </select>
          </label>
          <label>
            Role
            <select name="role" defaultValue={role}>
              <option value="">All</option>
              {["super_admin", "manager", "employee", "viewer", "legacy"].map(
                (r) => (
                  <option value={r} key={r}>
                    {r.replaceAll("_", " ")}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            Department
            <select name="department" defaultValue={department}>
              <option value="">All</option>
              {[
                "sales",
                "marketing",
                "operations",
                "training",
                "it",
                "management",
              ].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            Sort by
            <select name="sort" defaultValue={sort}>
              <option value="full_name">Full Name</option>
              <option value="email">Email</option>
              <option value="date_added">Date Added</option>
              <option value="status">Account Status</option>
            </select>
          </label>
          <label>
            Order
            <select
              name="direction"
              defaultValue={direction === 1 ? "asc" : "desc"}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
          <button className="button">Apply filters</button>
          <Link className="text-link" href="/team">
            Reset
          </Link>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  "Full Name",
                  "Email",
                  "Department",
                  "Role",
                  "Account Status",
                  "Date Added",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link className="text-link" href={`/team?user=${u.id}`}>
                      {u.full_name}
                    </Link>
                  </td>
                  <td>{u.email}</td>
                  <td>{u.departments.map((d) => d.name).join(", ") || "—"}</td>
                  <td>
                    {u.role_id === "super_admin"
                      ? "Super Admin"
                      : u.role_id === "legacy"
                        ? u.legacy_roles
                        : u.role_id[0].toUpperCase() + u.role_id.slice(1)}
                  </td>
                  <td>
                    <Badge>{u.removed_at ? "Removed" : u.status}</Badge>
                  </td>
                  <td>{u.date_added.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <EmptyState
            title="No users to show"
            description={
              access
                ? "Invite a colleague or adjust your filters."
                : "Connect your verified employee account to manage real users."
            }
          />
        )}
        <div className="pagination">
          <span>
            {all.length} users · Page {page}
          </span>
          <div className="actions">
            {page > 1 && (
              <Link className="button" href={pageUrl(page - 1)}>
                Previous
              </Link>
            )}
            {page * 25 < all.length && (
              <Link className="button" href={pageUrl(page + 1)}>
                Next
              </Link>
            )}
          </div>
        </div>
      </section>
      {access && (
        <section className="panel">
          <h2>Pending invitations</h2>
          {invites?.error ? (
            <p>Invitations could not be loaded.</p>
          ) : invites?.data?.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Expires</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.data.map((i) => (
                    <tr key={i.id}>
                      <td>{i.email}</td>
                      <td>{i.expires_at.slice(0, 10)}</td>
                      <td>
                        <CancelInvitation id={i.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">No pending invitations.</p>
          )}
        </section>
      )}
    </>
  );
}
