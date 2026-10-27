"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Download, RefreshCw } from "lucide-react";
import {
  saveSales,
  deleteSales,
  saveProduct,
} from "@/app/(workspace)/modules/justech-sales/actions";
import {
  salesDefinitions,
  salesPath,
  salesBase,
  quotationStatuses,
  type SalesSection,
  type SubscriptionKind,
} from "@/lib/sales/config";
import type { SalesRecord } from "@/lib/sales/data";
import { utcDay } from "@/lib/sales/metrics";
import { SalesLookup } from "./lookup";
function value(
  record: Record<string, unknown> | undefined,
  key: string,
  fallback = "",
) {
  const v = record?.[key];
  return typeof v === "string" || typeof v === "number" ? String(v) : fallback;
}
export function SalesForm({
  section,
  kind,
  record,
  prefill,
  canWrite,
}: {
  section: SalesSection;
  kind?: SubscriptionKind;
  record?: SalesRecord;
  prefill?: Record<string, unknown>;
  canWrite: boolean;
}) {
  const [state, action, pending] = useActionState(
    saveSales.bind(null, section, record?.id ?? null),
    { error: "" },
  );
  const definition = salesDefinitions[section];
  const source = record ?? prefill;
  const defaults: Record<string, string> = {
    date: utcDay(),
    stage: "New",
    renewal_stage: "Not started",
    status: "Active",
    decision_status: "Draft",
  };
  const fieldValue = (key: string) =>
    state.fields?.[key] ?? value(source, key, defaults[key] ?? "");
  return (
    <form
      action={action}
      className="sales-form"
      aria-label={`${record ? "Edit" : "New"} ${definition.singular}`}
    >
      {state.error && (
        <div className="form-error" role="alert">
          <AlertCircle size={17} />
          {state.error}
        </div>
      )}
      {!canWrite && (
        <div className="notice">
          <p>
            You can inspect this form. Saving requires a connected database and
            Sales write permission.
          </p>
        </div>
      )}
      {record && (
        <input type="hidden" name="revision" value={record.revision} />
      )}{" "}
      {kind && <input type="hidden" name="kind" value={kind} />}
      <div className="form-grid">
        {definition.fields.map((field) =>
          field.type === "account" || field.type === "product" ? (
            <SalesLookup
              key={`${field.key}-${state.error}`}
              name={field.key}
              label={field.label}
              entity={field.type === "account" ? "accounts" : "products"}
              initialId={fieldValue(field.key)}
              initialLabel={
                state.fields?.[field.key + "_label"] ??
                value(
                  source,
                  field.type === "account" ? "account_name" : "product_name",
                )
              }
              kind={
                field.type === "product" && section === "subscriptions"
                  ? kind
                  : undefined
              }
              disabled={!canWrite}
            />
          ) : (
            <label
              key={field.key}
              className={field.type === "textarea" ? "full" : undefined}
            >
              {field.label}
              {field.required ? " *" : ""}
              {field.type === "textarea" ? (
                <textarea
                  name={field.key}
                  maxLength={5000}
                  defaultValue={fieldValue(field.key)}
                />
              ) : (
                <input
                  name={field.key}
                  type={field.type === "date" ? "date" : "text"}
                  inputMode={field.type === "money" ? "decimal" : undefined}
                  required={field.required}
                  defaultValue={fieldValue(field.key)}
                  maxLength={
                    field.type === "currency"
                      ? 3
                      : field.key === "next_action"
                        ? 500
                        : field.key === "contract_duration"
                          ? 100
                          : field.key === "name"
                            ? 200
                            : 250
                  }
                  list={
                    field.suggestions
                      ? `sales-${field.key}-choices`
                      : field.type === "currency"
                        ? "sales-currencies"
                        : undefined
                  }
                  placeholder={
                    field.type === "money"
                      ? "0.000"
                      : field.type === "currency"
                        ? "TND / EUR / USD"
                        : undefined
                  }
                />
              )}{" "}
              {field.suggestions && (
                <datalist id={`sales-${field.key}-choices`}>
                  {field.suggestions.map((choice) => (
                    <option value={choice} key={choice} />
                  ))}
                </datalist>
              )}
              {field.help && <small className="muted">{field.help}</small>}
            </label>
          ),
        )}
      </div>
      <datalist id="sales-currencies">
        {["TND", "EUR", "USD"].map((c) => (
          <option value={c} key={c} />
        ))}
      </datalist>
      {section === "quotations" && (
        <div className="sales-workflow">
          <h2>Review status</h2>
          <p className="muted">
            Track the decision without changing the quotation columns. Financial
            totals are entered independently; no undocumented formula is
            applied.
          </p>
          <label>
            Decision
            <select
              name="decision_status"
              defaultValue={fieldValue("decision_status")}
            >
              {quotationStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="sales-form-help">
        <span>
          * Required fields. Institutions come from Accounts & Contacts.
        </span>
        <Link
          href={`${salesBase}/subscriptions?catalog=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-link"
        >
          Manage products (opens new tab)
        </Link>
        <Link
          href="/directory/new"
          target="_blank"
          rel="noopener noreferrer"
          className="text-link"
        >
          Add institution (opens new tab)
        </Link>
      </div>
      <div className="form-actions">
        <Link
          href={
            record
              ? `${salesPath(section, kind)}${kind ? "&" : "?"}record=${record.id}`
              : salesPath(section, kind)
          }
          className="button"
        >
          Cancel
        </Link>
        <button className="button primary" disabled={!canWrite || pending}>
          {pending
            ? "Saving…"
            : record
              ? "Save changes"
              : `Create ${definition.singular}`}
        </button>
      </div>
    </form>
  );
}
export function SalesDelete({
  section,
  record,
  kind,
}: {
  section: SalesSection;
  record: SalesRecord;
  kind?: SubscriptionKind;
}) {
  const [state, action, pending] = useActionState(
    deleteSales.bind(null, section, record.id),
    { error: "" },
  );
  return (
    <details className="sales-delete">
      <summary>Delete this {salesDefinitions[section].singular}</summary>
      <form action={action}>
        <p>
          This permanently removes the record. Its audit history is retained.
          Type DELETE to confirm.
        </p>
        {state.error && (
          <p role="alert" className="form-error">
            {state.error}
          </p>
        )}
        <input type="hidden" name="revision" value={record.revision} />
        {kind && <input type="hidden" name="kind" value={kind} />}
        <label>
          Confirmation
          <input
            name="confirmation"
            autoComplete="off"
            required
            pattern="DELETE"
          />
        </label>
        <button className="button danger" disabled={pending}>
          {pending ? "Deleting…" : "Permanently delete"}
        </button>
      </form>
    </details>
  );
}
export function ProductForm({
  product,
  canWrite,
}: {
  product?: Record<string, unknown>;
  canWrite: boolean;
}) {
  const [state, action, pending] = useActionState(
    saveProduct.bind(null, product ? String(product.id) : null),
    { error: "" },
  );
  return (
    <form className="sales-form" action={action}>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      {product && (
        <input type="hidden" name="revision" value={String(product.revision)} />
      )}
      <div className="form-grid">
        <label>
          Product name *
          <input
            name="name"
            required
            maxLength={200}
            defaultValue={state.fields?.name ?? value(product, "name")}
          />
        </label>
        <label>
          Subscription section *
          <select
            name="subscription_kind"
            defaultValue={
              state.fields?.subscription_kind ??
              value(product, "subscription_kind", "Other")
            }
          >
            <option>Other</option>
            <option>Turnitin</option>
          </select>
        </label>
      </div>
      <p className="muted">
        Used by the existing Sales sections. Products with subscriptions cannot
        be moved between sections.
      </p>
      <div className="form-actions">
        {product && (
          <Link
            className="button"
            href={`${salesBase}/subscriptions?catalog=1`}
          >
            Cancel edit
          </Link>
        )}
        <button className="button primary" disabled={!canWrite || pending}>
          {pending ? "Saving…" : product ? "Save product" : "Add product"}
        </button>
      </div>
    </form>
  );
}
export function SalesRetry() {
  const router = useRouter();
  return (
    <button className="button" onClick={() => router.refresh()}>
      <RefreshCw size={15} />
      Try again
    </button>
  );
}
export function SalesExport({
  url,
  disabled,
}: {
  url: string;
  disabled: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="sales-export">
      <button
        className="button"
        disabled={disabled || pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            const response = await fetch(url);
            if (!response.ok) {
              const result = await response.json();
              throw new Error(result.error ?? "Export failed.");
            }
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download =
              response.headers
                .get("Content-Disposition")
                ?.match(/filename="([^"]+)"/)?.[1] ?? "justech-sales.csv";
            link.click();
            URL.revokeObjectURL(objectUrl);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Export failed.");
          } finally {
            setPending(false);
          }
        }}
      >
        <Download size={15} />
        {pending ? "Preparing…" : "Export CSV"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
