import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { Plus, ArrowLeft, ArrowUpRight } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui";
import { isConfigured } from "@/lib/supabase";
import { authorized } from "@/lib/directory";
import {
  salesDefinitions,
  isSalesSection,
  salesPath,
  salesBase,
  type SalesSection,
  type SubscriptionKind,
} from "@/lib/sales/config";
import {
  parameter,
  subscriptionKind,
  salesFilters,
  loadSalesList,
  loadSalesRecord,
  type SalesParams,
} from "@/lib/sales/data";
import { idSchema } from "@/lib/sales/validation";
import { SalesForm, SalesExport } from "./forms";
import {
  link,
  sectionTitle,
  SalesAccessNotice,
  SubscriptionTabs,
  SalesFailure,
} from "./shared";
import { ProductCatalog } from "./catalog";
import { SalesOverviewPage, RenewalSuggestions } from "./overview";
import { SalesDetail } from "./detail";
import { SalesFilters, SalesTable, SalesPagination } from "./table";

async function SalesContents({
  slug,
  params,
}: {
  slug: string[];
  params: SalesParams;
}) {
  if (slug.length !== 1 || (slug[0] !== "overview" && !isSalesSection(slug[0])))
    notFound();
  const section = slug[0] as SalesSection | "overview";
  const configured = isConfigured();
  const access = configured ? await authorized("sales.read") : null;
  const canWrite = !!access && !!(await authorized("sales.write"));
  const canDelete = !!access && !!(await authorized("sales.delete"));
  if (configured && !access)
    return (
      <>
        <PageHeader
          eyebrow="Justech Sales"
          title="Sales access required"
          description="Your shared workspace remains protected."
        />
        <SalesAccessNotice configured />
      </>
    );
  const notice = !configured ? <SalesAccessNotice configured={false} /> : null;
  if (section === "overview")
    return (
      <>
        {notice}
        {await SalesOverviewPage({ access, params })}
      </>
    );
  const kind: SubscriptionKind | undefined =
    section === "subscriptions" ? subscriptionKind(params) : undefined;
  if (section === "subscriptions" && parameter(params, "catalog") === "1")
    return (
      <>
        {notice}
        {await ProductCatalog({ access, params, canWrite })}
      </>
    );
  if (parameter(params, "record")) {
    if (!access)
      return (
        <>
          {notice}
          <EmptyState
            title="Employee access required"
            description="Connect Supabase and sign in to open Sales records."
          />
        </>
      );
    return await SalesDetail({
      section,
      kind,
      params,
      access,
      canWrite,
      canDelete,
    });
  }
  if (parameter(params, "new") === "1") {
    let prefill: Record<string, unknown> | undefined;
    if (section === "renewals" && parameter(params, "subscription") && access) {
      const id = parameter(params, "subscription");
      if (!idSchema.safeParse(id).success) notFound();
      const subscription = await loadSalesRecord(access, "subscriptions", id);
      if (!subscription) notFound();
      prefill = {
        account_id: subscription.account_id,
        account_name: subscription.account_name,
        product_id: subscription.product_id,
        product_name: subscription.product_name,
        expiry_date: subscription.end_date,
      };
    }
    return (
      <>
        {notice}
        <PageHeader
          eyebrow={`Justech Sales · ${sectionTitle(section, kind)}`}
          title={`New ${salesDefinitions[section].singular}`}
          description={
            prefill
              ? "Review this subscription's details before creating the renewal."
              : "The right details, in the right place."
          }
        >
          <Link className="button" href={salesPath(section, kind)}>
            <ArrowLeft size={15} />
            Back to list
          </Link>
        </PageHeader>
        <section className="panel">
          <SalesForm
            section={section}
            kind={kind}
            prefill={prefill}
            canWrite={canWrite}
          />
        </section>
      </>
    );
  }
  const filters = salesFilters(section, params);
  const result = access
    ? await loadSalesList(access, section, filters, kind)
    : { records: [], count: 0 };
  const exportParams = new URLSearchParams({ section });
  for (const [key, v] of Object.entries(params))
    if (typeof v === "string") exportParams.set(key, v);
  if (kind) exportParams.set("kind", kind);
  return (
    <>
      {notice}
      <PageHeader
        eyebrow="Justech Sales"
        title={sectionTitle(section, kind)}
        description={
          section === "opportunities"
            ? "Keep every sales conversation moving forward."
            : section === "quotations"
              ? "Clear quotation details, from reference to decision."
              : section === "subscriptions"
                ? "Your institutions, products and contract periods, kept together."
                : "Give every expiring relationship a clear next step."
        }
      >
        <SalesExport
          url={`/api/sales/export?${exportParams}`}
          disabled={!access}
        />
        <Link
          className="button primary"
          href={link(section, kind ? { kind } : {}, { new: "1" })}
        >
          <Plus size={15} />
          New {salesDefinitions[section].singular}
        </Link>
      </PageHeader>
      {section === "subscriptions" && kind && <SubscriptionTabs kind={kind} />}
      <div className="sales-list-context">
        <span>
          {access
            ? `${result.count} ${salesDefinitions[section].title.toLowerCase()}`
            : "Data not connected"}
        </span>
        <Link
          href={`${salesBase}/subscriptions?catalog=1`}
          className="text-link"
        >
          Manage products <ArrowUpRight size={13} />
        </Link>
      </div>
      <section className="panel">
        <SalesFilters section={section} kind={kind} filters={filters} />
        <SalesTable
          section={section}
          kind={kind}
          records={result.records}
          params={kind ? { ...params, kind } : params}
        />
        {!result.records.length && (
          <EmptyState
            title={
              filters.q ||
              filters.status ||
              filters.from ||
              filters.to ||
              filters.window ||
              filters.followup
                ? "No records match these filters"
                : `No ${salesDefinitions[section].title.toLowerCase()} yet`
            }
            description={
              !access
                ? "The table follows your workbook. Connect Supabase and sign in with Sales access to save and view records."
                : "Create a record to get started, or adjust your filters to find what you need."
            }
            action={
              <Link
                className="button"
                href={link(section, kind ? { kind } : {}, { new: "1" })}
              >
                Create {salesDefinitions[section].singular}
              </Link>
            }
          />
        )}{" "}
        {access && (
          <SalesPagination
            section={section}
            params={params}
            page={filters.page}
            total={result.count}
          />
        )}
      </section>
      {section === "renewals" &&
        access &&
        (await RenewalSuggestions({ access }))}
    </>
  );
}

export async function SalesPage(args: { slug: string[]; params: SalesParams }) {
  let content: React.ReactNode;
  try {
    content = await SalesContents(args);
  } catch (error) {
    unstable_rethrow(error);
    content = null;
  }
  if (content === null)
    return (
      <>
        <PageHeader
          eyebrow="Justech Sales"
          title="Sales needs attention"
          description="Your existing data has not been changed."
        />
        <SalesFailure />
      </>
    );
  return content;
}
