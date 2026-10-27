# Justech Sales — workbook implementation

Scope: Justech Sales only. Existing application shell, sidebar hierarchy, navigation URLs, Accounts & Contacts, authentication, and other department starter pages are preserved. No hosting or deployment is required for local UI review.

## Source and approved changes

The attached `Justech_CRM_Consolidated_Specification.xlsx` has six Justech Sales sheets. Blank rows are specifications, never seeded customer data. The literal source headings and order are saved in `docs/specifications/justech-sales.json` and tested against the UI configuration.

User amendment: append **Annual Amount** and **Currency** to both subscription tables. The original six subscription columns remain in order. All other workbook headings, including `Opportunities Name`, `NOM`, `REF.ENG`, `COMPTENO`, and the independent quotation totals, are preserved exactly.

The existing sidebar's **Subscriptions** URL has two tabs: **Turnitin Subscriptions** and **Other Subscriptions**. Create, detail, edit and catalog views use query parameters on the existing Sales URLs, so the sidebar and its selection behavior remain unchanged. Other departments were not implemented in this increment.

## Local review on Windows

Use the updated source from the existing `codex/justech-crm-preview` GitHub branch. If you originally downloaded a ZIP, extract the updated ZIP into a new folder; your previous folder will not update automatically. Keep any local edits and `.env.local` private and separate.

With Node.js 24 installed, open Command Prompt in the new project folder:

```bat
npm ci
npm run dev -- --webpack
```

Open the local address printed by Next.js on your own computer. Webpack is a supported alternative if Windows filesystem scanning makes Turbopack slow. Saving source changes updates the browser without deployment.

Without Supabase, Sales tables still show their exact columns; you can inspect forms, tabs, filters and currency-separated empty revenue. Saving and exports are explicitly disabled. Server actions and lookup/export endpoints independently reject unauthenticated requests. There is no mock persistence, demo account, public registration, or replacement database.

## Enable actual Sales persistence

Keep the existing Supabase configuration and authentication. Apply `0002_justech_sales.sql` **after** `0001_crm.sql`. Existing databases with 0001 already applied need only 0002. Do not reset or overwrite the existing database. The two existing environment variables remain sufficient:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

No new secret or service-role credential is required. Hosted Supabase is not configured in the development environment used for this implementation, so hosted login/PostgREST/browser persistence remain unverified here. Follow the authenticated checklist below before importing real customer data.

## Features

- Server-rendered, 25-row paginated lists. Full-column search includes linked institution and product names. Status/stage, sort direction, date windows and overdue filters are applied on the server.
- Create, view, edit and confirmed delete for all four Sales entity types; both subscription tabs use one canonical contract table.
- Searchable, keyboard-accessible institution/product pickers with paginated results; references come from shared institutions and a reusable products catalog. Users must choose an existing reference rather than silently creating a duplicate name.
- Add and rename products and assign Turnitin/Other classification in the Sales catalog. Reclassifying a product with incompatible existing subscriptions is rejected.
- Renewal preparation copies the institution, product and expiry from a selected subscription into a form. **No renewal is created until explicitly saved.** Duplicate customer/product/expiry renewal rows are rejected.
- Exact-column UTF-8 CSV exports, with formula-prefix neutralization. Exports honor the current filters and permissions, and reject oversized exports rather than silently truncating them.
- SQL constraints, foreign keys, employee ownership, audit triggers, RLS, protected system columns and optimistic version checks. A stale editor cannot silently overwrite or delete a newer version.

## Overview definitions

All indicators are queried in PostgreSQL with the caller's existing permissions. A failed data load shows an error, not a fabricated empty result. Dates use explicit UTC calendar days.

| Indicator | Definition |
| --- | --- |
| Active Opportunities | Stage is not Won, Lost or Closed, ignoring case/outer whitespace. |
| Pending Quotations | Supplementary review status is Pending. |
| Active Subscriptions | Status Active and today's date is within the contract dates, inclusive. |
| Upcoming Renewals | Active subscriptions whose terms include today and expire within 90 days, inclusive. |
| Annual Sales Revenue | Annual Amount of the latest confirmed term for each customer/product that intersects the selected year, grouped by Currency. |
| Overdue Follow-ups | Past-due opportunity Due Dates plus open renewal Follow-up Dates, excluding terminal stages. |

Revenue rules:

