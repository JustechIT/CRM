import "server-only";
import { authorized } from "@/lib/directory";
import { mappedRows, type Batch } from "./validation";
export type CheckedImportRow = {
  row: number;
  data: Record<string, unknown> | null;
  error: string;
  duplicate: boolean;
};
export async function validateImport(
  access: NonNullable<Awaited<ReturnType<typeof authorized>>>,
  batch: Batch,
) {
  const r = await access.db.rpc("preview_directory_matches", {
    entity_value: batch.entity,
    row_values: mappedRows(batch),
  });
  if (r.error)
    throw Error(
      "Existing records and institutions could not be checked. No records were saved.",
    );
  return r.data as CheckedImportRow[];
}
