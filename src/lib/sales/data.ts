import "server-only";
import { z } from "zod";
import { authorized } from "@/lib/directory";
import {
  salesDefinitions,
  type SalesSection,
  type SubscriptionKind,
} from "./config";
import { addDays, utcDay } from "./metrics";
import { normalizedDate } from "./validation";
export type SalesAccess = NonNullable<Awaited<ReturnType<typeof authorized>>>;
export type SalesParams = Record<string, string | string[] | undefined>;
export function parameter(params: SalesParams, name: string) {
  return typeof params[name] === "string" ? params[name] : "";
}
export function subscriptionKind(params: SalesParams): SubscriptionKind {
  return parameter(params, "kind") === "Other" ? "Other" : "Turnitin";
}
export type SalesRecord = {
  id: string;
  revision: number;
  created_at: string;
  updated_at: string;
  account_name: string | null;
  product_name: string | null;
  [key: string]: unknown;
};
export function textValue(record: Record<string, unknown>, key: string) {
  const v = record[key];
  return typeof v === "string" || typeof v === "number" ? String(v) : "";
}
export type SalesFilters = {
  q: string;
  status: string;
  sort: string;
  direction: "asc" | "desc";
  page: number;
  from: string;
  to: string;
  window: string;
  followup: string;
  subscription: string;
};
export function salesFilters(
  section: SalesSection,
  params: SalesParams,
): SalesFilters {
  const definition = salesDefinitions[section];
  const sort = parameter(params, "sort");
  return {
    subscription: z.uuid().safeParse(parameter(params, "subscription")).success
      ? parameter(params, "subscription")
      : "",
    q: parameter(params, "q").trim().slice(0, 100),
    status: parameter(params, "status").trim().slice(0, 100),
    sort: definition.fields.some((f) => f.key === sort)
      ? sort
      : definition.defaultSort,
    direction: parameter(params, "direction") === "desc" ? "desc" : "asc",
    page: Math.min(
      10000,
      Math.max(1, Number.parseInt(parameter(params, "page"), 10) || 1),
    ),
    from: normalizedDate(parameter(params, "from")),
    to: normalizedDate(parameter(params, "to")),
    window: parameter(params, "window") === "90" ? "90" : "",
    followup: parameter(params, "followup") === "overdue" ? "overdue" : "",
  };
}
export function listQuery(
  access: SalesAccess,
  section: SalesSection,
  filters: SalesFilters,
  kind?: SubscriptionKind,
) {
  const def = salesDefinitions[section];
  const sort =
    filters.sort === "subscription_id"
      ? "subscription_label"
      : filters.sort === "account_id"
        ? "account_name"
        : filters.sort === "product_id"
          ? "product_name"
          : filters.sort;
  let query = access.db
    .from(`${def.table}_list`)
    .select("*", { count: "exact" });
  if (section === "payments" && filters.subscription)
    query = query.eq("subscription_id", filters.subscription);
  if (section === "subscriptions" && kind) query = query.eq("kind", kind);
  if (filters.q)
    query = query.ilike(
      "search_text",
      `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`,
    );
  if (filters.status) {
    const key =
      section === "payments"
        ? "payment_status"
        : section === "opportunities"
          ? "stage"
          : section === "quotations"
            ? "decision_status"
            : section === "subscriptions"
              ? "status"
              : "renewal_stage";
    query = query.ilike(key, filters.status.replace(/[\\%_]/g, "\\$&"));
  }
  const dateKey =
    section === "payments"
      ? "payment_date"
      : section === "opportunities"
        ? "date"
        : section === "subscriptions"
          ? "end_date"
          : section === "renewals"
            ? "expiry_date"
            : null;
  if (dateKey && filters.from) query = query.gte(dateKey, filters.from);
  if (dateKey && filters.to) query = query.lte(dateKey, filters.to);
  if (
    filters.window === "90" &&
    (section === "subscriptions" || section === "renewals")
  )
    query = query
      .gte(section === "subscriptions" ? "end_date" : "expiry_date", utcDay())
      .lte(
        section === "subscriptions" ? "end_date" : "expiry_date",
        addDays(utcDay(), 90),
      );
  if (filters.followup === "overdue" && section === "opportunities")
    query = query.lt("due_date", utcDay()).eq("is_open", true);
  if (filters.followup === "overdue" && section === "renewals")
    query = query.lt("follow_up_date", utcDay()).eq("is_open", true);
  return query
    .order(sort, { ascending: filters.direction === "asc", nullsFirst: false })
    .order("id");
}
export async function loadSalesList(
  access: SalesAccess,
  section: SalesSection,
  filters: SalesFilters,
  kind?: SubscriptionKind,
) {
  const { data, error, count } = await listQuery(
    access,
    section,
    filters,
    kind,
  ).range((filters.page - 1) * 25, filters.page * 25 - 1);
  if (error)
    throw new Error(
      "Sales records could not be loaded. Apply migrations through 0006 and check your Sales permissions.",
    );
  return { records: (data ?? []) as SalesRecord[], count: count ?? 0 };
}
export async function loadSalesRecord(
  access: SalesAccess,
  section: SalesSection,
  id: string,
) {
  const { data, error } = await access.db
    .from(`${salesDefinitions[section].table}_list`)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("This Sales record could not be loaded.");
  return data as SalesRecord | null;
}
export const overviewSchema = z.object({
  active_opportunities: z.number().int().nonnegative(),
  pending_quotations: z.number().int().nonnegative(),
  active_subscriptions: z.number().int().nonnegative(),
  upcoming_renewals: z.number().int().nonnegative(),
  annual_sales_revenue: z.record(
    z.string().regex(/^[A-Z]{3}$/),
    z.string().regex(/^\d+(\.\d+)?$/),
  ),
  overdue_follow_ups: z.number().int().nonnegative(),
});
export type SalesOverview = z.infer<typeof overviewSchema>;
export async function loadOverview(access: SalesAccess, year: number) {
  const { data, error } = await access.db.rpc("sales_overview", {
    as_of: utcDay(),
    revenue_year: year,
  });
  if (error)
    throw new Error(
      "Sales indicators could not be loaded. Apply migration 0002 and check your Sales permissions.",
    );
  return overviewSchema.parse(data);
}
export async function expiringSubscriptions(access: SalesAccess) {
  const { data, error } = await access.db
    .from("sales_subscriptions_list")
    .select("*")
    .ilike("status", "Active")
    .lte("start_date", utcDay())
    .gte("end_date", utcDay())
    .lte("end_date", addDays(utcDay(), 90))
    .order("end_date")
    .limit(25);
  if (error) throw new Error("Expiring subscriptions could not be loaded.");
  return (data ?? []) as SalesRecord[];
}
