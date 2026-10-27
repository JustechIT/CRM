import Link from "next/link";
import { notFound, unstable_rethrow, redirect } from "next/navigation";
import { Plus, ArrowLeft, ArrowUpRight, Layers } from "lucide-react";
import { PageHeader, EmptyState, SetupNotice } from "@/components/ui";
import { authorized } from "@/lib/directory";
import { isConfigured } from "@/lib/supabase";
import {
  getSection,
  modulePath,
  departmentTitles,
  indicators,
  sections,
  param,
  value,
  recordLabel,
} from "@/lib/departments/config";
import type { Department, Params, RecordRow } from "@/lib/departments/types";
import { record, list, overview } from "@/lib/departments/data";
import { id } from "@/lib/departments/validation";
import { DepartmentForm, DepartmentDelete, Retry } from "./forms";
import {
  FieldValue,
  DepartmentTable,
  FilterForm,
  Pagination,
  url,
} from "./table";
async function Contents({
  department,
  slug,
  params,
}: {
  department: Department;
  slug: string[];
  params: Params;
}) {
  if (slug.length !== 1) notFound();
  if (department === "operations" && slug[0] === "requests")
    redirect(modulePath(department, "tasks"));
  if (department === "operations" && slug[0] === "activities")
    redirect(modulePath(department, "follow-ups"));
  const section = getSection(department, slug[0]);
  if (slug[0] !== "overview" && !section) notFound();
  const configured = isConfigured();
  const access = configured ? await authorized(department + ".read") : null;
  if (configured && !access)
    return (
      <>
        <PageHeader
          eyebrow="Justech"
          title={`${departmentTitles[department]} access required`}
          description="Your shared workspace remains protected."
        />
        <EmptyState
          title="Department permission required"
          description="Ask an administrator to grant access to this department."
        />
      </>
    );
  const write = !!access && !!(await authorized(department + ".write")),
    remove = !!access && !!(await authorized(department + ".delete"));
  const notice = !configured ? <SetupNotice /> : null;
  if (!section) {
    const metrics = access ? await overview(access, department) : null;
    return (
      <>
        {notice}
        <PageHeader
          eyebrow={`Justech ${departmentTitles[department]}`}
          title={`${departmentTitles[department]} Overview`}
          description="Your team's work, priorities and next steps in one clear view."
        />
        <div className="department-indicators">
          {indicators[department].map((indicator) => (
            <Link
              className="metric sales-metric"
              key={indicator.key}
              href={modulePath(department, indicator.section, indicator.filter)}
            >
              <div>
                <span>{indicator.label}</span>
                <Layers size={18} />
              </div>
              <strong>{metrics?.[indicator.key] ?? "—"}</strong>
              <small>{indicator.description}</small>
            </Link>
          ))}
        </div>
        <section className="panel">
          <div className="panel-heading">
            <h2>Choose where to work</h2>
          </div>
          <div className="department-section-links">
            {sections
              .filter((s) => s.department === department)
              .map((s) => (
                <Link key={s.slug} href={modulePath(department, s.slug)}>
                  <span>
                    <strong>{s.title}</strong>
                    <small>View records and manage your next steps</small>
                  </span>
                  <ArrowUpRight size={17} />
                </Link>
              ))}
          </div>
        </section>
      </>
    );
  }
  const selectedId = param(params, "record");
  let selected: RecordRow | undefined;
  if (selectedId) {
    if (!id.safeParse(selectedId).success) notFound();
    if (!access)
      return (
        <>
          {notice}
          <EmptyState
            title="Employee access required"
            description="Connect your workspace and sign in to open this record."
          />
        </>
      );
    const found = await record(access, section, selectedId);
    if (!found) notFound();
    selected = found;
  }
  const editing = !!selected && param(params, "edit") === "1",
    creating = param(params, "new") === "1";
  if (selected && !editing) {
    return (
      <>
        {param(params, "saved") === "1" && (
          <div role="status" className="success">
            Record saved successfully.
          </div>
        )}
        <PageHeader
          eyebrow={`Justech ${departmentTitles[department]} · ${section.title}`}
          title={recordLabel(section, selected) || section.singular}
          description="Shared context, kept clear and up to date."
        >
          <Link
            className="button"
            href={url(section, params, {
              record: null,
              saved: null,
              edit: null,
            })}
          >
            <ArrowLeft size={15} />
            Back to list
          </Link>
          {write && (
            <Link
              className="button primary"
              href={url(section, params, { edit: "1", saved: null })}
            >
              Edit record
            </Link>
          )}
        </PageHeader>
        <section className="panel sales-record-detail">
          <div className="panel-heading">
            <h2>Record details</h2>
          </div>
          <dl>
            {section.fields.map((field) => (
              <div key={field.key}>
                <dt>{field.label}</dt>
                <dd>
                  <FieldValue field={field} record={selected!} />
                </dd>
              </div>
            ))}
          </dl>
          <div className="sales-record-meta">
            <span>
              Created{" "}
              {new Date(selected.created_at).toLocaleDateString("en-GB", {
                timeZone: "UTC",
              })}
            </span>
            <span>
              Updated{" "}
              {new Date(selected.updated_at).toLocaleDateString("en-GB", {
                timeZone: "UTC",
              })}
            </span>
            <span>Version {selected.revision}</span>
          </div>
        </section>
        {section.slug === "projects-delivery" && (
          <div className="sales-inline-actions">
            <Link
              className="button"
              href={modulePath(department, "tasks", { project: selected.id })}
            >
              View tasks
            </Link>
            <Link
              className="button"
              href={modulePath(department, "quality-control", {
                project: selected.id,
              })}
            >
              View quality checks
            </Link>
          </div>
        )}
        {section.slug === "training-sessions" && (
          <div className="sales-inline-actions">
            <Link
              className="button"
              href={modulePath(department, "registrations", {
                session: selected.id,
              })}
            >
              View registrations
            </Link>
            <Link
              className="button"
              href={modulePath(department, "training-history", {
                session: selected.id,
              })}
            >
              View history
            </Link>
            {write && value(selected, "status") !== "Cancelled" && (
              <Link
                className="button primary"
                href={modulePath(department, "registrations", {
                  session: selected.id,
                  new: "1",
                })}
              >
                Add registration
              </Link>
            )}
          </div>
        )}
        {remove && <DepartmentDelete section={section} record={selected} />}
      </>
    );
  }
  if (creating || editing) {
    let prefill: Record<string, unknown> | undefined;
    if (access && !selected) {
      prefill = {};
      if (
        department === "operations" &&
        ["tasks", "quality-control"].includes(section.slug) &&
        id.safeParse(param(params, "project")).success
      ) {
        const project = await access.db
          .from("operations_projects")
          .select("id,name")
          .eq("id", param(params, "project"))
          .maybeSingle();
        if (project.error) throw new Error("Project unavailable");
        if (project.data) {
          prefill.project_id = project.data.id;
          prefill.project_id_label = project.data.name;
          prefill.area = "";
        }
      }
      for (const field of section.fields)
        if (["assigned_to", "responsible_id"].includes(field.key)) {
          prefill[field.key] = access.profile.id;
          prefill[field.key + "_label"] = access.profile.full_name;
        }
      if (
        department === "training" &&
        ["registrations", "training-history"].includes(section.slug) &&
        id.safeParse(param(params, "session")).success
      ) {
        const session = await access.db
          .from("training_sessions")
          .select("id,name")
          .eq("id", param(params, "session"))
          .maybeSingle();
        if (session.error) throw new Error("Session unavailable");
        if (session.data) {
          prefill.session_id = session.data.id;
          prefill.session_id_label = session.data.name;
        }
      }
    }
    return (
      <>
        {notice}
        <PageHeader
          eyebrow={`Justech ${departmentTitles[department]} · ${section.title}`}
          title={`${editing ? "Edit" : "New"} ${section.singular}`}
          description="The right details, in the right place."
        >
          <Link className="button" href={modulePath(department, section.slug)}>
            <ArrowLeft size={15} />
            Back to list
          </Link>
        </PageHeader>
        <section className="panel department-form-panel">
          <DepartmentForm
            section={section}
            record={selected}
            prefill={prefill}
            canWrite={write}
          />
        </section>
      </>
    );
  }
  const result = access ? await list(access, section, params) : null;
  return (
    <>
      {notice}
      <PageHeader
        eyebrow={`Justech ${departmentTitles[department]}`}
        title={section.title}
        description="Clear records, connected people, and easy next steps."
      >
        {(write || !configured) && (
          <Link
            className="button primary"
            href={modulePath(department, section.slug, {
              new: "1",
              ...(param(params, "project")
                ? { project: param(params, "project") }
                : {}),
              ...(param(params, "session")
                ? { session: param(params, "session") }
                : {}),
            })}
          >
            <Plus size={15} />
            New {section.singular}
          </Link>
        )}
      </PageHeader>
      <p className="department-list-count">
        {result ? `${result.total} records` : "Data not connected"}
      </p>
      <section className="panel">
        <FilterForm section={section} params={params} />
        <DepartmentTable
          section={section}
          rows={result?.rows ?? []}
          params={params}
          connected={!!access}
        />
        {result && (
          <Pagination
            section={section}
            params={params}
            total={result.total}
            page={result.filters.page}
          />
        )}
      </section>
    </>
  );
}
export async function DepartmentPage(args: {
  department: Department;
  slug: string[];
  params: Params;
}) {
  let content: React.ReactNode;
  try {
    content = await Contents(args);
  } catch (error) {
    unstable_rethrow(error);
    content = null;
  }
  if (content === null)
    return (
      <>
        <PageHeader
          title={`${departmentTitles[args.department]} needs attention`}
          description="Your records have not been replaced with empty data."
        />
        <section className="panel">
          <EmptyState
            title="This module could not be loaded"
            description="Check the connection, department permissions and that the new database migrations are applied."
            action={<Retry />}
          />
        </section>
      </>
    );
  return content;
}
