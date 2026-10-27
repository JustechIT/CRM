import Link from "next/link";
import { notFound } from "next/navigation";
import { authorized, recordName, type RecordData } from "@/lib/directory";
import { uuid } from "@/lib/validation";
import { PageHeader, EmptyState } from "@/components/ui";
import { RecordForm, DeleteForm } from "@/components/record-form";
export default async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ entity: string; id: string }>;
  searchParams: Promise<{ edit?: string; saved?: string }>;
}) {
  const { entity, id } = await params;
  const query = await searchParams;
  if (
    (entity !== "accounts" && entity !== "contacts") ||
    !uuid.safeParse(id).success
  )
    notFound();
  const access = await authorized("directory.read");
  if (!access)
    return (
      <section className="panel">
        <EmptyState
          title="Directory access required"
          description="This record is available only to authorized employees."
        />
      </section>
    );
  const { data: record, error } = await access.db
    .from(entity)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("The record could not be loaded.");
  if (!record) notFound();
  const write = await authorized("directory.write");
  const remove = await authorized("directory.delete");
  let accounts: { id: string; name: string }[] = [];
  let contacts: RecordData[] = [];
  if (entity === "contacts") {
    const r = await access.db
      .from("accounts")
      .select("id,name")
      .order("name")
      .limit(500);
    if (r.error) throw new Error("Institutions could not be loaded.");
    accounts = r.data ?? [];
    if (!accounts.some((a) => a.id === record.account_id)) {
      const parent = await access.db
        .from("accounts")
        .select("id,name")
        .eq("id", record.account_id)
        .maybeSingle();
      if (parent.data) accounts.push(parent.data);
    }
  } else {
    const r = await access.db
      .from("contacts")
      .select("id,first_name,last_name,email")
      .eq("account_id", id)
      .order("last_name")
      .limit(100);
    if (r.error) throw new Error("Contacts could not be loaded.");
    contacts = r.data ?? [];
  }
  return (
    <>
      {query.saved && (
        <div className="success" role="status">
          Record saved successfully.
        </div>
      )}
      <PageHeader
        eyebrow={entity === "accounts" ? "Institution" : "Contact"}
        title={recordName(record)}
        description="Shared context for stronger relationships."
      >
        {write && query.edit !== "1" && (
          <Link className="button primary" href={`?edit=1`}>
            Edit record
          </Link>
        )}
        <Link className="button" href={`/directory?type=${entity}`}>
          Back to directory
        </Link>
      </PageHeader>
      {query.edit === "1" && write ? (
        <section className="panel">
          <RecordForm entity={entity} record={record} accounts={accounts} />
        </section>
      ) : (
        <div className="detail-grid">
          <section className="panel prose">
            <h2>Details</h2>
            <dl>
              {Object.entries(record)
                .filter(
                  ([key]) =>
                    ![
                      "id",
                      "owner_id",
                      "account_id",
                      "created_at",
                      "updated_at",
                    ].includes(key),
                )
                .map(([key, value]) => (
                  <div key={key}>
                    <dt>{key.replaceAll("_", " ")}</dt>
                    <dd>{String(value || "—")}</dd>
                  </div>
                ))}
              <dt>Created</dt>
              <dd>
                {new Date(record.created_at).toLocaleString("en-GB", {
                  timeZone: "UTC",
                })}{" "}
                UTC
              </dd>
            </dl>
            {entity === "contacts" && (
              <p>
                Institution:{" "}
                <Link
                  className="text-link"
                  href={`/directory/accounts/${record.account_id}`}
                >
                  {accounts.find((a) => a.id === record.account_id)?.name ??
                    "View institution"}
                </Link>
              </p>
            )}
          </section>
          {entity === "accounts" && (
            <section className="panel">
              <div className="panel-heading">
                <h2>Associated contacts</h2>
              </div>
              {contacts.length ? (
                <div className="prose">
                  {contacts.map((c) => (
                    <p key={c.id}>
                      <Link
                        className="text-link"
                        href={`/directory/contacts/${c.id}`}
                      >
                        {recordName(c)}
                      </Link>
                      <br />
                      {c.email}
                    </p>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No contacts yet"
                  description="Create a contact and select this institution to connect them."
                />
              )}
            </section>
          )}
        </div>
      )}
      {remove && <DeleteForm entity={entity} id={id} />}
    </>
  );
}
