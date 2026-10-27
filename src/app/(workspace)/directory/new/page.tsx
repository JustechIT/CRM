import { PageHeader, EmptyState } from "@/components/ui";
import { authorized } from "@/lib/directory";
import { RecordForm } from "@/components/record-form";
export default async function NewRecord({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const entity = type === "contacts" ? "contacts" : "accounts";
  const access = await authorized("directory.write");
  if (!access)
    return (
      <>
        <PageHeader
          title={`New ${entity === "accounts" ? "account" : "contact"}`}
          description="Add a relationship to your shared directory."
        />
        <section className="panel">
          <EmptyState
            title="Employee access required"
            description="Connect Supabase and sign in as an employee with directory write permission to create records. Nothing has been saved."
          />
        </section>
      </>
    );
  let accounts: { id: string; name: string }[] = [];
  if (entity === "contacts") {
    const { data, error } = await access.db
      .from("accounts")
      .select("id,name")
      .order("name")
      .limit(500);
    if (error) throw new Error("Unable to load institutions.");
    accounts = data ?? [];
  }
  return (
    <>
      <PageHeader
        title={`New ${entity === "accounts" ? "account" : "contact"}`}
        description="A little context makes every conversation better."
      />
      <section className="panel">
        <RecordForm entity={entity} accounts={accounts} />
      </section>
    </>
  );
}
