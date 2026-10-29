export type SalesSection =
  "opportunities" | "quotations" | "subscriptions" | "renewals" | "payments";
export type SubscriptionKind = "Turnitin" | "Other";
export type SalesField = {
  key: string;
  label: string;
  type:
    | "text"
    | "date"
    | "money"
    | "account"
    | "product"
    | "textarea"
    | "currency"
    | "duration"
    | "select"
    | "subscription";
  required?: boolean;
  suggestions?: readonly string[];
  help?: string;
};
export const paymentStatuses = [
  "Invoice sent",
  "Unpaid",
  "Partially Paid",
  "Paid",
] as const;
export const opportunityStages = [
  "New",
  "Qualified",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
] as const;
export const renewalStages = [
  "Not started",
  "Contacted",
  "Negotiating",
  "Renewed",
  "Not renewing",
] as const;
export const subscriptionStatuses = [
  "Active",
  "Confirmed",
  "Upcoming",
  "Expired",
  "Cancelled",
] as const;
export const quotationStatuses = [
  "Draft",
  "Pending",
  "Accepted",
  "Declined",
  "Expired",
] as const;
export const salesDefinitions: Record<
  SalesSection,
  {
    title: string;
    singular: string;
    table: string;
    searchColumn: string;
    defaultSort: string;
    fields: SalesField[];
  }
