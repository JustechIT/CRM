import { parse } from "csv-parse/sync";
import readXlsxFile from "read-excel-file/node";
export const maxRows = 500,
  maxBytes = 5 * 1024 * 1024;
export function checkWorkbookZip(buffer: Buffer) {
  // Check advertised expanded sizes before the workbook parser allocates ZIP entries.
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--)
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw Error("This is not a readable XLSX workbook.");
  const entries = buffer.readUInt16LE(end + 10),
    offset = buffer.readUInt32LE(end + 16);
  if (entries > 200 || offset >= buffer.length)
    throw Error("Workbook is too complex. Export the sheet as CSV.");
  let p = offset,
    total = 0;
  for (let i = 0; i < entries; i++) {
    if (p + 46 > buffer.length || buffer.readUInt32LE(p) !== 0x02014b50)
      throw Error("Invalid workbook archive.");
    const flags = buffer.readUInt16LE(p + 8),
      expanded = buffer.readUInt32LE(p + 24);
    total += expanded;
    if (flags & 1 || total > 20 * 1024 * 1024)
      throw Error(
        "Workbook is encrypted or too large when expanded. Export a smaller CSV.",
      );
    p +=
      46 +
      buffer.readUInt16LE(p + 28) +
      buffer.readUInt16LE(p + 30) +
      buffer.readUInt16LE(p + 32);
  }
}
function delimiter(text: string) {
  const line = text.split(/\r?\n/)[0] ?? "";
  let quoted = false;
  const counts = new Map([
    [",", 0],
    [";", 0],
    ["\t", 0],
  ]);
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (quoted && line[i + 1] === '"') {
        i++;
        continue;
      }
      quoted = !quoted;
    } else if (!quoted && counts.has(line[i]))
      counts.set(line[i], counts.get(line[i])! + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
}
export async function parseDirectoryFile(
  buffer: Buffer,
  name: string,
  sheet?: string,
) {
  if (buffer.length === 0 || buffer.length > maxBytes)
    throw Error("Choose a non-empty CSV or XLSX file up to 5 MB.");
  let rows: unknown[][] = [],
    sheets: string[] = [];
  if (/\.csv$/i.test(name)) {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      throw Error(
        "Save this CSV as CSV UTF-8, or use XLSX, to preserve accented names.",
      );
    }
    rows = parse(text, {
      bom: true,
      skip_empty_lines: true,
      delimiter: delimiter(text),
      max_record_size: 100000,
    }) as unknown[][];
  } else if (/\.xlsx$/i.test(name)) {
    checkWorkbookZip(buffer);
    const workbook = await readXlsxFile(buffer);
    sheets = workbook.map((s) => s.sheet);
    if (!sheets.length) throw Error("No worksheets found.");
    if (sheet && !sheets.includes(sheet))
      throw Error("Choose an existing worksheet.");
    rows = workbook.find((s) => s.sheet === (sheet ?? sheets[0]))!.data;
  } else throw Error("Choose a .csv or .xlsx file.");
  rows = rows.filter((r) =>
    r.some((c) => c !== null && String(c).trim() !== ""),
  );
  if (rows.length < 2)
    throw Error("The file needs a header row and at least one data row.");
  if (rows.length > maxRows + 1)
    throw Error(
      "Import up to 500 rows at a time. Split this file into smaller files.",
    );
  if (rows[0].length > 40) throw Error("Use up to 40 columns.");
  const headers = rows[0].map(
    (v, i) =>
      String(v ?? "")
        .trim()
        .slice(0, 200) || `Column ${i + 1}`,
  );
  return {
    headers,
    rows: rows
      .slice(1)
      .map((r) =>
        headers.map((_, i) =>
          r[i] instanceof Date
            ? (r[i] as Date).toISOString().slice(0, 10)
            : String(r[i] ?? "").trim(),
        ),
      ),
    sheets,
    sheet: sheet ?? sheets[0] ?? "",
  };
}
