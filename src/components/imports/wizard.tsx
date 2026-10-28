"use client";
import Link from "next/link";
import { useState } from "react";
import { importFields, type Batch } from "@/lib/imports/validation";
import { importRequestId } from "@/lib/imports/request-id";
import { csvCell } from "@/lib/sales/csv";
type Parsed = {
  headers: string[];
  rows: string[][];
  sheets: string[];
  sheet: string;
};
type Checked = {
  row: number;
  data: Record<string, unknown> | null;
  error: string;
  duplicate: boolean;
};
function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function ImportWizard({ enabled }: { enabled: boolean }) {
  const [entity, setEntity] = useState<"accounts" | "contacts">("accounts"),
    [file, setFile] = useState<File | null>(null),
    [parsed, setParsed] = useState<Parsed | null>(null),
    [mapping, setMapping] = useState<Record<string, number>>({}),
    [defaults, setDefaults] = useState<Batch["defaults"]>({
      institution_type: "Other",
      status: "Prospect",
      business: "Justech",
    }),
    [preview, setPreview] = useState<Checked[] | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [runId, setRunId] = useState(""),
    [result, setResult] = useState<{
      inserted: number;
      skipped: number;
    } | null>(null);
  const invalidate = () => {
    setPreview(null);
    setConfirmed(false);
    setResult(null);
    setRunId(importRequestId());
  };
  const load = async (sheet?: string) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const f = new FormData();
      f.set("file", file);
      if (sheet) f.set("sheet", sheet);
      const r = await fetch("/api/directory/import/parse", {
        method: "POST",
        body: f,
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setParsed(d);
      const normalize = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const m: Record<string, number> = {};
      for (const [key, label] of importFields[entity])
        m[key] = d.headers.findIndex((h: string) =>
          [normalize(key), normalize(label)].includes(normalize(h)),
        );
      setMapping(m);
      invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "File could not be read.");
    } finally {
      setBusy(false);
    }
  };
  const payload = () => ({
    entity,
    rows: parsed?.rows ?? [],
    mapping,
    defaults,
  });
  const errors = preview?.filter((r) => r.error).length ?? 0,
    duplicates = preview?.filter((r) => r.duplicate).length ?? 0;
  return (
    <>
      <section className="panel">
        <h2>1. Choose your file</h2>
        <p className="muted">
          UTF-8 CSV or XLSX, up to 5 MB and 500 data rows. The first row must
          contain column names. Keep phone numbers and identifiers formatted as
          text in Excel to preserve leading zeroes.
        </p>
        <form
          className="sales-form"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <label>
            Import type
            <select
              value={entity}
              onChange={(e) => {
                setEntity(e.target.value as "accounts" | "contacts");
                setParsed(null);
                invalidate();
              }}
            >
              <option value="accounts">Accounts / Institutions</option>
              <option value="contacts">Contacts</option>
            </select>
          </label>
          <label>
            CSV / Excel file
            <input
              type="file"
              accept=".csv,.xlsx"
              disabled={!enabled}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setParsed(null);
                invalidate();
              }}
            />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="button"
              onClick={() =>
                download(
                  importFields[entity].map(([, l]) => csvCell(l)).join(",") +
                    "\r\n",
                  `${entity}-template.csv`,
                )
              }
            >
              Download blank template
            </button>
            <button
              className="button primary"
              disabled={!enabled || !file || busy}
            >
              {busy ? "Reading…" : "Read file"}
            </button>
          </div>
        </form>
        {!enabled && (
          <p className="notice">
            Sign in with Accounts & Contacts write access to import records.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </section>
      {parsed && (
        <section className="panel">
          <h2>2. Match your columns</h2>
          <p>{parsed.rows.length} data rows found. Nothing has been saved.</p>
          {parsed.sheets.length > 1 && (
            <label>
              Worksheet
              <select
                value={parsed.sheet}
                onChange={(e) => void load(e.target.value)}
              >
                {parsed.sheets.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
          <div className="form-grid">
            {importFields[entity].map(([key, label]) => (
              <label key={key}>
                {label}
                <select
                  value={mapping[key] ?? -1}
                  onChange={(e) => {
                    setMapping((old) => ({ ...old, [key]: +e.target.value }));
                    invalidate();
                  }}
                >
                  <option value={-1}>Not mapped</option>
                  {parsed.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h} (column {i + 1})
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {entity === "accounts" && (
            <>
              <h3>Defaults for empty fields</h3>
              <div className="form-grid">
                {(
                  [
                    [
                      "institution_type",
                      "Institution Type",
                      [
                        "University",
                        "Faculty",
                        "Research institution",
                        "Library",
                        "Other",
                      ],
                    ],
                    ["status", "Status", ["Prospect", "Active", "Inactive"]],
                    ["business", "Business", ["Justech", "Al-Fikr", "Both"]],
                  ] as const
                ).map(([k, label, values]) => (
                  <label key={k}>
                    {label}
                    <select
                      value={defaults[k]}
                      onChange={(e) => {
                        setDefaults((old) => ({ ...old, [k]: e.target.value }));
                        invalidate();
                      }}
                    >
                      {values.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </>
          )}
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = await fetch("/api/directory/import/preview", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload()),
                });
                const d = await r.json();
                if (!r.ok) throw Error(d.error);
                setPreview(d.rows);
                setConfirmed(false);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Preview failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Check & preview
          </button>
        </section>
      )}
      {preview && (
        <section className="panel">
          <h2>3. Review and confirm</h2>
          <p>
            {preview.length} rows · {errors} errors · {duplicates} duplicates.
            Duplicates are skipped; existing records are never overwritten.
          </p>
          <div
            className="table-wrap import-preview-scroll"
            role="region"
            aria-label="Import preview"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Data row</th>
                  <th>Record</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r) => (
                  <tr key={r.row}>
                    <td>{r.row}</td>
                    <td>{String(r.data?.name ?? r.data?.first_name ?? "—")}</td>
                    <td>
                      {r.error ||
                        (r.duplicate ? "Duplicate — will be skipped" : "Ready")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="button"
            onClick={() =>
              download(
                [
                  "Row,Result",
                  ...preview.map((r) =>
                    [r.row, r.error || (r.duplicate ? "Duplicate" : "Ready")]
                      .map(csvCell)
                      .join(","),
                  ),
                ].join("\r\n"),
                "import-report.csv",
              )
            }
          >
            Download validation report
          </button>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={errors > 0}
            />
            I reviewed the mapping and rows. Import valid records and skip
            duplicates.
          </label>
          <button
            className="button primary"
            disabled={!enabled || !confirmed || errors > 0 || busy || !!result}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = await fetch("/api/directory/import/commit", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ...payload(),
                    request_id: runId,
                    confirmed: true,
                  }),
                });
                const d = await r.json();
                if (!r.ok) throw Error(d.error);
                setResult(d);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Import failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Importing…" : "Confirm import"}
          </button>
          {result && (
            <p className="success" role="status">
              Imported {result.inserted} records; skipped {result.skipped}{" "}
              duplicates.{" "}
              <Link href={`/directory?type=${entity}`}>Open directory</Link>
            </p>
          )}
        </section>
      )}
    </>
  );
}