> = {
  opportunities: {
    title: "Opportunities",
    singular: "opportunity",
    table: "sales_opportunities",
    searchColumn: "name",
    defaultSort: "date",
    fields: [
      {
        key: "name",
        label: "Opportunities Name",
        type: "text",
        required: true,
      },
      {
        key: "organization_name",
        label: "Organization",
        type: "text",
        required: true,
      },
      { key: "product_id", label: "Product", type: "product", required: true },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "due_date", label: "Due Date", type: "date" },
      {
        key: "value",
        label: "Value",
        type: "money",
        help: "No currency is specified for opportunity values in the workbook. Values are not combined into a revenue total.",
      },
      {
        key: "stage",
        label: "Stage",
        type: "text",
        required: true,
        suggestions: opportunityStages,
      },
      {
        key: "action_type",
        label: "Type of Action",
        type: "text",
        suggestions: ["Call", "Email", "Meeting", "Proposal", "Follow-up"],
      },
      { key: "expected_close", label: "Expected Close", type: "date" },
      { key: "note", label: "Note", type: "textarea" },
    ],
  },
  quotations: {
    title: "Quotations",
    singular: "quotation",
    table: "sales_quotations",
    searchColumn: "lcid",
    defaultSort: "lcid",
    fields: [
      { key: "lcid", label: "LCID", type: "text", required: true },
      { key: "type", label: "TYPE", type: "text" },
      {
        key: "client",
        label: "CLIENT",
        type: "text",
        help: "Retained separately from Customer, as specified in the workbook.",
      },
      { key: "nom", label: "NOM", type: "text" },
      { key: "ref_eng", label: "REF.ENG", type: "text" },
      { key: "compte_no", label: "COMPTENO", type: "text" },
      {
        key: "ccy",
        label: "CCY",
        type: "currency",
        required: true,
        help: "Use a three-letter currency code, for example TND, EUR or USD.",
      },
      { key: "amount", label: "AMOUNT", type: "money", required: true },
      { key: "drawings", label: "DRAWINGS", type: "money" },
      { key: "liability_amount", label: "LIABILITY AMOUNT", type: "money" },
      { key: "total_lc", label: "TOTAL LC", type: "money" },
      { key: "total_liab", label: "TOTAL LIAB", type: "money" },
      { key: "total_drawings", label: "TOTAL DRAWINGS", type: "money" },
      { key: "account_id", label: "Customer", type: "account", required: true },
      { key: "product_id", label: "Product", type: "product", required: true },
      {
        key: "subscription_period",
        label: "Subscription Period",
        type: "text",
        help: "Keep the period wording from your quotation, for example September 2026 – August 2027.",
      },
    ],
  },
  subscriptions: {
    title: "Subscriptions / Renewals",
    singular: "subscription",
    table: "sales_subscriptions",
    searchColumn: "contract_duration",
    defaultSort: "end_date",
    fields: [
      { key: "account_id", label: "Customer", type: "account", required: true },
      { key: "product_id", label: "Product", type: "product", required: true },
      {
        key: "creation_date",
        label: "Creation Date",
        type: "date",
        required: true,
      },
      {
        key: "payment_status",
        label: "Payment Status",
        type: "select",
        required: true,
        suggestions: paymentStatuses,
      },
      { key: "start_date", label: "Start Date", type: "date", required: true },
      { key: "end_date", label: "End Date", type: "date", required: true },
      {
        key: "contract_duration",
        label: "Contract Duration",
        type: "duration",
        help: "Enter your contract wording, or leave blank to calculate inclusive calendar days.",
      },
      {
        key: "status",
        label: "Status",
        type: "text",
        required: true,
        suggestions: subscriptionStatuses,
      },
      {
        key: "annual_amount",
        label: "Annual Amount",
        type: "money",
        help: "Annual contract value. Add a currency to include this subscription in revenue.",
      },
      {
        key: "currency",
        label: "Currency",
        type: "currency",
        help: "Revenue is shown separately for each currency; amounts are never converted or combined.",
      },
    ],
  },
  payments: {
    title: "Payments",
    singular: "payment",
    table: "sales_payments",
    searchColumn: "invoice_reference",
    defaultSort: "payment_date",
    fields: [
      { key: "account_id", label: "Customer", type: "account", required: true },
      { key: "product_id", label: "Product", type: "product", required: true },
      {
        key: "invoice_reference",
        label: "Invoice / Reference Number",
        type: "text",
        required: true,
      },
      { key: "amount", label: "Amount", type: "money", required: true },
      { key: "currency", label: "Currency", type: "currency", required: true },
      {
        key: "payment_date",
        label: "Payment Date",
        type: "date",
        required: true,
      },
      {
        key: "payment_method",
        label: "Payment Method",
        type: "text",
        required: true,
        suggestions: ["Bank transfer", "Card", "Cash", "Cheque", "Other"],
      },
      {
        key: "payment_status",
        label: "Payment Status",
        type: "select",
        required: true,
        suggestions: paymentStatuses,
      },
      { key: "notes", label: "Notes", type: "textarea" },
      { key: "subscription_id", label: "Subscription", type: "subscription" },
    ],
  },
  renewals: {
    title: "Renewals",
    singular: "renewal",
    table: "sales_renewals",
    searchColumn: "next_action",
    defaultSort: "expiry_date",
    fields: [
      {
        key: "account_id",
        label: "Organization",
        type: "account",
        required: true,
      },
      { key: "product_id", label: "Product", type: "product", required: true },
      {
        key: "expiry_date",
        label: "Expiry Date",
        type: "date",
        required: true,
      },
      {
        key: "renewal_stage",
        label: "Renewal Stage",
        type: "text",
        required: true,
        suggestions: renewalStages,
      },
      { key: "next_action", label: "Next Action", type: "text" },
      { key: "follow_up_date", label: "Follow-up Date", type: "date" },
    ],
  },
};
export const salesBase = "/modules/justech-sales";
export function isSalesSection(value: unknown): value is SalesSection {
  return typeof value === "string" && Object.hasOwn(salesDefinitions, value);
}
export function salesPath(
  section: SalesSection | "overview",
  kind?: SubscriptionKind,
) {
  if (section === "renewals") return `${salesBase}/subscriptions?tracking=1`;
  return `${salesBase}/${section}${section === "subscriptions" ? `?kind=${kind ?? "Turnitin"}` : ""}`;
}
export const overviewIndicators = [
  "Active Opportunities",
  "Pending Quotations",
  "Active Subscriptions",
  "Upcoming Renewals",
  "Annual Sales Revenue",
  "Overdue Follow-ups",
] as const;
