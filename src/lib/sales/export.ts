export class SalesExportError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
type ExportRecord = { id: string; [key: string]: unknown };
export async function collectSalesExport(
  fetchPage: (
    offset: number,
    end: number,
  ) => Promise<{ records: ExportRecord[]; count: number }>,
  max = 5000,
) {
  const rows: ExportRecord[] = [];
  const ids = new Set<string>();
  let expected: number | undefined;
  do {
    const result = await fetchPage(rows.length, rows.length + 999);
    if (expected === undefined) expected = result.count;
    if (expected > max)
      throw new SalesExportError(
        `This export exceeds ${max.toLocaleString("en-GB")} records. Narrow your search or filters; no partial file was downloaded.`,
        422,
      );
    if (
      result.count !== expected ||
      (result.records.length === 0 && rows.length < expected)
    )
      throw new SalesExportError(
        "Sales data changed while preparing the export. Please try again; no partial file was downloaded.",
        409,
      );
    for (const row of result.records) {
      if (!row.id || ids.has(row.id))
        throw new SalesExportError(
          "Sales data changed while preparing the export. Please try again.",
          409,
        );
      ids.add(row.id);
      rows.push(row);
    }
    if (rows.length > expected)
      throw new SalesExportError(
        "Sales data changed while preparing the export. Please try again.",
        409,
      );
  } while (rows.length < (expected ?? 0));
  return rows;
}
