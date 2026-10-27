# Justech Marketing, Operations and Training

These three modules extend the existing CRM, using the current application shell, authentication, design tokens, forms and table patterns. Sales functionality is retained; no Al-Fikr or Workspace pages are implemented or changed. No hosting or deployment is required for local development.

## Update an existing installation

Preserve your private `.env.local` and any local source changes. Download the updated source or pull the existing development branch, stop the old development server, and run from the updated project folder:

```bat
npm ci
npm run dev -- --webpack
```

Use the Local address printed by that terminal. An older downloaded folder and a server already running from it do not update automatically.

If your existing Supabase project already has migrations 0001 and 0002, apply **only the new migrations**, once and in this order:

1. `supabase/migrations/0003_justech_marketing.sql`
2. `supabase/migrations/0004_justech_operations.sql`
3. `supabase/migrations/0005_justech_training.sql`

Do not reset the database or rerun the original table-creation migrations. A new database requires all migrations in numeric order. No additional credentials, backend services, dependencies or service-role key are needed; keep your existing Supabase URL, public key and employee login.

Without Supabase, the application deliberately shows the table columns and forms for UI inspection, but saves and reference lookups are blocked. Disconnected Overview values are shown as unavailable, not fabricated counts. Connected empty tables return real zero counts from PostgreSQL. Failed queries show an error instead of masquerading as empty data.

## Specification and scope

The original workbook headings are saved in `docs/specifications/justech-departments.json`. Your latest explicit message takes precedence over these workbook spellings:

- Marketing Campaigns uses **Platform**, correcting the workbook's `Platforme`.
- Marketing Overview uses **Content Awaiting Approval**.
- Training Overview uses **Total Training Sessions**.

All other specified columns and their order are retained. Ten sections provide Add, View, Edit and confirmed Delete, search, status/date filters where applicable, sorting, and server-side pagination of 25 records. Reference pickers are searchable and paginated separately.

### Marketing

Existing URLs remain:

- `/modules/justech-marketing/overview`
- `/modules/justech-marketing/campaigns`
- `/modules/justech-marketing/content-calendar`
- `/modules/justech-marketing/marketing-assets`

Campaigns and content reference existing employees. Assets reference existing products and employees. **File / Link** stores a validated HTTP/HTTPS link to a file or asset; there is no implied file upload/storage service. No customer, product or employee records are silently created.

### Operations

The Operations submenu now contains Overview, Tasks, Projects & Delivery, Quality Control and Follow-ups. The original placeholder URLs are preserved as redirects:

- `requests` → `tasks`
- `activities` → `follow-ups`

Canonical new routes use `tasks`, `projects-delivery`, `quality-control` and `follow-ups` beneath `/modules/justech-operations`.

Tasks reuse the existing **activities** table with an explicit Operations department scope. There is no duplicate task table. Pre-existing unscoped activities remain hidden from Operations reads, edits, deletes and dashboard counts. The existing completion timestamp is maintained when an Operations task is completed or reopened; the new validation/audit behavior is scoped to Operations activities.

Project / Area accepts either an existing Operations project or a free-text business area, never both. Quality checks use the same relationship. Follow-ups reference one existing contact or organization. Project detail links open its tasks and quality checks. Related records must be removed or reassigned before a project/contact/organization can be deleted.

### Training

Existing URLs remain beneath `/modules/justech-training`: Overview, Training Sessions, Registrations and Training History.

Sessions reference existing products and active employee trainers. Registrations reference an existing institution and session. An exact case-insensitive institution/email match links a registration to an existing contact without creating or overwriting contacts; the entered participant name/email remain a registration snapshot.

One email can register only once per session. Cancelled sessions cannot accept new registrations. Session details link to registrations and history and can open a prefilled registration form. History records actual institution-level attendance and outcome; it requires a completed session. Actual attendance can differ from registration counts. A completed session with history cannot be changed back into an incomplete state without resolving that history first.

Cancelling a session does not silently delete or rewrite its existing registrations. Update their statuses explicitly according to your team's process.

## Overview definitions

All counts are calculated in the `department_overview` PostgreSQL function, under the caller's RLS and department permission. Links from a metric apply the same status/date criteria to the destination list. Dates use explicit UTC calendar days.

