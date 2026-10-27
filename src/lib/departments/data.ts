import "server-only";
import { authorized } from "@/lib/directory";
import { param } from "./config";
import type { Department, Section, Params, RecordRow } from "./types";
import { normalizedDate } from "@/lib/sales/validation";
import { id } from "./validation";
import { utcDay, addDays } from "@/lib/sales/metrics";
export type Access = NonNullable<Awaited<ReturnType<typeof authorized>>>;
export function filters(section: Section, params: Params) {
  const status = param(params, "status");
  const options =
    section.fields.find((f) => f.key === section.statusKey)?.options ?? [];
  const sort = param(params, "sort");
  return {
    q: param(params, "q").trim().slice(0, 100),
    status: options.includes(status) ? status : "",
    sort: section.fields.some((f) => f.key === sort)
      ? sort
      : section.defaultSort,
    direction: param(params, "direction") === "desc" ? "desc" : "asc",
    page: Math.min(
      10000,
      Math.max(1, parseInt(param(params, "page"), 10) || 1),
    ),
    from: normalizedDate(param(params, "from")),
    to: normalizedDate(param(params, "to")),
    metric: param(params, "metric"),
    project: id.safeParse(param(params, "project")).success
      ? param(params, "project")
      : "",
    session: id.safeParse(param(params, "session")).success
      ? param(params, "session")
      : "",
  };
}
export async function list(access: Access, section: Section, params: Params) {
  const f = filters(section, params);
  const field = section.fields.find((c) => c.key === f.sort)!;
  const sort = ["reference", "project", "party"].includes(field.type)
    ? field.key + "_label"
    : field.key;
  let q = access.db.from(section.view).select("*", { count: "exact" });
  if (f.q) q = q.ilike("search_text", `%${f.q.replace(/[\\%_]/g, "\\$&")}%`);
  if (f.status) q = q.eq(section.statusKey, f.status);
  const dateField = section.fields.find((c) => c.type === "date")?.key;
  const dateKey = section.slug === "follow-ups" ? "follow_up_date" : dateField;
  if (dateKey && f.from)
    q = q.gte(dateKey, dateKey === "due_at" ? f.from + "T00:00:00Z" : f.from);
  if (dateKey && f.to)
    q =
      dateKey === "due_at"
        ? q.lt(dateKey, addDays(f.to, 1) + "T00:00:00Z")
        : q.lte(dateKey, f.to);
  if (f.project && ["tasks", "quality-control"].includes(section.slug))
    q = q.eq("project_id", f.project);
  if (f.session && ["registrations", "training-history"].includes(section.slug))
    q = q.eq("session_id", f.session);
  const today = utcDay();
  if (section.slug === "campaigns" && f.metric === "active")
    q = q
      .eq("status", "Active")
      .lte("start_date", today)
      .gte("end_date", today);
  if (section.slug === "campaigns" && f.metric === "upcoming")
    q = q
      .not("status", "in", "(Completed,Cancelled)")
      .gt("start_date", today)
      .lte("start_date", addDays(today, 30));
  if (section.slug === "content-calendar" && f.metric === "overdue")
    q = q
      .not("status", "in", "(Published,Cancelled)")
      .lt("publish_date", today);
  if (section.slug === "tasks" && f.metric === "open")
    q = q.not("status", "in", "(Completed,Cancelled)");
  if (section.slug === "quality-control" && f.metric === "pending")
    q = q.not("status", "in", "(Completed,Cancelled)");
  if (
    section.slug === "follow-ups" &&
    ["upcoming", "overdue"].includes(f.metric)
  ) {
    q = q.not("status", "in", "(Completed,Cancelled)");
    q =
      f.metric === "overdue"
        ? q.lt("follow_up_date", today)
        : q
            .gte("follow_up_date", today)
            .lte("follow_up_date", addDays(today, 30));
  }
  if (section.slug === "training-sessions" && f.metric === "upcoming")
    q = q.eq("status", "Scheduled").gte("date", today);
  const r = await q
    .order(sort, { ascending: f.direction === "asc", nullsFirst: false })
    .order("id")
    .range((f.page - 1) * 25, f.page * 25 - 1);
  if (r.error) throw new Error("Module records unavailable");
  return {
    rows: (r.data ?? []) as RecordRow[],
    total: r.count ?? 0,
    filters: f,
  };
}
export async function record(
  access: Access,
  section: Section,
  recordId: string,
) {
  const r = await access.db
    .from(section.view)
    .select("*")
    .eq("id", recordId)
    .maybeSingle();
  if (r.error) throw new Error("Record unavailable");
  return r.data as RecordRow | null;
}
export async function overview(access: Access, department: Department) {
  const r = await access.db.rpc("department_overview", {
    module: department,
    as_of: utcDay(),
  });
  if (r.error || !r.data || typeof r.data !== "object")
    throw new Error("Indicators unavailable");
  return r.data as Record<string, number>;
}
