import Link from "next/link";
import {
  BriefcaseBusiness,
  FileText,
  CalendarClock,
  ListTodo,
  Plus,
} from "lucide-react";
import { EmptyState, PageHeader, SetupNotice } from "@/components/ui";
import { database, employee, isConfigured } from "@/lib/supabase";
import { authorized } from "@/lib/directory";
import { alfikrSections } from "@/lib/alfikr/config";
import { sections } from "@/lib/departments/config";
import { workspaceSections } from "@/lib/workspace/config";
type Home = {
  opportunities: number | null;
  caution: number | null;
  renewals: number | null;
  tasks: number | null;
  priorities: { id: string; title: string; due_at: string; priority: string }[];
  events: { id: string; name: string; event_date: string }[];
  activity: {
    id: number;
    entity: string;
    action: string;
    occurred_at: string;
  }[];
};
export default async function Dashboard() {
  const profile = await employee();
  let data: Home | null = null,
    failed = false;
  if (profile) {
    const db = await database(),
      r = await db.rpc("home_dashboard");
    failed = !!r.error;
    data = r.data as Home | null;
  }
  const canAdd = profile && (await authorized("directory.write"));
  const labels = [
    ["Active opportunities", "opportunities", BriefcaseBusiness],
    ["Caution records", "caution", FileText],
    ["Upcoming renewals", "renewals", CalendarClock],
    ["Open tasks", "tasks", ListTodo],
  ] as const;
  const tableNames = new Map(
    [...sections, ...workspaceSections, ...alfikrSections].map((s) => [
      s.table,
      s.title,
    ]),
  );
  return (
    <>
      {!isConfigured() && <SetupNotice />}
      <PageHeader
        eyebrow="Your daily workspace"
        title={
          profile
            ? `Hello, ${profile.full_name.split(" ")[0]}.`
            : "A clearer view of your day."
        }
        description="Your relationships, priorities and next steps. All in one place."
      >
        {canAdd && (
          <Link className="button primary" href="/directory/new">
            <Plus size={16} />
            New account
          </Link>
        )}
      </PageHeader>
      <div className="welcome-strip">
        <div>
          <span className="live-dot" />
          Justech & Al-Fikr
        </div>
        <span>One team. Connected work.</span>
      </div>
      {failed && (
        <p className="form-error">
          Dashboard data could not be loaded. Check your connection and the
          latest database migrations.
        </p>
      )}
      <div className="metrics">
        {labels.map(([label, key, Icon]) => (
          <div className="metric" key={key}>
            <div>
              <span>{label}</span>
              <Icon size={18} />
            </div>
            <strong>{data?.[key] ?? "—"}</strong>
            <small>
              {data?.[key] == null
                ? "Connect your account or request module access"
                : "Calculated from your accessible records"}
            </small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel priorities">
          <div className="panel-heading">
            <h2>My priorities</h2>
            <ListTodo size={18} />
          </div>
          {data?.priorities?.length ? (
            <div>
              {data.priorities.map((p) => (
                <Link
                  key={p.id}
                  className="onboarding-row"
                  href={`/modules/workspace/priorities?record=${p.id}`}
                >
                  <strong>{p.title}</strong>
                  <small>
                    {p.priority} · {p.due_at.slice(0, 10)}
                  </small>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No open priorities to show"
              description={
                profile
                  ? "Your assigned open priorities appear here when you have access."
                  : "Sign in to see your own work."
              }
            />
          )}
          <Link className="button" href="/modules/workspace/priorities?mine=1">
            Open My Priorities
          </Link>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Upcoming activities</h2>
            <CalendarClock size={18} />
          </div>
          {data?.events?.length ? (
            data.events.map((e) => (
              <Link
                key={e.id}
                className="onboarding-row"
                href={`/modules/workspace/events?record=${e.id}`}
              >
                <strong>{e.name}</strong>
                <small>{e.event_date}</small>
              </Link>
            ))
          ) : (
            <EmptyState
              title="No upcoming events to show"
              description="Accessible events in the next 30 days appear here."
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Recent CRM activity</h2>
          </div>
          {data?.activity?.length ? (
            <ul>
              {data.activity.map((a) => (
                <li key={a.id}>
                  {tableNames.get(a.entity) ??
                    (a.entity === "accounts"
                      ? "Accounts"
                      : a.entity === "contacts"
                        ? "Contacts"
                        : "Workspace record")}{" "}
                  —{" "}
                  {a.action === "INSERT"
                    ? "created"
                    : a.action === "DELETE"
                      ? "deleted"
                      : "updated"}{" "}
                  <small className="muted">{a.occurred_at.slice(0, 10)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No recent activity available"
              description="Activity shown here respects your audit permissions."
            />
          )}
        </section>
        <section className="panel getting-started">
          <h2>Make yourself at home</h2>
          <p className="muted">Useful settings and shortcuts.</p>
          <Link className="onboarding-row" href="/settings">
            Workspace settings
          </Link>
          <Link className="onboarding-row" href="/profile">
            My Profile
          </Link>
          <Link className="onboarding-row" href="/directory/import">
            Import accounts & contacts
          </Link>
        </section>
      </div>
      <div className="workspace-footer">
        <span className="brand-symbol small">j</span>
        <span>Thoughtfully connected. Ready to grow.</span>
        <span>JUSTECH WORKSPACE</span>
      </div>
    </>
  );
}
