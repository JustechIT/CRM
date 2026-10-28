"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { invoiceFields, invoiceBase, type Invoice } from "@/lib/finance/config";
import { paymentStatuses } from "@/lib/sales/config";
export function InvoiceForm({ record }: { record?: Invoice }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="sales-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const form = new FormData(e.currentTarget);
        if (record) {
          form.set("id", record.id);
          form.set("revision", String(record.revision));
        }
        try {
          const r = await fetch("/api/finance/supplier-invoices", {
            method: record ? "PATCH" : "POST",
            body: form,
          });
          const data = await r.json();
          if (!r.ok) throw Error(data.error || "Save failed.");
          router.push(`${invoiceBase}?record=${data.id}`);
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Save failed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-grid">
        {invoiceFields
          .filter((f) => f[2] !== "file")
          .map(([key, label, type]) => (
            <label key={key}>
              {label}
              {key !== "notes" ? " *" : ""}
              {type === "select" ? (
                <select name={key} defaultValue={record?.[key] || "Unpaid"}>
                  {paymentStatuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              ) : type === "textarea" ? (
                <textarea
                  name={key}
                  maxLength={5000}
                  defaultValue={record?.[key] || ""}
                />
              ) : (
                <input
                  name={key}
                  type={type}
                  required
                  step={type === "number" ? "0.001" : undefined}
                  min={type === "number" ? 0 : undefined}
                  maxLength={key === "currency" ? 3 : 250}
                  defaultValue={
                    record?.[key] ??
                    (type === "date"
                      ? new Date().toISOString().slice(0, 10)
                      : "")
                  }
                />
              )}
            </label>
          ))}
      </div>
      <p className="muted">
        Save the invoice first, then attach its private PDF, PNG or JPEG file.
      </p>
      <div className="form-actions">
        <Link className="button" href={invoiceBase}>
          Cancel
        </Link>
        <button className="button primary" disabled={busy}>
          {busy ? "Saving…" : "Save invoice"}
        </button>
      </div>
    </form>
  );
}
export function InvoiceFiles({ record }: { record: Invoice }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel sales-record-detail">
      <h2>Private invoice file</h2>
      {record.file_name ? (
        <p>
          <a
            className="button"
            href={`/api/finance/supplier-invoices/${record.id}/file`}
          >
            Download {record.file_name}
          </a>
        </p>
      ) : (
        <p className="muted">No file attached.</p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const form = new FormData(e.currentTarget);
          form.set("revision", String(record.revision));
          try {
            const r = await fetch(
              `/api/finance/supplier-invoices/${record.id}/file`,
              { method: "POST", body: form },
            );
            const d = await r.json();
            if (!r.ok) throw Error(d.error);
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Upload failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {record.file_name ? "Replace file" : "Upload file"}
          <input
            type="file"
            name="file"
            accept="application/pdf,image/png,image/jpeg"
            required
          />
        </label>
        <p className="muted">
          PDF, PNG or JPEG, up to 10 MB. Downloads require current
          authorization.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="button" disabled={busy}>
          {busy ? "Uploading…" : "Upload privately"}
        </button>
      </form>
    </section>
  );
}
export function InvoiceDelete({ record }: { record: Invoice }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <details className="sales-delete">
      <summary>Delete this supplier invoice</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const r = await fetch("/api/finance/supplier-invoices", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: record.id,
                revision: record.revision,
              }),
            });
            const d = await r.json();
            if (!r.ok) throw Error(d.error);
            router.push(invoiceBase);
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Delete failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>This permanently deletes the invoice and its attached file.</p>
        <label>
          Type DELETE to confirm
          <input required pattern="DELETE" />
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="button danger" disabled={busy}>
          Delete invoice
        </button>
      </form>
    </details>
  );
}
