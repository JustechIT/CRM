import { NextRequest, NextResponse } from "next/server";
import { authorized } from "@/lib/directory";
import { isSalesSection } from "@/lib/sales/config";
import { salesFilters, listQuery, subscriptionKind } from "@/lib/sales/data";
import { collectSalesExport, SalesExportError } from "@/lib/sales/export";
import { salesCsv } from "@/lib/sales/csv";
export async function GET(request: NextRequest) {
  const access = await authorized("sales.read");
  if (!access)
    return NextResponse.json(
      { error: "Sales access required." },
      { status: 401 },
    );
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const section = params.section;
  if (!isSalesSection(section) || section === "quotations")
    return NextResponse.json(
      { error: "Invalid Sales section." },
      { status: 400 },
    );
  let records: Awaited<ReturnType<typeof collectSalesExport>>;
  try {
    records = await collectSalesExport(async (offset, end) => {
      const { data, error, count } = await listQuery(
        access,
        section,
        salesFilters(section, params),
        section === "subscriptions" ? subscriptionKind(params) : undefined,
      ).range(offset, end);
      if (error || count === null)
        throw new SalesExportError(
          "Export failed. Check your connection and Sales permissions.",
          503,
        );
      return {
        records: (data ?? []) as { id: string; [key: string]: unknown }[],
        count,
      };
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof SalesExportError
            ? error.message
            : "Export failed. Please try again.",
      },
      { status: error instanceof SalesExportError ? error.status : 503 },
    );
  }
  return new NextResponse(salesCsv(section, records), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="justech-${section}${section === "subscriptions" ? "-" + subscriptionKind(params).toLowerCase() : ""}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
