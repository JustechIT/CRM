import Link from "next/link";
import { EmptyState, Badge, SetupNotice } from "@/components/ui";
import {
  salesDefinitions,
  salesBase,
  salesPath,
  type SalesSection,
  type SubscriptionKind,
} from "@/lib/sales/config";
import {
  textValue,
  type SalesParams,
  type SalesRecord,
} from "@/lib/sales/data";
import { formatAmount } from "@/lib/sales/metrics";
import { SalesRetry } from "./forms";

export function link(
  section: SalesSection,
  params: SalesParams,
  changes: Record<string, string | null> = {},
) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (typeof value === "string" && value) next.set(key, value);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  if (section === "renewals") {
    next.set("tracking", "1");
    return `${salesBase}/subscriptions?${next}`;
  }
  return `${salesBase}/${section}${next.size ? "?" + next : ""}`;
}

export function SalesAccessNotice({ configured }: { configured: boolean }) {
  return configured ? (
    <div className="notice">
      <p>
        Your employee account does not have Justech Sales read permission. Ask
        your administrator for access.
      </p>
    </div>
  ) : (
    <SetupNotice />
  );
}

export function SalesFailure() {
  return (
    <section className="panel">
      <EmptyState
        title="Sales is temporarily unavailable"
        description="No records have been replaced with empty data. Check your connection, Sales permissions, and that database migrations through 0006 have been applied."
        action={<SalesRetry />}
      />
    </section>
  );
}

export function SubscriptionTabs({ kind }: { kind: SubscriptionKind }) {
  return (
    <nav className="tabs sales-tabs" aria-label="Subscription sections">
      <Link
        href={salesPath("subscriptions", "Turnitin")}
        aria-current={kind === "Turnitin" ? "page" : undefined}
      >
        Turnitin Subscriptions
      </Link>
      <Link
        href={salesPath("subscriptions", "Other")}
        aria-current={kind === "Other" ? "page" : undefined}
      >
        Other Subscriptions
      </Link>
    </nav>
  );
}

export function sectionTitle(section: SalesSection, kind?: SubscriptionKind) {
  return section === "subscriptions"
    ? `${kind} Subscriptions / Renewals`
    : salesDefinitions[section].title;
}

export function RecordValue({
  record,
  field,
}: {
  record: SalesRecord;
  field: { key: string; type: string };
}) {
  if (field.key === "organization_name")
    return (
      <>
        {textValue(record, "organization_name") || record.account_name || "—"}
      </>
    );
  if (field.key === "account_id")
    return <>{record.account_name ?? "Unavailable institution"}</>;
  if (field.key === "product_id")
    return <>{record.product_name ?? "Unavailable product"}</>;
  if (field.type === "subscription")
    return <>{textValue(record, "subscription_label") || "Not linked"}</>;
  const raw = textValue(record, field.key);
  if (!raw) return <>—</>;
  if (field.type === "money")
    return <span className="sales-number">{formatAmount(raw)}</span>;
  if (field.type === "date")
    return (
      <time dateTime={raw}>
        {new Intl.DateTimeFormat("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(raw.slice(0, 10) + "T00:00:00Z"))}
      </time>
    );
  if (
    ["status", "stage", "renewal_stage", "payment_status"].includes(field.key)
  )
    return <Badge>{raw}</Badge>;
  return (
    <span className="sales-cell-text" title={raw}>
      {raw}
    </span>
  );
}
