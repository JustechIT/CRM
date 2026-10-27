import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  FileText,
  CalendarClock,
  ListTodo,
  Plus,
  Check,
  Sparkles,
} from "lucide-react";
import { EmptyState, PageHeader, SetupNotice } from "@/components/ui";
import { employee, isConfigured } from "@/lib/supabase";
export default async function Dashboard() {
  const profile = await employee();
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
        description="Your relationships, priorities, and next steps. All in one place."
      >
        <Link className="button primary" href="/directory/new">
          <Plus size={16} /> New account
        </Link>
      </PageHeader>
      <div className="welcome-strip">
        <div>
          <span className="live-dot" />
          Justech & Al-Fikr
        </div>
        <span>One team. Connected work.</span>
      </div>
      <div className="metrics">
        {[
          ["Active opportunities", BriefcaseBusiness],
          ["Pending quotations", FileText],
          ["Upcoming renewals", CalendarClock],
          ["Open tasks", ListTodo],
        ].map(([label, Icon]) => {
          const I = Icon as typeof ListTodo;
          return (
            <div className="metric" key={String(label)}>
              <div>
                <span>{String(label)}</span>
                <I size={18} />
              </div>
              <strong>—</strong>
              <small>Available when this module is connected</small>
            </div>
          );
        })}
      </div>
      <div className="dashboard-grid">
        <section className="panel priorities">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Focus on what matters</span>
              <h2>My priorities</h2>
            </div>
            <span className="subtle-icon">
              <ListTodo size={18} />
            </span>
          </div>
          <EmptyState
            title="Room for your next great day"
            description="Your assigned tasks will appear here when Team Priorities is available."
            action={
              <Link className="button" href="/modules/workspace/priorities">
                Explore team priorities <ArrowRight size={15} />
              </Link>
            }
          />
          <div className="panel-foot">
            <Check size={15} /> A shared view of work, with a personal focus.
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Upcoming activities</h2>
            <CalendarClock size={18} />
          </div>
          <EmptyState
            title="A little breathing room"
            description="Scheduled activities will appear here once the activities module is connected."
          />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Recent CRM activity</h2>
            <span className="badge">Coming next</span>
          </div>
          <EmptyState
            title="Your workspace story starts here"
            description="A shared activity feed will make relationship updates easy to follow."
          />
        </section>
        <section className="panel getting-started">
          <div className="panel-heading">
            <h2>Make yourself at home</h2>
            <Sparkles size={18} />
          </div>
          <p className="muted">A few useful places to get started.</p>
          {[
            [
              "Build your directory",
              "Keep institutions and people connected.",
              "/directory",
            ],
            ["Meet your team", "A shared home for your colleagues.", "/team"],
            [
              "Set up your workspace",
              "Connect the services behind your CRM.",
              "/settings",
            ],
          ].map(([title, description, href], index) => (
            <Link className="onboarding-row" key={href} href={href}>
              <span className="step-number">0{index + 1}</span>
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <ArrowUpRight size={17} />
            </Link>
          ))}
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
