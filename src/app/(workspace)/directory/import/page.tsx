import { PageHeader } from "@/components/ui";
import { authorized } from "@/lib/directory";
import { ImportWizard } from "@/components/imports/wizard";
export default async function Import() {
  return (
    <>
      <PageHeader
        eyebrow="Accounts & Contacts"
        title="Import your directory"
        description="Read a CSV or Excel file, check every row, then import safely."
      />
      <ImportWizard enabled={!!(await authorized("directory.write"))} />
    </>
  );
}
