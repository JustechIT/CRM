# Justech CRM

Internal English-language workspace for Justech and Al-Fikr. This first implementation increment includes a responsive application shell, complete proposed navigation, safe setup preview, Supabase employee authentication code, an Accounts & Contacts directory, and a PostgreSQL security foundation. It is not the complete Phase 1 release.

## Run locally

Use Node.js 24 LTS (see `.nvmrc`). The lockfile pins the compatible dependency set. TypeScript 6.0.3 and ESLint 9.39.5 are intentionally pinned because the current Next.js lint plugins do not support TypeScript 7 / ESLint 10 as a complete peer-compatible set. From `/workspace/CRM`:

```sh
npm ci
npm run dev
```

Without Supabase configuration the application deliberately opens an empty setup preview. Login, writes and the search API remain unavailable. There are no demo accounts or fabricated business records. Preview mode is not a database/authentication emulator. Do not connect production customer data before completing the integration checks below.

The project stores npm's cache in the ignored `.npm-cache` directory so installation works both in the cloud sandbox and on hosting providers.

## Supabase setup

1. Create a Supabase project. Disable public registration in **Authentication → Providers / Sign In settings**. Configure your application URL and allowed redirect URLs for each deployment.
2. Apply `supabase/migrations/0001_crm.sql` once to a fresh database using the Supabase SQL editor or your normal CLI migration workflow. Do not run a destructive reset on an existing database.
3. Copy `.env.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`: project HTTPS URL.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: project's public publishable key. A public anonymous key also works under this variable name for older projects.
4. Never put a service-role/secret key in these variables. No service-role key is needed by this app. Public keys are intentionally browser-safe; actual access is enforced by authenticated employee checks and RLS.
5. Bootstrap your administrator as described below, restart Next.js, and log in.

### Initial administrator bootstrap

This is a trusted operator task, not a public registration endpoint. In the Supabase Authentication dashboard, create an email-confirmed employee identity with a unique strong password delivered privately through your organization's secure process. Do not create shared or hardcoded demo credentials. Record its actual UUID, then run the following transaction in the trusted SQL editor, replacing the UUID and name:

```sql
begin;
insert into public.employee_profiles(id,full_name,status)
values ('REPLACE-WITH-AUTH-USER-UUID', 'Administrator name', 'active');
insert into public.user_roles(user_id,role_id)
values ('REPLACE-WITH-AUTH-USER-UUID','administrator');
insert into public.user_departments(user_id,department_id)
values ('REPLACE-WITH-AUTH-USER-UUID','management');
commit;
```

Repeat with appropriate roles for additional employees. A user can have multiple role and department rows. Never insert an administrator role based on user-supplied signup metadata. Deactivate a profile by setting `status='inactive'` through a trusted operator; permissions then fail even if an auth session still exists. Profile and role changes have no browser write grants. The future invitation service must validate administrator permissions on the server, keep any admin credential server-only, provide audit records, and use expiring invitation links. In-app invitation acceptance, password setup/recovery and role editing are not implemented yet.

### Database relationships and permission model

- `auth.users` → one `employee_profiles` row; authentication identities are separate from business profiles.
- `user_roles` / `role_permissions` implement additive, many-to-many permissions.
- `user_departments` provides independent many-to-many department membership; department membership alone does not grant access.
- `accounts` owns institution context and references an employee owner.
- `contacts` references an account and employee owner; account deletion is restricted while contacts exist. Non-empty contact emails are unique within each account, case-insensitively.
- `user_preferences` is employee-scoped, prepared for future synced preferences. Current pin/sidebar/theme preferences are device-local and contain no business data.
- `activities` reserves account/contact relationships; access is closed until its workflow is implemented.
- `audit_records` stores actor, entity, record identifier, action and time for directory writes without copying personal record contents. Application users cannot modify audit entries.

All application tables enable RLS. Anonymous clients have no table access. Active employees with `directory.read` can see the shared directory across business areas; this is an explicit Phase 1 shared-directory policy, not account-level isolation. Sales, Operations and Management have directory write access; Administrators additionally have delete access. Marketing, Training and IT are read-only by default. Owners are assigned to the current employee on creation; owner/timestamp/id reassignment is excluded by column grants. Extra roles and permissions can be added with migrations. A future customer portal requires separate tenant isolation and policies before any external access is enabled.

### Features in this increment

