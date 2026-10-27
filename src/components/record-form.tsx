"use client";
import { useActionState } from "react";
import Link from "next/link";
import { saveRecord, deleteRecord } from "@/app/(workspace)/directory/actions";
import type { RecordData, Entity } from "@/lib/directory";
export function RecordForm({
  entity,
  record,
  accounts = [],
}: {
  entity: Entity;
  record?: RecordData;
  accounts?: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(
    saveRecord.bind(null, entity, record?.id ?? null),
    { error: "" },
  );
  const input = (
    name: keyof RecordData,
    label: string,
    type = "text",
    required = false,
  ) => (
    <label key={name}>
      {label}
      {required ? " *" : ""}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={String(record?.[name] ?? "")}
        maxLength={name === "name" ? 200 : name.includes("name") ? 100 : 250}
      />
    </label>
  );
  const select = (name: keyof RecordData, label: string, options: string[]) => (
    <label>
      {label}
      <select name={name} defaultValue={String(record?.[name] ?? options[0])}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
  return (
    <form action={action} className="prose">
      {state.error && (
        <div className="form-error" role="alert">
          {state.error}
        </div>
      )}
      <div className="form-grid">
        {entity === "accounts" ? (
          <>
            {input("name", "Institution name", "text", true)}
            {select("institution_type", "Institution type", [
              "University",
              "Faculty",
              "Research institution",
              "Library",
              "Other",
            ])}
            {input("country", "Country")}
            {input("city", "City")}
            {input("website", "Website", "url")}
            {select("business", "Business association", [
              "Justech",
              "Al-Fikr",
              "Both",
            ])}
            {select("status", "Status", ["Prospect", "Active", "Inactive"])}
          </>
        ) : (
          <>
            {input("first_name", "First name", "text", true)}
            {input("last_name", "Last name", "text", true)}
            {input("job_title", "Job title")}
            {input("department", "Department")}
            <label>
              Institution *
              <select
                name="account_id"
                required
                defaultValue={record?.account_id ?? ""}
              >
                <option value="" disabled>
                  Select an institution
                </option>
                {accounts.map((a) => (
                  <option value={a.id} key={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {input("email", "Email", "email")}
        {input("phone", "Phone", "tel")}
        <label className="full">
          Notes
          <textarea
            name="notes"
            maxLength={5000}
            defaultValue={record?.notes ?? ""}
          />
        </label>
      </div>
      <p className="muted">
        Required fields are marked *. New records are assigned to you. Owner
        reassignment is not yet available.
      </p>
      <div className="form-actions">
        <Link
          className="button"
          href={
            record
              ? `/directory/${entity}/${record.id}`
              : `/directory?type=${entity}`
          }
        >
          Cancel
        </Link>
        <button className="button primary" disabled={pending}>
          {pending ? "Saving…" : record ? "Save changes" : "Create record"}
        </button>
      </div>
    </form>
  );
}
export function DeleteForm({ entity, id }: { entity: Entity; id: string }) {
  const [state, action, pending] = useActionState(
    deleteRecord.bind(null, entity, id),
    { error: "" },
  );
  return (
    <details className="prose">
      <summary className="text-link">Delete this record</summary>
      <form action={action}>
        <p>
          This permanently deletes the record. An institution with associated
          contacts cannot be deleted.
        </p>
        {state.error && (
          <div className="form-error" role="alert">
            {state.error}
          </div>
        )}
        <label>
          Type DELETE to confirm
          <input
            name="confirmation"
            required
            pattern="DELETE"
            autoComplete="off"
          />
        </label>
        <button
          className="button danger"
          style={{ marginTop: 14 }}
          disabled={pending}
        >
          {pending ? "Deleting…" : "Permanently delete"}
        </button>
      </form>
    </details>
  );
}
