import { salesDefinitions, type SalesSection } from "./config";
// Excel can execute values beginning with formula prefixes, including after whitespace.
export function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = /^[\s\uFEFF]*[=+@-]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function salesCsv(
  section: SalesSection,
  records: Record<string, unknown>[],
) {
  const fields = salesDefinitions[section].fields;
  return (
    "\uFEFF" +
    [
      fields.map((f) => csvCell(f.label)).join(","),
      ...records.map((record) =>
        fields
          .map((f) =>
            csvCell(
              record[
                f.key === "account_id"
                  ? "account_name"
                  : f.key === "product_id"
                    ? "product_name"
                    : f.key
              ],
            ),
          )
          .join(","),
      ),
    ].join("\r\n") +
    "\r\n"
  );
}
