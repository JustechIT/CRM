export function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
export function addDays(day: string, days: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return utcDay(d);
}
export function isOpenOpportunity(stage: string) {
  return !["won", "lost", "closed"].includes(stage.trim().toLowerCase());
}
export function isOpenRenewal(stage: string) {
  return !["renewed", "not renewing", "cancelled", "closed"].includes(
    stage.trim().toLowerCase(),
  );
}
export function isActiveSubscription(
  status: string,
  start: string,
  end: string,
  today = utcDay(),
) {
  return (
    status.trim().toLowerCase() === "active" && start <= today && end >= today
  );
}
export function formatAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const raw = String(value);
  if (!/^\d+(\.\d+)?$/.test(raw)) return raw;
  const [integer, fraction] = raw.split(".");
  return (
    integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
    (fraction ? "." + fraction : "")
  );
}
