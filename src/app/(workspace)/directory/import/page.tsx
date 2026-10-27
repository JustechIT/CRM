import { PageHeader, EmptyState, Badge } from "@/components/ui";
export default function Import() {
  return (
    <>
      <PageHeader
        eyebrow="Accounts & Contacts"
        title="Import your directory"
        description="Bring your relationships together, carefully."
      >
        <Badge>Planned workflow</Badge>
      </PageHeader>
      <section className="panel prose">
        <h2>A safe move from spreadsheets</h2>
        <p>
          Import is not operational in this increment. No files are uploaded and
          no records are written.
        </p>
        <ol>
          <li>Choose a CSV or XLSX file.</li>
          <li>Map institution and contact columns.</li>
          <li>Validate required fields and identify duplicates.</li>
          <li>Preview valid rows and download a clear error report.</li>
          <li>
            Confirm a server-validated import without silently overwriting
            existing records.
          </li>
        </ol>
        <EmptyState
          title="Your data deserves a careful welcome"
          description="The next import increment will add tested parsing, mapping, duplicate detection, and transactional writes. Keep real customer files outside this preview."
        />
      </section>
    </>
  );
}
