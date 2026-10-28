import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  salesDefinitions,
  salesPath,
  opportunityStages,
  renewalStages,
  subscriptionStatuses,
  quotationStatuses,
  paymentStatuses,
  type SalesSection,
  type SubscriptionKind,
} from "@/lib/sales/config";
import type { SalesParams, SalesRecord, SalesFilters } from "@/lib/sales/data";
import { link, sectionTitle, RecordValue } from "./shared";

export function SalesTable({
  section,
  records,
  params,
  kind,
}: {
  section: SalesSection;
  records: SalesRecord[];
  params: SalesParams;
  kind?: SubscriptionKind;
}) {
  const fields = salesDefinitions[section].fields;
  return (
    <div
      className="sales-table-scroll"
      role="region"
      aria-label={`${sectionTitle(section, kind)} table`}
      tabIndex={0}
    >
      <table className={`sales-table sales-table-${section}`}>
        <thead>
          <tr>
            {fields.map((field) => (
              <th key={field.key} scope="col">
                {field.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              {fields.map((field, index) => (
                <td key={field.key}>
                  {index === 0 ? (
                    <Link
                      className="sales-record-link"
                      href={link(section, params, {
                        record: record.id,
                        new: null,
                        edit: null,
                        saved: null,
                      })}
                    >
                      <RecordValue record={record} field={field} />
                      <ArrowUpRight size={13} />
                    </Link>
                  ) : (
                    <RecordValue record={record} field={field} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SalesFilters({
  section,
  kind,
  filters,
}: {
  section: SalesSection;
  kind?: SubscriptionKind;
  filters: SalesFilters;
}) {
  const statuses =
    section === "payments"
      ? paymentStatuses
      : section === "opportunities"
        ? opportunityStages
        : section === "quotations"
          ? quotationStatuses
          : section === "subscriptions"
            ? subscriptionStatuses
            : renewalStages;
  const dateLabel =
    section === "payments"
      ? "Payment Date"
      : section === "opportunities"
        ? "Date"
        : section === "subscriptions"
          ? "End Date"
          : "Expiry Date";
  return (
    <form
      className="sales-filters"
      method="get"
      aria-label="Filter Sales records"
    >
      {filters.subscription && (
        <input type="hidden" name="subscription" value={filters.subscription} />
      )}
      {kind && <input type="hidden" name="kind" value={kind} />}
      <label className="sales-search">
        Search
        <input
          name="q"
          type="search"
          maxLength={100}
          defaultValue={filters.q}
          placeholder="Search organizations, products and records…"
        />
      </label>
      <label>
        {section === "quotations"
          ? "Review status"
          : section === "opportunities"
            ? "Stage"
            : section === "renewals"
              ? "Renewal Stage"
              : "Status"}
        <input
          name="status"
          defaultValue={filters.status}
          list="sales-status-filter"
          placeholder="All"
          maxLength={100}
        />
        <datalist id="sales-status-filter">
          {statuses.map((s) => (
            <option value={s} key={s} />
          ))}
        </datalist>
      </label>
      <label>
        Sort by
        <select name="sort" defaultValue={filters.sort}>
          {salesDefinitions[section].fields.map((f) => (
            <option value={f.key} key={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Order
        <select name="direction" defaultValue={filters.direction}>
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </label>
      <details className="sales-more-filters">
        <summary>More filters</summary>
        <div>
          {section !== "quotations" && (
            <>
              <label>
                {dateLabel} from
                <input name="from" type="date" defaultValue={filters.from} />
              </label>
              <label>
                {dateLabel} to
                <input name="to" type="date" defaultValue={filters.to} />
              </label>
            </>
          )}
          {(section === "subscriptions" || section === "renewals") && (
            <label>
              Expiry window
              <select name="window" defaultValue={filters.window}>
                <option value="">Any time</option>
                <option value="90">Next 90 days</option>
              </select>
            </label>
          )}
          {(section === "opportunities" || section === "renewals") && (
            <label>
              Follow-ups
              <select name="followup" defaultValue={filters.followup}>
                <option value="">All</option>
                <option value="overdue">Overdue only</option>
              </select>
            </label>
          )}
          {section === "quotations" && (
            <p>
              Search covers all quotation columns, including institution and
              product names.
            </p>
          )}
        </div>
      </details>
      <button className="button">Apply filters</button>
      <Link className="text-link" href={salesPath(section, kind)}>
        Reset
      </Link>
    </form>
  );
}

export function SalesPagination({
  section,
  params,
  page,
  total,
}: {
  section: SalesSection;
  params: SalesParams;
  page: number;
  total: number;
}) {
  return (
    <div className="pagination">
      <span>
        {total === 0
          ? "0"
          : `${(page - 1) * 25 + 1}–${Math.min(page * 25, total)}`}{" "}
        of {total} records
      </span>
      <div className="actions">
        {page > 1 && (
          <Link
            className="button"
            href={link(section, params, { page: String(page - 1) })}
          >
            Previous
          </Link>
        )}
        <span>Page {page}</span>
        {page * 25 < total && (
          <Link
            className="button"
            href={link(section, params, { page: String(page + 1) })}
          >
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