- Confirmed subscription statuses are **Active**, **Confirmed**, and **Expired**. Upcoming/draft and Cancelled records do not contribute.
- Count the latest Start Date per customer/product covering any part of the selected calendar year. End Date, creation time and ID provide deterministic tie-breaking. This avoids adding both the predecessor's and renewed term's annual values.
- Read only the subscription table. A Renewal follow-up is **never** a second financial entry.
- Values are annual contract values, **not prorated accounting revenue or cash receipts**. The UI explains the rule. Supporting separate simultaneous licenses for the same customer/product would require a distinct contract identifier and a separately agreed calculation rule.
- Do not silently reuse a predecessor's price if the latest confirmed term is unpriced. Missing financial data contributes zero.
- Always display TND, EUR and USD separately; additional three-letter codes are supported and get their own totals. No exchange-rate conversion or cross-currency grand total is performed.
- Use exact PostgreSQL decimals and return revenue totals as decimal strings. Amounts support up to 12 whole digits and 3 decimal places. A currency is mandatory if Annual Amount is supplied, including a zero amount.
- Duplicate customer/product/start/end contract periods are forbidden in the canonical table, across both subscription tabs.

The workbook does not specify quotation decision status or stage dropdown options. A separate **Review status** control supplies Draft/Pending/Accepted/Declined/Expired for the Pending Quotations indicator; it is workflow metadata, **not an added quotation table column**. Opportunity, renewal and subscription stages offer suggestions but allow existing business wording. Custom terminal stages need an agreed definition before they can affect indicator rules.

Financial quotation totals are independently editable because the workbook provides no formulas. The application does not invent relationships between AMOUNT, DRAWINGS, LIABILITY AMOUNT, TOTAL LC, TOTAL LIAB or TOTAL DRAWINGS. COMPTENO and reference identifiers remain strings, preserving leading zeros. Contract Duration accepts business wording; when omitted, the server calculates inclusive calendar days.

## Access and migration

New entities: `products`, `sales_opportunities`, `sales_quotations`, `sales_subscriptions`, `sales_renewals`. All business records reference shared accounts and employee owners; Sales records reference shared products. Related institution/product deletion is restricted.

RLS-protected invoker views expose linked names for searching and sorting. The `sales_overview` function is an invoker function that checks `sales.read`; its totals remain subject to RLS. No view or metric bypasses employee permissions.

- Administrator: read/write/delete Sales.
- Management and Sales: read/write Sales.
- Other departments, inactive employees, unprofiled users and anonymous callers: no Sales access by default.
- Product removal is intentionally not exposed; edit names/categories while preserving contract references and audit history.

No browser client can assign itself roles or update record ownership, revisions, IDs or protected timestamps. Delete requires both administrator permission and typing DELETE. Stale mutations return a clear conflict without overwriting another user's work.

## Verification and review checklist

Automated coverage includes workbook column parity, validation and exact decimal handling, CSV safety, real PostgreSQL migrations/RLS/constraints/revenue calculations, and desktop/mobile browser checks of the unconfigured preview. See `tests/sales.test.ts`, `tests/sales-security.test.ts` and `tests/e2e/sales.spec.ts`.

Before calling hosted Sales ready, validate against a nonproduction Supabase project:

1. Apply 0002 and sign in as Sales, Management, Administrator, an unrelated department and an inactive employee.
2. Create two product types and shared institutions. Create/edit/reload all Sales record types; verify reference links and filtered/paginated queries.
3. Enter TND, EUR and USD subscription amounts; change the revenue year. Confirm separate totals, cancellation exclusions, latest-term renewal de-duplication and zeros for missing data.
4. Mark quotations Pending and change opportunity/renewal stages. Verify the Overview counts and overdue links.
5. Prepare a renewal from a subscription, review it, and explicitly save it. Verify no automatic extra financial record was created.
6. Export more than one backend page and verify every expected row and column; test formula-looking text safely.
7. Open one record in two tabs and save conflicting edits. The second save must report a conflict. Confirm administrator-only deletion and immutable audit events through direct REST requests as well as UI controls.

Review **Justech Sales** with the user before starting any other department.

## Review screenshots

These are actual screenshots of the unconfigured UI, with no seeded business records:

- [Sales Overview](screenshots/justech-sales-overview.png)
- [Other Subscriptions](screenshots/justech-sales-subscriptions.png)

The current verification run passed lint, TypeScript, production build, 35 unit/PostgreSQL tests and 24 desktop/mobile preview browser tests. Hosted authenticated browser flows remain unverified, as described above.
