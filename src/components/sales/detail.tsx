import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { PageHeader, Badge } from "@/components/ui";
import {
  salesDefinitions,
  salesPath,
  type SalesSection,
  type SubscriptionKind,
} from "@/lib/sales/config";
import {
  parameter,
  loadSalesRecord,
  textValue,
  type SalesParams,
  type SalesAccess,
} from "@/lib/sales/data";
import { idSchema } from "@/lib/sales/validation";
import { SalesForm, SalesDelete } from "./forms";
import { link, sectionTitle, RecordValue } from "./shared";

export async function SalesDetail({
  section,
  kind,
  params,
  access,
  canWrite,
  canDelete,
}: {
  section: SalesSection;
  kind?: SubscriptionKind;
  params: SalesParams;
  access: SalesAccess;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const id = parameter(params, "record");
  if (!idSchema.safeParse(id).success) notFound();
  const record = await loadSalesRecord(access, section, id);
  if (!record) notFound();
  if (section === "subscriptions")
    kind = textValue(record, "kind") === "Other" ? "Other" : "Turnitin";
  const editing = parameter(params, "edit") === "1";
  const title =
    section === "opportunities"
      ? textValue(record, "name")
      : section === "quotations"
        ? textValue(record, "lcid")
        : (record.account_name ?? "Subscription");
  return (
    <>
      {parameter(params, "saved") === "1" && (
        <div className="success" role="status">
          {salesDefinitions[section].singular[0].toUpperCase() +
            salesDefinitions[section].singular.slice(1)}{" "}
          saved successfully.
        </div>
      )}
      <PageHeader
        eyebrow={`Justech Sales · ${sectionTitle(section, kind)}`}
        title={editing ? `Edit ${salesDefinitions[section].singular}` : title}
        description={record.product_name ?? "Sales record"}
      >
        <Link
          className="button"
          href={link(section, params, {
            record: null,
            edit: null,
            saved: null,
          })}
        >
          <ArrowLeft size={15} />
          Back to list
        </Link>
        {!editing && canWrite && (
          <Link
            className="button primary"
            href={link(section, params, { edit: "1", saved: null })}
          >
            Edit record
          </Link>
        )}
      </PageHeader>
      {editing ? (
        <section className="panel">
          <SalesForm
            section={section}
            kind={kind}
            record={record}
            canWrite={canWrite}
          />
        </section>
      ) : (
        <>
          <section className="panel sales-record-detail">
            <div className="panel-heading">
              <h2>Record details</h2>
              {section === "quotations" && (
                <Badge>{textValue(record, "decision_status")}</Badge>
              )}
            </div>
            <dl>
              {salesDefinitions[section].fields.map((field) => (
                <div key={field.key}>
                  <dt>{field.label}</dt>
                  <dd>
                    {field.key === "account_id" ? (
                      <Link
                        className="text-link"
                        href={`/directory/accounts/${textValue(record, "account_id")}`}
                      >
                        {record.account_name ?? "View institution"}
                        <ArrowUpRight size={13} />
                      </Link>
                    ) : (
                      <RecordValue record={record} field={field} />
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="sales-record-meta">
              <span>
                Created{" "}
                {new Date(record.created_at).toLocaleDateString("en-GB", {
                  timeZone: "UTC",
                })}
              </span>
              <span>
                Updated{" "}
                {new Date(record.updated_at).toLocaleDateString("en-GB", {
                  timeZone: "UTC",
                })}
              </span>
              <span>Version {record.revision}</span>
            </div>
          </section>
          {section === "subscriptions" && canWrite && (
            <div className="sales-inline-actions">
              <Link
                className="button"
                href={`${salesPath("renewals")}?new=1&subscription=${record.id}`}
              >
                Prepare renewal
              </Link>
            </div>
          )}
        </>
      )}
      {!editing && canDelete && (
        <SalesDelete section={section} record={record} kind={kind} />
      )}
    </>
  );
}
