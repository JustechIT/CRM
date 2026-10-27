import { employee } from "@/lib/supabase";
import { PageHeader, EmptyState } from "@/components/ui";
export default async function Profile() {
  const p = await employee();
  return (
    <>
      <PageHeader
        title="My profile"
        description="Your identity in the Justech workspace."
      />
      <section className="panel">
        {p ? (
          <div className="prose">
            <h2>{p.full_name}</h2>
            <p>Employee status: {p.status}</p>
            <p className="muted">
              Contact an administrator to update your profile or department
              assignments.
            </p>
          </div>
        ) : (
          <EmptyState
            title="Your profile will live here"
            description="Connect Supabase and sign in with an invited employee account to view your profile."
          />
        )}
      </section>
    </>
  );
}
