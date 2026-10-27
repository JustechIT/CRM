import { PageHeader, Badge } from "@/components/ui";
import { isConfigured } from "@/lib/supabase";
export default function Settings() {
  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="A strong foundation for your team's everyday work."
      />
      <section className="panel prose">
        <div className="panel-heading">
          <h2>Workspace connection</h2>
          <Badge>
            {isConfigured()
              ? "Configured · verify database policies"
              : "Setup required"}
          </Badge>
        </div>
        <p>
          Before adding real customer information, connect Supabase and test
          access with employees who have different roles.
        </p>
        <ol>
          <li>
            Create a Supabase project and disable public sign-ups in
            Authentication settings.
          </li>
          <li>
            Apply <code>supabase/migrations/0001_crm.sql</code> using the SQL
            editor or Supabase CLI.
          </li>
          <li>
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in your
            environment. Never use a service-role key in the browser.
          </li>
          <li>
            Invite your initial administrator from the Supabase dashboard and
            follow the bootstrap instructions in the README.
          </li>
          <li>
            Restart the application and verify login, role restrictions, and
            database persistence.
          </li>
        </ol>
        <p className="muted">
          The application currently provides no in-app user invitations or
          permission editing. These operations remain restricted to trusted
          database administrators.
        </p>
      </section>
    </>
  );
}