| Department | Indicator | Calculation |
| --- | --- | --- |
| Marketing | Active Campaigns | Status Active, with today's date between Start Date and End Date inclusive. |
| Marketing | Scheduled Content | Status Scheduled. Past-due scheduled items also appear under Overdue Content. |
| Marketing | Content Awaiting Approval | Content status Awaiting approval. |
| Marketing | Assets in Progress | Asset status In progress. |
| Marketing | Upcoming Campaigns | Starts after today and within 30 days, excluding Completed and Cancelled. |
| Marketing | Overdue Content | Publish Date before today, excluding Published and Cancelled. |
| Operations | Total Tasks | All scoped Operations activities. |
| Operations | Open Tasks | Scoped tasks excluding Completed and Cancelled. |
| Operations | Active Projects | Project status Active. |
| Operations | Pending Quality Checks | Checks excluding Completed and Cancelled. Result and workflow Status remain independent. |
| Operations | Upcoming Follow-ups | Open/In progress and Follow-up Date between today and 30 days ahead, inclusive. |
| Operations | Overdue Follow-ups | Open/In progress and Follow-up Date before today. |
| Training | Total Training Sessions | All recorded sessions. |
| Training | Upcoming Sessions | Scheduled and Date today or later. |
| Training | Completed Sessions | Status Completed. |
| Training | Total Registrations | All registration records, with statuses available for filtering. |
| Training | Pending Registrations | Registration Status Pending. |
| Training | Training History | Number of delivered history records by institution/date, not a fabricated participant total. |

## Authorization, persistence and compatibility

- Administrator: read/write/delete in all three modules.
- Management: read/write across all three; deletion remains administrator-only, matching the existing Sales convention.
- Marketing, Operations and Training roles: read/write within their own module, without automatic access to another department's business records.
- User-role assignments remain additive, supporting employees with multiple roles. Assigning a record to an employee does not grant that person new permissions.
- Inactive employees, identities without employee profiles and anonymous users cannot access module data.
- Marketing and Training can read shared Justech product names for references. This does **not** grant Sales access or product-edit rights; the existing Sales product catalog remains authoritative.
- Table/view RLS, protected owner/revision/timestamp column grants, reference constraints and server authorization enforce access independently of buttons or navigation visibility.
- All edits and deletes compare the loaded revision. A stale mutation reports a conflict instead of overwriting another user's changes.
- Delete requires typing DELETE and an administrator permission. Foreign keys preserve related business records; audit history cannot be changed by application users.
- Existing Sales schema and code remain unchanged apart from the additive shared-product read policy and extending the request authentication guard to the three new module paths. No Sales data is reset.

New canonical entities are marketing campaigns/content/assets, Operations projects/quality checks/follow-ups, and training sessions/registrations/history. Existing accounts, contacts, products, employee profiles and activities are reused where appropriate. Invoker views provide authorized related names for searches and sorting without duplicating those entities.

## Verification before production use

Automated checks cover specification parity, field validation, real PostgreSQL CRUD across all ten record types, overview counts, RLS and role isolation, linked records, duplicate registrations, protected metadata, optimistic concurrency, audits, legacy activity isolation and Sales compatibility. Desktop/mobile browser checks exercise all ten empty lists/forms, all three overviews, filtering, relationship controls, legacy redirects, request denial and unchanged Al-Fikr/Workspace pages.

The development environment has no hosted Supabase configuration. Local PostgreSQL tests do not establish hosted Authentication/PostgREST integration or authenticated browser persistence. After applying the migrations to a nonproduction instance of your existing project, sign in as Administrator and each department role and verify create/edit/reload/search/filter/paginate/delete flows, references and dashboard updates. Repeat direct API access-denial checks before using real customer information.

## Review screenshots and results

These are screenshots of the unconfigured UI, not seeded business data:

- [Marketing Overview](screenshots/justech-marketing-overview.png)
- [Operations Overview](screenshots/justech-operations-overview.png)
- [Training Overview](screenshots/justech-training-overview.png)

Final automated validation passed lint, TypeScript, production build, 52 unit/PostgreSQL tests and 40 desktop/mobile browser tests. See [the validation record](validation.md) for scope and hosted integration limits.
