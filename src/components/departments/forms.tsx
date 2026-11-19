"use client";
import Link from "next/link";
import { useActionState, useState, useId } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import {
  saveDepartment,
  deleteDepartment,
} from "@/app/(workspace)/modules/justech-departments/actions";
import { modulePath, value } from "@/lib/departments/config";
import type { Section, RecordRow } from "@/lib/departments/types";
import { ReferencePicker } from "./reference-picker";
function ProjectField({
  section,
  source,
  fields,
  canWrite,
}: {
  section: Section;
  source: Record<string, unknown> | undefined;
  fields?: Record<string, string>;
  canWrite: boolean;
}) {
  const initialId = fields?.project_id ?? value(source, "project_id");
  const area = fields?.area ?? value(source, "area");
  const [type, setType] = useState(initialId || !area ? "projects" : "area");
  const mode = useId();
  return (
    <fieldset className="department-choice">
      <legend>Project / Area *</legend>
      <label htmlFor={mode}>Link to</label>
      <select id={mode} value={type} onChange={(e) => setType(e.target.value)}>
        <option value="projects">Existing project</option>
        <option value="area">Area</option>
      </select>
      {type === "area" ? (
        <>
          <input type="hidden" name="project_id" value="" />
          <label>
            Area
            <input name="area" required maxLength={200} defaultValue={area} />
          </label>
        </>
      ) : (
        <>
          <input type="hidden" name="area" value="" />
          <ReferencePicker
            name="project_id"
            label="Project"
            entity="projects"
            department={section.department}
            initialId={initialId}
            initialLabel={fields?.project_id_label ?? value(source, "project_id_label")}
            disabled={!canWrite}
          />
        </>
      )}
    </fieldset>
  );
}
export function DepartmentForm({
  section,
  record,
  prefill,
  canWrite,
}: {
  section: Section;
  record?: RecordRow;
  prefill?: Record<string, unknown>;
  canWrite: boolean;
}) {
  const [state, action, pending] = useActionState(
    saveDepartment.bind(
      null,
      section.department,
      section.slug,
      record?.id ?? null,
    ),
    { error: "" },
  );
  const source = record ?? prefill;
  const generated = useId();
  const get = (key: string) => state.fields?.[key] ?? value(source, key);
  return (
    <form
      action={action}
      className="sales-form department-form"
      aria-label={`${record ? "Edit" : "New"} ${section.singular}`}
    >
      {state.error && (
        <div className="form-error" role="alert">
          {state.error}
        </div>
      )}
      {!canWrite && (
        <div className="notice">
          <p>
            You can inspect this form. Saving requires your connected database
            and department write permission.
          </p>
        </div>
      )}
      {record && (
        <input name="revision" type="hidden" value={record.revision} />
      )}
      {section.slug === "issues" && (
        <input type="hidden" name="project_id" value={get("project_id")} />
      )}
      <div className="form-grid">
        {[...section.fields, ...(section.extraFields ?? [])].map((f) =>
          f.type === "reference" && f.reference === "accounts" ? (
            <label key={f.key}>
              {f.label}{f.required ? " *" : ""}
              <input name={f.key} required={f.required} maxLength={250}
                defaultValue={state.fields?.[f.key] ?? value(source, f.key + "_label")} />
            </label>
          ) : f.type === "reference" ? (
            <ReferencePicker
              key={f.key}
              name={f.key}
              label={f.label}
              entity={f.reference!}
              department={section.department}
              purpose={
                section.slug === "training-history"
                  ? "history"
                  : section.slug === "registrations"
                    ? "registration"
                    : undefined
              }
              initialId={get(f.key)}
              initialLabel={
                state.fields?.[f.key + "_label"] ??
                value(source, f.key + "_label")
              }
              disabled={!canWrite}
              required={f.required}
            />
          ) : f.type === "party" ? (
            <fieldset key={f.key} className="department-choice">
              <legend>Contact / Organization *</legend>
              <p>Enter one name.</p>
              <label>
                Contact
                <input name="contact" maxLength={200}
                  defaultValue={state.fields?.contact ?? value(source, "contact_name")} />
              </label>
              <label>
                Organization
                <input name="organization" maxLength={250}
                  defaultValue={state.fields?.organization ?? (source?.account_id ? value(source, "party_label") : "")} />
              </label>
            </fieldset>
          ) : f.type === "project" ? (
            <ProjectField
              key={f.key}
              section={section}
              source={source}
              fields={state.fields}
              canWrite={canWrite}
            />
          ) : (
            <label
              key={f.key}
              className={f.type === "textarea" ? "full" : undefined}
            >
              {f.label}
              {f.required ? " *" : ""}
              {f.type === "select" ? (
                <select
                  name={f.key}
                  required={f.required}
                  defaultValue={get(f.key) || f.options?.[0]}
                >
                  {f.options?.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  name={f.key}
                  required={f.required}
                  maxLength={f.max ?? 5000}
                  defaultValue={get(f.key)}
                />
              ) : (
                <input
                  name={f.key}
                  type={
                    ["integer", "money"].includes(f.type)
                      ? "number"
                      : ["date", "url", "email"].includes(f.type)
                        ? f.type
                        : "text"
                  }
                  min={["integer", "money"].includes(f.type) ? 0 : undefined}
                  max={
                    f.type === "integer"
                      ? f.key === "publication_year"
                        ? 9999
                        : 2147483647
                      : undefined
                  }
                  step={
                    f.type === "integer"
                      ? 1
                      : f.type === "money"
                        ? "0.001"
                        : undefined
                  }
                  required={f.required}
                  maxLength={f.max ?? (f.type === "url" ? 2048 : 250)}
                  defaultValue={
                    f.type === "date" ? get(f.key).slice(0, 10) : get(f.key)
                  }
                  list={f.options ? generated + f.key : undefined}
                />
              )}{" "}
              {f.options && f.type !== "select" && (
                <datalist id={generated + f.key}>
                  {f.options.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </datalist>
              )}
              {f.help && <small className="muted">{f.help}</small>}
            </label>
          ),
        )}
      </div>
      {section.slug === "training-history" && (
        <p className="department-help">
          History is for completed sessions. Participants records actual
          attendance, which can differ from registrations.
        </p>
      )}
      <p className="department-help">
        {section.department === "alfikr-sales" &&
        section.slug === "opportunities"
          ? "* Required fields. Type the organization and product names directly."
          : "* Required fields. New contact and organization names are saved to Accounts & Contacts."}
      </p>
      <div className="form-actions">
        <Link
          className="button"
          href={
            section.slug === "issues" && !record
              ? modulePath("platform", "projects", {
                  record: value(source, "project_id"),
                })
              : modulePath(
                  section.department,
                  section.slug,
                  record ? { record: record.id } : {},
                )
          }
        >
          Cancel
        </Link>
        <button className="button primary" disabled={!canWrite || pending}>
          {pending
            ? "Saving…"
            : record
              ? "Save changes"
              : `Create ${section.singular}`}
        </button>
      </div>
    </form>
  );
}
export function DepartmentDelete({
  section,
  record,
}: {
  section: Section;
  record: RecordRow;
}) {
  const [state, action, pending] = useActionState(
    deleteDepartment.bind(null, section.department, section.slug, record.id),
    { error: "" },
  );
  return (
    <details className="sales-delete">
      <summary>Delete this {section.singular}</summary>
      <form action={action}>
        <p>
          This permanently removes the record. Its audit history is retained.
          Linked records must be removed or reassigned first.
        </p>
        {state.error && (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        )}
        <input type="hidden" name="revision" value={record.revision} />
        <label>
          Type DELETE to confirm
          <input
            name="confirmation"
            required
            pattern="DELETE"
            autoComplete="off"
          />
        </label>
        <button className="button danger" disabled={pending}>
          {pending ? "Deleting…" : "Permanently delete"}
        </button>
      </form>
    </details>
  );
}
export function Retry() {
  const router = useRouter();
  return (
    <button className="button" onClick={() => router.refresh()}>
      <RefreshCw size={15} />
      Try again
    </button>
  );
}
