import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import { modulePath, value, param } from "@/lib/departments/config";
import type {
  Section,
  Field,
  RecordRow,
  Params,
} from "@/lib/departments/types";
import { filters } from "@/lib/departments/data";
export function url(
  section: Section,
  params: Params,
  changes: Record<string, string | null>,
) {
  const query: Record<string, string> = {};
  for (const [key, v] of Object.entries(params))
    if (typeof v === "string") query[key] = v;
  for (const [key, v] of Object.entries(changes))
    if (v === null) delete query[key];
    else query[key] = v;
  return modulePath(section.department, section.slug, query);
}
export function FieldValue({
  field,
  record,
}: {
  field: Field;
  record: RecordRow;
}) {
  const raw = value(
    record,
    ["reference", "project", "party"].includes(field.type)
      ? field.key + "_label"
      : field.key,
  );
  if (!raw) return <>—</>;
  if (field.type === "date") {
    const day = raw.slice(0, 10);
    return (
      <time dateTime={day}>
        {new Intl.DateTimeFormat("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(day + "T00:00:00Z"))}
      </time>
    );
  }
  if (field.type === "url") {
    return /^https?:\/\//i.test(raw) ? (
      <a
        className="text-link"
        href={raw}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open file / link <ArrowUpRight size={13} />
      </a>
    ) : (
      <>Unavailable link</>
    );
  }
  if (field.key === "refunded")
    return (
      <span className={`badge ${raw === "Yes" ? "refund-yes" : "refund-no"}`}>
        {raw}
      </span>
    );
  if (field.type === "select") return <Badge>{raw}</Badge>;
  return (
    <span className="sales-cell-text" title={raw}>
      {raw}
    </span>
  );
}
export function FilterForm({
  section,
  params,
}: {
  section: Section;
  params: Params;
}) {
  const f = filters(section, params);
  const status = section.fields.find(
    (field) => field.key === section.statusKey,
  );
  const date = section.fields.find((field) => field.type === "date");
  return (
    <form
      className="sales-filters"
      method="get"
      aria-label={`Filter ${section.title}`}
    >
      <label className="sales-search">
        Search
        <input
          type="search"
          name="q"
          defaultValue={f.q}
          maxLength={100}
          placeholder="Search records and related names…"
        />
      </label>
      {status && (
        <label>
          {status.label}
          <select name="status" defaultValue={f.status}>
            <option value="">All</option>
            {status?.options?.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
      )}
      <label>
        Sort by
        <select name="sort" defaultValue={f.sort}>
          {section.fields.map((field) => (
            <option key={field.key} value={field.key}>
              {field.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Order
        <select name="direction" defaultValue={f.direction}>
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </label>
      {date && (
        <details className="sales-more-filters">
          <summary>Date filters</summary>
          <div>
            <label>
              {section.slug === "follow-ups" ? "Follow-up Date" : date.label}{" "}
              from
              <input type="date" name="from" defaultValue={f.from} />
            </label>
            <label>
              To
              <input type="date" name="to" defaultValue={f.to} />
            </label>
          </div>
        </details>
      )}
      {["metric", "project", "session"].map(
        (key) =>
          param(params, key) && (
            <input
              key={key}
              type="hidden"
              name={key}
              value={param(params, key)}
            />
          ),
      )}
      <button className="button">Apply filters</button>
      <Link
        className="text-link"
        href={modulePath(section.department, section.slug)}
      >
        Reset
      </Link>
      {(f.metric || f.project || f.session) && (
        <p className="department-filter-note">
          Showing a focused view. Reset to see all records.
        </p>
      )}
    </form>
  );
}
export function DepartmentTable({
  section,
  rows,
  params,
  connected,
}: {
  section: Section;
  rows: RecordRow[];
  params: Params;
  connected: boolean;
}) {
  return (
    <>
      <div
        className="sales-table-scroll"
        role="region"
        aria-label={`${section.title} table`}
        tabIndex={0}
      >
        <table className="sales-table department-table">
          <thead>
            <tr>
              {section.fields.map((f) => (
                <th key={f.key} scope="col">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {section.fields.map((field, i) => (
                  <td key={field.key}>
                    {i === 0 ? (
                      <Link
                        className="sales-record-link"
                        href={url(section, params, {
                          record: row.id,
                          new: null,
                          edit: null,
                          saved: null,
                        })}
                      >
                        <FieldValue field={field} record={row} />
                        <ArrowUpRight size={13} />
                      </Link>
                    ) : (
                      <FieldValue field={field} record={row} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <EmptyState
          title={`No ${section.title.toLowerCase()} to show`}
          description={
            connected
              ? "Create a record or adjust your search and filters."
              : "The table follows your specification. Connect your employee workspace to save and view records."
          }
          action={
            <Link
              className="button"
              href={modulePath(section.department, section.slug, { new: "1" })}
            >
              Create {section.singular}
            </Link>
          }
        />
      )}
    </>
  );
}
export function Pagination({
  section,
  params,
  total,
  page,
}: {
  section: Section;
  params: Params;
  total: number;
  page: number;
}) {
  return (
    <div className="pagination">
      <span>
        {total ? `${(page - 1) * 25 + 1}–${Math.min(total, page * 25)}` : "0"}{" "}
        of {total} records
      </span>
      <div className="actions">
        {page > 1 && (
          <Link
            className="button"
            href={url(section, params, { page: String(page - 1) })}
          >
            Previous
          </Link>
        )}
        <span>Page {page}</span>
        {page * 25 < total && (
          <Link
            className="button"
            href={url(section, params, { page: String(page + 1) })}
          >
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