- Responsive sidebar with all proposed sections/submenus, single expanded department, desktop collapse, mobile modal navigation, current-page indicators and pinned routes.
- Reusable page headers, notices, badges, empty/error/loading states, forms, tables and confirmation patterns.
- Light/dark tokens; provisional green/neutral palette, with no claim to official brand colors. No external font requests are needed.
- Empty dashboard with honest unavailable metrics and links to useful next steps; no fabricated revenue/customer numbers.
- Server-rendered account/contact lists with bounded search, filters, ordering and 20-row pagination.
- Server-validated create/edit/delete actions, detail pages, account/contact links, Zod validation and deletion confirmation.
- Employee password login, server-side employee and capability checks, cookie refresh, RLS migration and audit triggers.
- Global keyboard search (`Ctrl/Cmd+K`), grouped directory results, bounded server queries and explicit unauthorized responses.
- Read-only employee directory/profile and documented bootstrap architecture.
- All future department routes show clearly labeled planned modules; import is an explicitly non-operational workflow page.

### Known limits and next work

The browser flows with a real Supabase project have **not been verified** without project configuration. Login/session renewal, REST integration, configured persistence and hosted RLS behavior remain release gates. Local PostgreSQL tests verify the actual migration under simulated Supabase auth claims; they do not prove hosted Supabase Authentication or PostgREST integration.

The full Phase 1 is incomplete. Missing work includes CSV/XLSX parsing/mapping/preview/import/error reporting, user invitations and permission-management UI, password recovery, owner reassignment, account-backed activity feeds/tasks, real dashboard metrics, synced pins, operational notifications, and authenticated browser flow tests. No chart library is loaded because there is no implemented metric series yet. Starter modules and notifications must not be described as operational.

Contact creation currently selects from up to 500 authorized institutions; associated-contact detail lists are capped at 100 and the team directory at 100 profiles. Replace these selectors with server-paginated lookups before using larger datasets. Database search currently uses bounded ILIKE queries; add appropriate trigram indexes after measuring real volume. Account duplicate detection and import staging are still to implement; no account is silently merged. No business data is stored in browser localStorage.

Recommended next task: connect a nonproduction Supabase project, apply the migration, create distinct administrator/sales/read-only/inactive test identities, and automate the authenticated acceptance checks. Then implement safe staged CSV import before importing real customer data.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

`npm test` runs input/navigation tests and a real PostgreSQL WASM (PGlite) migration/security suite, including anonymous denial, multiple roles, inactive employees, read-only roles, self-escalation denial, ownership constraints, contact uniqueness, preference isolation and audit behavior. Synthetic records exist only in this isolated test database.

Browser tests exercise the **unconfigured preview**, not authenticated persistence:

```sh
PLAYWRIGHT_BROWSERS_PATH=/workspace/.playwright npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=/workspace/.playwright npm run test:e2e
```

The cloud image also provides Chromium. To use it without downloading another browser:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Build first. Playwright starts the production server when necessary. Run against a server with no Supabase variables set; the test web server clears them. The tests cover desktop/mobile navigation, pin persistence, safe creation blocking, filters, search keyboard interaction, login disabling and unknown routes.

Before enabling real data, verify with a hosted nonproduction project:

1. Anonymous and unprofiled users cannot access directory APIs or tables.
2. An invited/created active employee can sign in; inactive employees cannot.
3. Sales can create an institution, add a linked contact, reload, search, filter and edit both records.
4. A read-only role cannot mutate using UI, server actions **or direct REST requests**.
5. Users cannot change their own roles, status, record ownership or protected timestamps.
6. Administrators can delete contacts, then their institution; audit records are emitted and immutable to application clients.
7. Refresh and expiry behavior preserve/clear cookies appropriately; sign-out ends access.

## Deployment preparation

Deploy to Vercel as a Next.js application with Node.js 24 and the two documented public environment variables, set separately for preview and production. Apply migrations explicitly to the target database before enabling access. Do not automatically migrate production as part of `next build`. Configure Supabase site/redirect URLs, disable public signup, enforce your organization's password/MFA policy, and complete integration acceptance checks. Next.js provides server-action origin checks; deploy behind a trusted correctly configured proxy. The local preview is not a customer portal.

## Code map

- `src/app/(workspace)`: protected server layout, dashboard, directory, profile/team/settings and planned modules.
- `src/components`: shell, reusable UI, login and record forms.
- `src/lib`: navigation, validation, server-only Supabase/data/authorization helpers.
- `src/proxy.ts`: server auth-cookie refresh.
- `supabase/migrations`: database structure, capabilities, grants, RLS and audit triggers.
- `tests`: unit, PostgreSQL security and browser smoke tests.
