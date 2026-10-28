import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { authorized } from "@/lib/directory";
import { isConfigured } from "@/lib/supabase";
import { PageHeader, EmptyState, SetupNotice } from "@/components/ui";
import { getSection, modulePath, param, value } from "@/lib/departments/config";
import type { ModuleScope, Params, RecordRow } from "@/lib/departments/types";
import { list, record as loadRecord } from "@/lib/departments/data";
import { id as uuid } from "@/lib/departments/validation";
import {
  DepartmentForm,
  DepartmentDelete,
} from "@/components/departments/forms";
import {
  DepartmentTable,
  FilterForm,
  FieldValue,
  Pagination,
} from "@/components/departments/table";
async function Contents({
  scope,
  slug,
  params,
}: {
  scope: ModuleScope;
  slug: string;
  params: Params;
}) {
  const section = getSection(scope, slug);
  if (!section) notFound();
  const configured = isConfigured();
  const access = configured ? await authorized(scope + ".read") : null;
  if (configured && !access) notFound();
  let write = !!access && !!(await authorized(scope + ".write")),
    remove = !!access && !!(await authorized(scope + ".delete"));
  const recordId = param(params, "record");
  let row: RecordRow | null = null;
  let project: RecordRow | null = null;
  if (recordId) {
    if (!uuid.safeParse(recordId).success) notFound();
    if (!access) notFound();
    row = await loadRecord(access, section, recordId);
    if (!row) notFound();
  }
  const projectId =
    slug === "issues"
      ? value(row ?? undefined, "project_id") || param(params, "project")
      : "";
  if (slug === "issues") {
    if (!uuid.safeParse(projectId).success) notFound();
    if (access) {
      project = await loadRecord(
        access,
        getSection("platform", "projects")!,
        projectId,
      );
      if (!project) notFound();
    }
  }
  if (row && access) {
    const allowed = await access.db.rpc("team_record_write_allowed", {
      assignee: row.assigned_to ?? row.responsible_id ?? null,
      creator: row.owner_id ?? null,
    });
    write = write && allowed.data === true;
    remove = remove && allowed.data === true;
  }
  const editing = param(params, "edit") === "1",
    creating = param(params, "new") === "1";
  const base = modulePath(
    scope,
    slug,
    slug === "issues" ? { project: projectId } : {},
  );
  return (
    <>
      {!configured && <SetupNotice />}
      <PageHeader
        eyebrow="Workspace"
        title={
          creating
            ? `New ${section.singular}`
            : editing
              ? `Edit ${section.singular}`
              : row
                ? value(row, section.fields[0].key)
                : section.title
        }
        description={
          slug === "issues"
            ? `Project: ${value(project ?? undefined, "name") || "IT project"}`
            : "Shared work, clear ownership and practical next steps."
        }
      >
        <Link
          className="button"
          href={
            row || creating
              ? base
              : scope === "platform"
                ? modulePath("platform", "projects")
                : base
          }
        >
          {row || creating ? "Back to list" : "Reset view"}
        </Link>
        {!row && !creating && (
          <Link
            className="button primary"
            href={modulePath(scope, slug, {
              new: "1",
              ...(slug === "issues" ? { project: projectId } : {}),
            })}
          >
            New {section.singular}
          </Link>
        )}
        {row && !editing && write && (
          <Link
            className="button primary"
            href={modulePath(scope, slug, {
              record: row.id,
              edit: "1",
              ...(slug === "issues" ? { project: projectId } : {}),
            })}
          >
            Edit record
          </Link>
        )}
      </PageHeader>
      {scope === "events" && (
        <nav className="tabs">
          <Link
            href={modulePath("events", "conferences")}
            aria-current={slug === "conferences" ? "page" : undefined}
          >
            Conferences
          </Link>
          <Link
            href={modulePath("events", "events")}
            aria-current={slug === "events" ? "page" : undefined}
          >
            Events
          </Link>
        </nav>
      )}
      {slug === "issues" && (
        <p>
          <Link
            className="text-link"
            href={modulePath("platform", "projects", { record: projectId })}
          >
            Back to project
          </Link>
        </p>
      )}
      {creating || editing ? (
        <section className="panel">
          <DepartmentForm
            key={`${section.slug}-${row?.id ?? "new"}-${projectId}`}
            section={section}
            record={row ?? undefined}
            prefill={{
              priority: "Medium",
              assigned_to: access?.profile.id,
              assigned_to_label: access?.profile.full_name,
              responsible_id: access?.profile.id,
              responsible_id_label: access?.profile.full_name,
              project_id: projectId,
              platform: value(project ?? undefined, "platform"),
            }}
            canWrite={write}
          />
        </section>
      ) : row ? (
        <>
          <section className="panel sales-record-detail">
            <dl>
              {[...section.fields, ...(section.extraFields ?? [])].map((f) => (
                <div key={f.key}>
                  <dt>{f.label}</dt>
                  <dd>
                    <FieldValue field={f} record={row} />
                  </dd>
                </div>
              ))}
            </dl>
            {slug === "projects" && <ProjectProgress row={row} />}
          </section>
          {slug === "projects" && (
            <ProjectTasks
              project={row}
              access={access}
              params={params}
              write={write}
            />
          )}
          {remove && <DepartmentDelete section={section} record={row} />}
        </>
      ) : (
        <WorkspaceList
          scope={scope}
          slug={slug}
          params={params}
          access={access}
        />
      )}
    </>
  );
}
function ProjectProgress({ row }: { row: RecordRow }) {
  return (
    <div className="project-progress">
      <label>
        Project progress: {value(row, "progress") || "0"}%
        <progress max={100} value={Number(row.progress) || 0} />
      </label>
      <p>
        {value(row, "completed_tasks") || "0"} of{" "}
        {value(row, "total_tasks") || "0"} tasks completed
      </p>
    </div>
  );
}
type Access = NonNullable<Awaited<ReturnType<typeof authorized>>> | null;
async function WorkspaceList({
  scope,
  slug,
  params,
  access,
}: {
  scope: ModuleScope;
  slug: string;
  params: Params;
  access: Access;
}) {
  const section = getSection(scope, slug)!;
  const data = access
    ? await list(access, section, params)
    : { rows: [], total: 0, filters: { page: 1 } };
  return (
    <section className="panel">
      <FilterForm section={section} params={params} />
      <DepartmentTable
        section={section}
        rows={data.rows}
        params={params}
        connected={!!access}
      />
      <Pagination
        section={section}
        params={params}
        total={data.total}
        page={data.filters.page}
      />
    </section>
  );
}
async function ProjectTasks({
  project,
  access,
  params,
  write,
}: {
  project: RecordRow;
  access: Access;
  params: Params;
  write: boolean;
}) {
  const section = getSection("platform", "issues")!;
  const scoped = { ...params, project: project.id };
  const data = access
    ? await list(access, section, scoped)
    : { rows: [], total: 0, filters: { page: 1 } };
  const pageUrl = (n: number) => {
    const p: Record<string, string> = {
      record: project.id,
      project: project.id,
      page: String(n),
    };
    for (const k of [
      "q",
      "status",
      "sort",
      "direction",
      "employee",
      "employee_label",
      "priority",
    ])
      if (param(params, k)) p[k] = param(params, k);
    return modulePath("platform", "projects", p);
  };
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Tasks / Issues</h2>
        {write && (
          <Link
            className="button primary"
            href={modulePath("platform", "issues", {
              project: project.id,
              new: "1",
            })}
          >
            New task / issue
          </Link>
        )}
      </div>
      <FilterForm
        section={section}
        params={scoped}
        contextRecord={project.id}
      />
      <DepartmentTable
        section={section}
        rows={data.rows}
        params={{ project: project.id }}
        connected={!!access}
      />
      <div className="pagination">
        <span>{data.total} tasks / issues</span>
        <div className="actions">
          {data.filters.page > 1 && (
            <Link className="button" href={pageUrl(data.filters.page - 1)}>
              Previous
            </Link>
          )}
          {data.filters.page * 25 < data.total && (
            <Link className="button" href={pageUrl(data.filters.page + 1)}>
              Next
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
export async function WorkspacePage(args: {
  scope: ModuleScope;
  slug: string;
  params: Params;
}) {
  let content: React.ReactNode;
  try {
    content = await Contents(args);
  } catch (e) {
    unstable_rethrow(e);
    content = null;
  }
  if (content === null)
    return (
      <EmptyState
        title="Workspace needs attention"
        description="Your records have not been changed. Check your connection, permissions and migrations 0009–0010."
      />
    );
  return content;
}
