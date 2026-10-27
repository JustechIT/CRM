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
function ChoiceField({
  section,
  field,
  source,
  fields,
  canWrite,
}: {
  section: Section;
  field: "project" | "party";
  source: Record<string, unknown> | undefined;
  fields?: Record<string, string>;
  canWrite: boolean;
}) {
  const isProject = field === "project";
  const initialType = isProject
    ? fields
      ? fields.project_id
        ? "projects"
        : "area"
      : value(source, "project_id") || !value(source, "area")
        ? "projects"
        : "area"
    : (fields?.party_type ??
      (value(source, "contact_id") ? "contacts" : "accounts"));
  const [type, setType] = useState(initialType);
  const mode = useId();
  const initialId = isProject
    ? value(source, "project_id")
    : value(source, type === "contacts" ? "contact_id" : "account_id");
  const fieldName = isProject ? "project_id" : "party_id";
  const savedId = fields?.[fieldName] ?? initialId;
  const label =
    fields?.[fieldName + "_label"] ??
    value(source, isProject ? "project_id_label" : "party_label");
  return (
    <fieldset className="department-choice">
      <legend>
        {isProject ? "Project / Area" : "Contact / Organization"} *
      </legend>
      <label htmlFor={mode}>{isProject ? "Link to" : "Reference type"}</label>
      <select
        id={mode}
        name={isProject ? undefined : "party_type"}
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        {isProject ? (
          <>
            <option value="projects">Existing project</option>
            <option value="area">Area</option>
          </>
        ) : (
          <>
            <option value="accounts">Organization</option>
            <option value="contacts">Contact</option>
          </>
        )}
      </select>
      {isProject && type === "area" ? (
        <>
          <input type="hidden" name="project_id" value="" />
          <label>
            Area
            <input
              name="area"
              required
              maxLength={200}
              defaultValue={fields?.area ?? value(source, "area")}
            />
          </label>
        </>
      ) : (
        <>
          {isProject && <input type="hidden" name="area" value="" />}
          <ReferencePicker
            key={type}
            name={fieldName}
            label={
              isProject
                ? "Project"
                : type === "accounts"
                  ? "Organization"
                  : "Contact"
            }
            entity={type as "projects" | "accounts" | "contacts"}
            department={section.department}
            initialId={type === initialType ? savedId : ""}
            initialLabel={type === initialType ? label : ""}
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
      <div className="form-grid">
        {section.fields.map((f) =>
          f.type === "reference" ? (
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
          ) : f.type === "project" || f.type === "party" ? (
            <ChoiceField
              key={f.key}
              section={section}
              field={f.type}
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
                    f.type === "integer"
                      ? "number"
                      : ["date", "url", "email"].includes(f.type)
                        ? f.type
                        : "text"
                  }
                  min={f.type === "integer" ? 0 : undefined}
                  max={f.type === "integer" ? 2147483647 : undefined}
                  step={f.type === "integer" ? 1 : undefined}
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
        * Required fields. Reference choices come from existing records; no
        duplicate organizations, employees or products are created.
      </p>
      <div className="form-actions">
        <Link
          className="button"
          href={modulePath(
            section.department,
            section.slug,
            record ? { record: record.id } : {},
          )}
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
