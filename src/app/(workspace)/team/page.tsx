import { invoiceAccess } from "@/lib/finance/access";
import { InvoiceAccessForm } from "@/components/finance/access-form";
import { database, isConfigured } from "@/lib/supabase";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
export default async function Team() {
  let members: { id: string; full_name: string; status: string }[] = [];
  let failed = false;
  if (isConfigured()) {
    const db = await database();
    const r = await db
      .from("employee_profiles")
      .select("id,full_name,status")
      .order("full_name")
      .limit(100);
    members = r.data ?? [];
    failed = !!r.error;
  }
  const manager = await invoiceAccess(true);
  const grants = manager
    ? await manager.db.from("supplier_invoice_access").select("user_id")
    : null;
  const allowed = new Set((grants?.data ?? []).map((g) => g.user_id));
  return (
    <>
      <PageHeader
        title="Team Management"
        description="The people who keep Justech and Al-Fikr moving."
      />
      <section className="panel">
        {failed ? (
          <EmptyState
            title="Team directory unavailable"
            description="Check your database migration and permissions. No team data could be loaded."
          />
        ) : members.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Team member</th>
                  <th>Status</th>
                  {manager && <th>Private Supplier Invoices</th>}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>{m.full_name}</td>
                    <td>
                      <Badge>{m.status}</Badge>
                    </td>
                    {manager && (
                      <td>
                        {grants?.error ? (
                          "Permissions unavailable"
                        ) : (
                          <InvoiceAccessForm
                            userId={m.id}
                            allowed={allowed.has(m.id)}
                            self={m.id === manager.profile.id}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="A home for your team"
            description="Invited employee profiles will appear here after Supabase is configured. Invitations and role administration are not yet available in this interface."
          />
        )}
      </section>
    </>
  );
}
