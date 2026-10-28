import Link from "next/link";
import {
  Plus,
  ArrowUpRight,
  CalendarClock,
  BriefcaseBusiness,
  RefreshCw,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import {
  salesDefinitions,
  salesPath,
  overviewIndicators,
  type SalesSection,
} from "@/lib/sales/config";
import {
  parameter,
  loadOverview,
  expiringSubscriptions,
  textValue,
  type SalesParams,
  type SalesAccess,
} from "@/lib/sales/data";
import { formatAmount } from "@/lib/sales/metrics";

export async function SalesOverviewPage({
  access,
  params,
}: {
  access: SalesAccess | null;
  params: SalesParams;
}) {
  const rawYear = parameter(params, "year");
  const year =
    /^\d{4}$/.test(rawYear) &&
    Number(rawYear) >= 1900 &&
    Number(rawYear) <= 2200
      ? Number(rawYear)
      : new Date().getUTCFullYear();
  const metrics = access ? await loadOverview(access, year) : null;
  const subscriptions = access ? await expiringSubscriptions(access) : [];
  const cards = [
    {
      label: overviewIndicators[0],
      value: metrics?.active_opportunities,
      icon: BriefcaseBusiness,
      href: salesPath("opportunities"),
      note: "Open opportunities, excluding Won, Lost and Closed.",
    },
    {
      label: overviewIndicators[2],
      value: metrics?.active_subscriptions,
      icon: BookOpen,
      href: salesPath("subscriptions"),
      note: "Active contracts whose dates include today.",
    },
    {
      label: overviewIndicators[3],
      value: metrics?.upcoming_renewals,
      icon: RefreshCw,
      href: salesPath("renewals") + "&window=90",
      note: "Active subscriptions expiring within 90 days.",
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="Justech Sales"
        title="Sales Overview"
        description="Your pipeline, subscriptions and next conversations. One clear view."
      >
        <Link
          className="button primary"
          href={`${salesPath("opportunities")}?new=1`}
        >
          <Plus size={16} />
          New opportunity
        </Link>
      </PageHeader>
      <div className="sales-overview-grid">
        {cards.map((c) => (
          <Link href={c.href} className="metric sales-metric" key={c.label}>
            <div>
              <span>{c.label}</span>
              <c.icon size={18} />
            </div>
            <strong>{c.value ?? "—"}</strong>
            <small>{c.note}</small>
          </Link>
        ))}
        <section className="metric sales-revenue">
          <div>
            <span>{overviewIndicators[4]}</span>
            <span className="badge">{year}</span>
          </div>
          <div className="sales-currency-values">
            {[
              "TND",
              "EUR",
              "USD",
              ...Object.keys(metrics?.annual_sales_revenue ?? {})
                .filter((c) => !["TND", "EUR", "USD"].includes(c))
                .sort(),
            ].map((currency) => (
              <div key={currency}>
                <span>{currency}</span>
                <strong>
                  {formatAmount(metrics?.annual_sales_revenue[currency] ?? "0")}
                </strong>
              </div>
            ))}
          </div>
          <form method="get" className="sales-year-filter">
            <label>
              Revenue year
              <input
                name="year"
                type="number"
                min="1900"
                max="2200"
                required
                defaultValue={year}
              />
            </label>
            <button className="button">Update</button>
          </form>
          <details>
            <summary>How revenue is counted</summary>
            <p>
              Latest confirmed contract per customer/product covering {year}.
              Active, Confirmed and Expired terms are included. Cancelled terms
              and renewal follow-ups are excluded. Annual values are not
              prorated; currencies are never combined.
            </p>
            {!access && (
              <p>
                No subscription data is connected. The displayed zero values are
                an empty preview.
              </p>
            )}
          </details>
        </section>
        <section className="metric sales-overdue">
          <div>
            <span>{overviewIndicators[5]}</span>
            <AlertCircle size={18} />
          </div>
          <strong>{metrics?.overdue_follow_ups ?? "—"}</strong>
          <p className="muted">
            Past-due opportunity actions and open renewal follow-ups.
          </p>
          <div className="sales-inline-actions">
            <Link
              className="text-link"
              href={`${salesPath("opportunities")}?followup=overdue`}
            >
              Opportunities <ArrowUpRight size={13} />
            </Link>
            <Link
              className="text-link"
              href={`${salesPath("renewals")}&followup=overdue`}
            >
              Renewal tracking <ArrowUpRight size={13} />
            </Link>
          </div>
        </section>
      </div>
      <div className="sales-section-links">
        {(["opportunities", "subscriptions", "payments"] as SalesSection[]).map(
          (section) => (
            <Link className="button" href={salesPath(section)} key={section}>
              {salesDefinitions[section].title}
              <ArrowUpRight size={14} />
            </Link>
          ),
        )}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>Subscriptions to review</h2>
          <Badge>Next 90 days</Badge>
        </div>
        <p className="sales-panel-description">
          Prepare a renewal from an expiring subscription. Nothing is created
          until you review and save.
        </p>
        {subscriptions.length ? (
          <div className="sales-renewal-worklist">
            {subscriptions.map((s) => (
              <div key={s.id}>
                <CalendarClock size={18} />
                <span>
                  <strong>{s.account_name}</strong>
                  <small>
                    {s.product_name} · Ends {textValue(s, "end_date")}
                  </small>
                </span>
                <Link
                  className="button"
                  href={`${salesPath("renewals")}&new=1&subscription=${s.id}`}
                >
                  Prepare renewal
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No upcoming renewals to review"
            description={
              access
                ? "Active subscriptions expiring in the next 90 days will appear here."
                : "Connect your employee workspace to see authorized subscription dates."
            }
          />
        )}
      </section>
    </>
  );
}

export async function RenewalSuggestions({ access }: { access: SalesAccess }) {
  const subscriptions = await expiringSubscriptions(access);
  if (!subscriptions.length) return null;
  return (
    <section className="panel sales-renewal-suggestions">
      <div className="panel-heading">
        <h2>Subscriptions expiring in 90 days</h2>
        <Badge>
          {subscriptions.length === 25 ? "First 25" : subscriptions.length}
        </Badge>
      </div>
      <div className="sales-renewal-worklist">
        {subscriptions.map((s) => (
          <div key={s.id}>
            <span>
              <strong>{s.account_name}</strong>
              <small>
                {s.product_name} · {textValue(s, "end_date")}
              </small>
            </span>
            <Link
              className="button"
              href={`${salesPath("renewals")}&new=1&subscription=${s.id}`}
            >
              Prepare renewal
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
