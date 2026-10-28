import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { invoiceAccess } from "@/lib/finance/access";
import { invoiceFields, invoiceBase, type Invoice } from "@/lib/finance/config";
import { paymentStatuses } from "@/lib/sales/config";
import { idSchema, normalizedDate } from "@/lib/sales/validation";
import {
  InvoiceForm,
  InvoiceFiles,
  InvoiceDelete,
} from "@/components/finance/form";
export default async function Invoices({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await invoiceAccess();
  if (!access) notFound();
  const p = await searchParams;
  const param = (k: string) =>
    typeof p[k] === "string" ? (p[k] as string) : "";
  const id = param("record");
  let record: Invoice | undefined;
  if (id) {
    if (!idSchema.safeParse(id).success) notFound();
    const r = await access.db
      .from("supplier_invoices")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (r.error)
      return (
        <EmptyState
          title="Invoices unavailable"
          description="Check your connection and database setup."
        />
      );
    if (!r.data) notFound();
    record = r.data as Invoice;
  }
  if (param("new") === "1" || (record && param("edit") === "1"))
    return (
      <>
        <PageHeader
          eyebrow="Finance"
          description="Private supplier invoice details."
          title={record ? "Edit supplier invoice" : "New supplier invoice"}
        />
        <section className="panel">
          <InvoiceForm record={record} />
        </section>
      </>
    );
  if (record)
    return (
      <>
        <PageHeader
          eyebrow="Finance · Supplier Invoices"
          title={record.invoice_number}
          description={record.supplier}
        >
          <Link className="button" href={invoiceBase}>
            Back to list
          </Link>
          <Link
            className="button primary"
            href={`${invoiceBase}?record=${record.id}&edit=1`}
          >
            Edit invoice
          </Link>
        </PageHeader>
        <section className="panel sales-record-detail">
          <dl>
            {invoiceFields
              .filter((f) => f[2] !== "file")
              .map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {key === "payment_status" ? (
                      <Badge>{record[key]}</Badge>
                    ) : (
                      String(record[key] ?? "—")
                    )}
                  </dd>
                </div>
              ))}
          </dl>
        </section>
        <InvoiceFiles record={record} />
        <InvoiceDelete record={record} />
      </>
    );
  const q = param("q").trim().slice(0, 100),
    status = paymentStatuses.includes(
      param("status") as (typeof paymentStatuses)[number],
    )
      ? param("status")
      : "";
  const sort = invoiceFields.some((f) => f[0] === param("sort"))
      ? param("sort")
      : "invoice_date",
    direction = param("direction") === "asc" ? "asc" : "desc";
  const page = Math.min(10000, Math.max(1, parseInt(param("page")) || 1));
  let query = access.db
    .from("supplier_invoices")
    .select("*", { count: "exact" });
  if (q) {
    const safe = q.replace(/[\\%_,()."']/g, "");
    query = query.or(
      ["invoice_number", "supplier", "product_service", "notes"]
        .map((k) => `${k}.ilike.%${safe}%`)
        .join(","),
    );
  }
  if (status) query = query.eq("payment_status", status);
  const from = normalizedDate(param("from")),
    to = normalizedDate(param("to"));
  if (from) query = query.gte("invoice_date", from);
  if (to) query = query.lte("invoice_date", to);
  const r = await query
    .order(sort, { ascending: direction === "asc" })
    .order("id")
    .range((page - 1) * 25, page * 25 - 1);
  const pageUrl = (n: number) => {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(p))
      if (typeof v === "string") query.set(k, v);
    query.set("page", String(n));
    return `${invoiceBase}?${query}`;
  };
  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Supplier Invoices"
        description="Private supplier invoices and supporting documents."
      >
        <Link className="button primary" href={`${invoiceBase}?new=1`}>
          New supplier invoice
        </Link>
      </PageHeader>
      <section className="panel">
        <form className="sales-filters" method="get">
          <label>
            Search
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Invoice, supplier, product or notes…"
            />
          </label>
          <label>
            Payment Status
            <select name="status" defaultValue={status}>
              <option value="">All</option>
              {paymentStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Sort by
            <select name="sort" defaultValue={sort}>
              {invoiceFields.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Order
            <select name="direction" defaultValue={direction}>
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
          <label>
            Invoice Date from
            <input name="from" type="date" defaultValue={from} />
          </label>
          <label>
            To
            <input name="to" type="date" defaultValue={to} />
          </label>
          <button className="button">Apply filters</button>
          <Link className="text-link" href={invoiceBase}>
            Reset
          </Link>
        </form>
        {r.error ? (
          <EmptyState
            title="Invoices unavailable"
            description="Your data has not been replaced. Check your connection and database setup."
          />
        ) : (
          <>
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    {invoiceFields.map(([k, l]) => (
                      <th key={k}>{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(r.data ?? []).map((row: Invoice) => (
                    <tr key={row.id}>
                      {invoiceFields.map(([key], i) => (
                        <td key={key}>
                          {i === 0 ? (
                            <Link
                              className="text-link"
                              href={`${invoiceBase}?record=${row.id}`}
                            >
                              {row.invoice_number}
                            </Link>
                          ) : key === "file_name" ? (
                            row.file_name ? (
                              <a
                                href={`/api/finance/supplier-invoices/${row.id}/file`}
                              >
                                {row.file_name}
                              </a>
                            ) : (
                              "—"
                            )
                          ) : key === "payment_status" ? (
                            <Badge>{row[key]}</Badge>
                          ) : (
                            String(row[key] ?? "—")
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!r.data?.length && (
              <EmptyState
                title="No supplier invoices to show"
                description="Create an invoice or adjust your filters."
              />
            )}
            <div className="pagination">
              <span>
                {r.count ?? 0} invoices · Page {page}
              </span>
              <div className="actions">
                {page > 1 && (
                  <Link className="button" href={pageUrl(page - 1)}>
                    Previous
                  </Link>
                )}
                {page * 25 < (r.count ?? 0) && (
                  <Link className="button" href={pageUrl(page + 1)}>
                    Next
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
