import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkspacePage } from "@/components/workspace/page";
import { PageHeader, SetupNotice, EmptyState } from "@/components/ui";
import { isConfigured } from "@/lib/supabase";
import { authorized } from "@/lib/directory";
import { alfikrSections, type AlFikrScope } from "@/lib/alfikr/config";
import { param, modulePath } from "@/lib/departments/config";
import type { Params } from "@/lib/departments/types";
import { ProductCreator } from "./products";
export async function AlFikrPage({
  scope,
  slug,
  params,
}: {
  scope: AlFikrScope;
  slug: string;
  params: Params;
}) {
  const access = isConfigured() ? await authorized(scope + ".read") : null;
  if (isConfigured() && !access) notFound();
  const registry = alfikrSections.filter((s) => s.department === scope);
  if (param(params, "products") === "1" && scope === "alfikr-sales") {
    const products = access
      ? await access.db
          .from("products")
          .select("id,name")
          .in("business", ["Al-Fikr", "Both"])
          .order("name")
          .limit(100)
      : null;
    return (
      <>
        <PageHeader
          eyebrow="Al-Fikr Sales"
          title="Products / Packages"
          description="Use an existing Al-Fikr or shared product, or add a new package."
        />
        <section className="panel">
          <ProductCreator
            enabled={!!access && !!(await authorized(scope + ".write"))}
          />
          {products?.error ? (
            <p>Products could not be loaded.</p>
          ) : (
            <ul>
              {products?.data?.map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
          )}
          <Link className="button" href={modulePath(scope, "subscriptions")}>
            Back to subscriptions
          </Link>
        </section>
      </>
    );
  }
  if (slug !== "overview")
    return (
      <>
        {scope === "alfikr-sales" && (
          <p>
            <Link
              className="text-link"
              href={modulePath(scope, "subscriptions", { products: "1" })}
            >
              Manage products / packages
            </Link>
          </p>
        )}
        <WorkspacePage scope={scope} slug={slug} params={params} />
      </>
    );
  const raw = param(params, "year"),
    year =
      /^\d{4}$/.test(raw) && +raw >= 1900 && +raw <= 2200
        ? +raw
        : new Date().getFullYear();
  const r = access
    ? await access.db.rpc("alfikr_overview", {
        module: scope,
        revenue_year: year,
      })
    : null;
  const labels =
    scope === "alfikr-sales"
      ? [
          "Open Opportunities",
          "Pending Quotations",
          "Active Subscriptions",
          "Upcoming Expirations",
          "Annual Subscription Value",
          "Follow-ups Due",
        ]
      : scope === "alfikr-marketing"
        ? [
            "Active Campaigns",
            "Scheduled Content",
            "Awaiting Approval",
            "Upcoming Campaigns",
            "Published Content",
            "Overdue Content",
          ]
        : [
            "Total Catalog Items",
            "Published Items",
            "In Preparation",
            "Awaiting Review",
            "Items With Issues",
            "Recently Published",
          ];
  return (
    <>
      {!isConfigured() && <SetupNotice />}
      <PageHeader
        eyebrow="Al-Fikr"
        title={`${scope === "alfikr-sales" ? "Sales" : scope === "alfikr-marketing" ? "Marketing" : "Content Management"} Overview`}
        description="Actual records, clear totals and next steps."
      />
      {r?.error ? (
        <EmptyState
          title="Overview unavailable"
          description="Check the Al-Fikr migration and your permissions."
        />
      ) : (
        <div className="department-indicators">
          {labels.map((label) => (
            <section className="metric sales-metric" key={label}>
              <span>{label}</span>
              {label === "Annual Subscription Value" ? (
                <>
                  <form method="get">
                    <label>
                      Year
                      <input
                        name="year"
                        type="number"
                        min={1900}
                        max={2200}
                        defaultValue={year}
                      />
                    </label>
                    <button className="button">Update</button>
                  </form>
                  <div className="sales-currency-values">
                    {[
                      ...new Set([
                        "TND",
                        "EUR",
                        "USD",
                        ...Object.keys(r?.data?.[label] ?? {}),
                      ]),
                    ].map((c) => (
                      <div key={c}>
                        <span>{c}</span>
                        <strong>{r?.data?.[label]?.[c] ?? "0"}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <strong>{r?.data?.[label] ?? "—"}</strong>
              )}
            </section>
          ))}
        </div>
      )}
      <section className="panel">
        <h2>Choose a section</h2>
        <div className="department-section-links">
          {registry.map((s) => (
            <Link
              className="button"
              href={modulePath(scope, s.slug)}
              key={s.slug}
            >
              {s.title}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
