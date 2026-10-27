import Link from "next/link";
import { Plus, Upload, Search, ArrowUpRight } from "lucide-react";
import { PageHeader, EmptyState, Badge, SetupNotice } from "@/components/ui";
import { database, isConfigured } from "@/lib/supabase";
import { queryTerm } from "@/lib/validation";
import type { RecordData } from "@/lib/directory";
export default async function Directory({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const entity = params.type === "contacts" ? "contacts" : "accounts";
  const q = queryTerm(params.q);
  const page = Math.min(
    10000,
    Math.max(1, Number.parseInt(params.page ?? "1") || 1),
  );
  const status = ["Prospect", "Active", "Inactive"].includes(
    params.status ?? "",
  )
    ? params.status!
    : "";
  const business = ["Justech", "Al-Fikr", "Both"].includes(
    params.business ?? "",
  )
    ? params.business!
    : "";
  const sort = entity === "accounts" ? "name" : "last_name";
  const ascending = params.order !== "desc";
  let rows: RecordData[] = [];
  let total = 0;
  let failed = false;
  const configured = isConfigured();
  if (configured) {
    const db = await database();
    let request = db
      .from(entity)
      .select("*", { count: "exact" })
      .order(sort, { ascending })
      .order("id")
      .range((page - 1) * 20, page * 20 - 1);
    if (q)
      request =
        entity === "accounts"
          ? request.ilike("name", `%${q}%`)
          : request.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
    if (entity === "accounts" && status) request = request.eq("status", status);
    if (entity === "accounts" && business)
      request = request.eq("business", business);
    const result = await request;
    rows = result.data ?? [];
    total = result.count ?? 0;
    failed = !!result.error;
  }
  const href = (n: number) =>
    `/directory?${new URLSearchParams({ type: entity, q, page: String(n), status, business, order: ascending ? "asc" : "desc" })}`;
  return (
    <>
      {!configured && <SetupNotice />}
      <PageHeader
        eyebrow="Shared directory"
        title="Accounts & Contacts"
        description="Good relationships start with knowing your people."
      >
        <Link className="button" href="/directory/import">
          <Upload size={15} />
          Import
        </Link>
        <Link className="button primary" href={`/directory/new?type=${entity}`}>
          <Plus size={16} />
          New {entity === "accounts" ? "account" : "contact"}
        </Link>
      </PageHeader>
      <nav className="tabs" aria-label="Directory type">
        <Link
          href="/directory"
          aria-current={entity === "accounts" ? "page" : undefined}
        >
          Accounts
        </Link>
        <Link
          href="/directory?type=contacts"
          aria-current={entity === "contacts" ? "page" : undefined}
        >
          Contacts
        </Link>
      </nav>
      <section className="panel">
        <form className="table-toolbar" method="get">
          <input type="hidden" name="type" value={entity} />
          <Search size={16} aria-hidden="true" />
          <label className="sr-only" htmlFor="directory-search">
            Search {entity}
          </label>
          <input
            id="directory-search"
            name="q"
            defaultValue={q}
            placeholder={`Search ${entity}…`}
            maxLength={100}
          />
          {entity === "accounts" && (
            <>
              <label className="sr-only" htmlFor="status">
                Account status
              </label>
              <select id="status" name="status" defaultValue={status}>
                <option value="">All statuses</option>
                {["Prospect", "Active", "Inactive"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <label className="sr-only" htmlFor="business">
                Business association
              </label>
              <select id="business" name="business" defaultValue={business}>
                <option value="">All businesses</option>
                {["Justech", "Al-Fikr", "Both"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </>
          )}
          <label className="sr-only" htmlFor="order">
            Sort order
          </label>
          <select
            id="order"
            name="order"
            defaultValue={ascending ? "asc" : "desc"}
          >
            <option value="asc">Name A–Z</option>
            <option value="desc">Name Z–A</option>
          </select>
          <button className="button">Apply</button>
          {(q || status || business) && (
            <Link className="text-link" href={`/directory?type=${entity}`}>
              Clear filters
            </Link>
          )}
        </form>
        {failed ? (
          <EmptyState
            title="The directory could not be loaded"
            description="Check the database migration and your employee permissions. This is not an empty result."
          />
        ) : rows.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{entity === "accounts" ? "Institution" : "Contact"}</th>
                    <th>{entity === "accounts" ? "Location" : "Job title"}</th>
                    <th>Email</th>
                    <th>{entity === "accounts" ? "Business" : "Department"}</th>
                    <th>{entity === "accounts" ? "Status" : "Record"}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/directory/${entity}/${r.id}`}>
                          {r.name ?? `${r.first_name} ${r.last_name}`}
                        </Link>
                        <div className="muted">{r.institution_type}</div>
                      </td>
                      <td>
                        {entity === "accounts"
                          ? [r.city, r.country].filter(Boolean).join(", ") ||
                            "—"
                          : r.job_title || "—"}
                      </td>
                      <td>{r.email || "—"}</td>
                      <td>{r.business ?? r.department ?? "—"}</td>
                      <td>
                        {r.status ? (
                          <Badge>{r.status}</Badge>
                        ) : (
                          <Link
                            className="text-link"
                            href={`/directory/contacts/${r.id}`}
                          >
                            View <ArrowUpRight size={13} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                {total} {entity} · Page {page}
              </span>
              <div className="actions">
                {page > 1 && (
                  <Link className="button" href={href(page - 1)}>
                    Previous
                  </Link>
                )}
                {page * 20 < total && (
                  <Link className="button" href={href(page + 1)}>
                    Next
                  </Link>
                )}
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title={
              !configured
                ? "Your relationships belong here"
                : q || status || business
                  ? "No matches this time"
                  : `No ${entity} yet`
            }
            description={
              !configured
                ? "A shared, organized home for institutions and the people behind them. Connect Supabase to get started."
                : "Try another search or create your first record to start building your directory."
            }
            action={
              configured ? (
                <Link className="button" href={`/directory/new?type=${entity}`}>
                  Create {entity === "accounts" ? "an account" : "a contact"}
                </Link>
              ) : undefined
            }
          />
        )}
      </section>
    </>
  );
}
