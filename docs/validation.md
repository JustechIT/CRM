# Validation record — 2026-10-27

This record describes the first implementation increment, not completion of the full Phase 1 acceptance criteria.

| Check | Result |
| --- | --- |
| Clean locked dependency installation (`npm ci`) | Passed |
| ESLint (`npm run lint`) | Passed, no warnings from application lint |
| Strict TypeScript (`npm run typecheck`) | Passed |
| Unit and PostgreSQL security tests (`npm test`) | 15 passed, 0 failed, 0 skipped |
| Production compilation (`npm run build`) | Passed |
| Desktop/mobile browser tests | 10 passed, 0 failed, 0 skipped |
| Production dependency audit | 0 reported vulnerabilities |
| Visual inspection | Desktop and mobile screenshots reviewed; no horizontal overflow or observed browser page errors |

Browser tests use the image's `/usr/bin/chromium` via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. The optional Playwright browser download returned a network-policy 403; the installed Chromium provided the tested alternative without disabling TLS verification.

SQL security tests execute the actual migration in PostgreSQL via PGlite, with test-only auth schema and JWT-claim stubs. They cover anonymous denial, missing/inactive profiles, multiple employee roles, writer/read-only restrictions, ownership and protected-column restrictions, contact relationships and uniqueness, self-escalation denial, preference isolation, deletion constraints and immutable audit behavior. These checks do not substitute for hosted Supabase Authentication/PostgREST integration tests.

Supabase configuration was absent. Hosted login/session renewal, authenticated CRUD through Next.js, hosted database persistence and hosted RLS remain unverified. The preview intentionally blocks these operations. The import page, operational notifications, tasks and future department modules are not implemented workflows. See README.md for remaining work and the hosted acceptance checklist.

The compatible lockfile pins TypeScript 6.0.3 and ESLint 9.39.5. TypeScript 7 was rejected by the installed TypeScript ESLint tooling; ESLint 10 falls outside several Next.js plugin peer ranges. npm reports ESLint 9's upstream deprecation notice during installation; this is a documented tooling limitation, not a suppressed lint error.

## Justech Sales increment — 2026-10-27

The workbook-driven Sales implementation extends the original application. The original sidebar/navigation file and shell component are unchanged.

| Check | Result |
| --- | --- |
| ESLint | Passed, 0 warnings |
| Strict TypeScript | Passed |
| Unit and PostgreSQL tests | 35 passed, 0 failed, 0 skipped |
| Production build | Passed |
| Desktop/mobile browser tests | 24 passed, 0 failed, 0 skipped |
| Visual inspection | Sales Overview and subscription tables reviewed; no observed browser page errors or mobile horizontal overflow |

New database coverage executes migrations 0001 and 0002 in PostgreSQL (PGlite), tests all Sales entities, lookup names through RLS-protected views, legacy quotation field independence, three-decimal amounts, contract/category constraints, duplicate prevention, protected metadata, optimistic edit conflicts, administrator-only deletion, audit records and inactive/anonymous/unrelated-department denial. Revenue cases verify separate TND/EUR/USD totals, selected-year boundaries, latest confirmed customer/product terms, cancelled and upcoming exclusions, renewal follow-up exclusion, missing prices and zero values. CSV tests exercise formula-prefix safety and complete retrieval when a backend caps individual pages below the requested size.

The browser run verifies exact workbook headers plus Annual Amount/Currency, form labels, tabs, filters, year selection and zero-state currency display, sticky table columns, responsive layout, API/mutation denial and unchanged non-Sales starter pages. Unauthenticated Sales POSTs are rejected in the request proxy before action decoding; a regression check verifies HTTP 401 and a subsequent healthy Overview request.

The environment has no Supabase project configured. These successful checks do **not** establish hosted Supabase Authentication, PostgREST integration or authenticated browser CRUD persistence. Those remain explicit checks in `docs/justech-sales.md`. No customer information was imported and no website was deployed.

## Marketing, Operations and Training increment — 2026-10-27

| Check | Result |
| --- | --- |
| ESLint and strict TypeScript | Passed, 0 lint warnings |
| Unit/PostgreSQL tests | 52 passed, 0 failed, 0 skipped |
| Production build | Passed |
| Desktop/mobile browser tests | 40 passed, 0 failed, 0 skipped |
| Visual inspection | Three department Overviews and a mobile follow-up form inspected; no observed browser errors or mobile overflow |

The new database suite applies migrations 0001 through 0005 together. It creates, reads, edits and deletes all ten department record types under authenticated PostgreSQL roles, checks real Overview counts, related employees/products/institutions/contacts/sessions, input constraints, module isolation, shared product access without Sales access, stale version rejection, administrator deletion and immutable audit metadata. It also verifies Operations completion timestamps, prevents access/mutation of unrelated existing activities, and confirms Sales persistence after the additive migrations.

The browser suite includes the existing Sales and application-shell regressions. New coverage checks all ten tables/forms against workbook headings and the latest user label corrections, date controls, three six-indicator Overviews, filter/sort submissions, project/area and contact/organization choices, legacy Operations redirects, unauthorized lookup/mutation rejection, responsive navigation and unchanged Al-Fikr/Workspace starter pages.

The two initial browser failures were test locator mismatches for the sort-order dropdown; the corrected role-based locator passed on desktop and mobile in the final 40-test run. No test assertions or access policies were disabled.

Hosted Supabase Authentication/PostgREST and authenticated browser CRUD were unavailable in this execution environment. PostgreSQL tests use isolated synthetic fixtures only; no customer data was seeded or migrated, no existing business records were reset and no website deployment was attempted. Apply new migrations 0003, 0004 and 0005 to the existing configured project before validating hosted persistence.

## Sales, Operations Caution and private Supplier Invoices — 28 October 2026

- `npm run lint`: passed. Generated browser traces/results and npm cache are explicitly excluded to avoid scans racing with Playwright output cleanup.
- `npm run typecheck`: passed.
- `npm test`: 63 passed, zero failed/skipped. New actual-PostgreSQL coverage applies 0006–0008 after seeding earlier-schema subscription/quotation/renewal records. It verifies hidden legacy data retention, Caution's Operations access, payment CRUD/reference/currency/balance integrity, default denial including Admin, explicit approved-user bootstrap, Souhail-only grant/revoke, audit privacy, inactive/revoked users, anonymous denial and private Storage RLS. A broad unrelated Storage read policy is deliberately present to verify the restrictive private-bucket fence.
- `npm run build`: passed.
- `CI=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`: 48 passed on desktop/mobile. Covers new payment and Caution forms, exact columns, numeric/dropdown fields, integrated renewal links, current sidebar/pinning, safe preview save blocking, hidden Finance navigation, direct private page/API/file denials and forged access-management submissions.
- Browser checks initially caught a required flag on the optional subscription selector; corrected and the full browser suite passed. Old tests expecting a separate Renewals sidebar item were updated to the user-approved Subscriptions / Renewals navigation. Initial SQL tests caught an audit-policy expression accidentally applied to the ACL policy; fixed before the passing migration run.
- No remote Supabase migration, account grant, deployment or customer-record write was performed. Storage SQL policies are exercised using a local Storage schema stub. Authenticated hosted browser CRUD and actual Supabase file-service upload/download round trips must be checked in the connected project after applying the new SQL setup.

## Workspace and verified Team Management — 28 October 2026

- `npm run lint`, `npm run typecheck`, and `npm run build`: passed.
- `npm test`: 80 passed, zero failed/skipped. New PostgreSQL tests apply 0009–0010 to the existing schema. Coverage includes scoped activity reuse without Operations/legacy changes, project/task FK enforcement and progress, conference/event CRUD, default-denied new permissions, preserved legacy grants, verified identity staging and authenticated activation, protected Super Admin identity, explicit role/module writes, assigned-record limits, readonly Viewers, private invoice/file write denial, one-time invitation acceptance, cancellation, expiry, unconfirmed identities, deactivation, archive/removal, audit and deletion.
- `CI=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`: 60 passed on desktop/mobile, zero skipped. New coverage checks exact Workspace and user columns, Add forms, date/dropdown controls, My Priorities and other filters, Conferences/Events tabs, project-scoped issue forms and Cancel links, disabled setup-preview writes, public invite acceptance blocking, direct Team API denials and forged Workspace/Team action submissions.
- The initial browser run passed 58/60: exact text-label locators included dropdown option text. Accessible-role locators were used to select the Priority and Status controls; the full browser suite passed afterward. Project task Cancel/Delete destinations retain their parent context.
- The application verifies the corrected designated identity `souhail@justech.tn` using a trusted staged UUID lookup and then an authenticated matching-session activation. No user is promoted by a typed email, legacy Admin role or signup metadata. No new business records are seeded.
- No live Supabase schema migration, initial privilege activation, invitation email, hosted account change or deployment was performed. Actual hosted session/activation, invitation delivery, authenticated browser CRUD and Storage service calls require checking in the connected project. PostgreSQL tests use simulated auth claims and a Storage schema stub; browser tests use the safe unconfigured preview.

## Al-Fikr, imports, invitations and personal workspace — 28 October 2026

- Lint, strict TypeScript and production build passed. Production dependency audit reported zero vulnerabilities.
- Unit/PostgreSQL suite: 103 passed, zero failed/skipped. All migrations through 0013 run in isolated PostgreSQL with simulated Supabase identities. Coverage includes all seven Al-Fikr tables and relationships, exact workbook fields, CRUD/revisions, real currency-separated revenue, assigned-record and Viewer restrictions, atomic/idempotent directory imports, duplicate matching, CSV/XLSX parsing and size limits, own preferences, administrator-only name changes, own notification state and permission-filtered dashboard statistics.
- Desktop/mobile Playwright suite: 72 passed. Checks cover navigation, forms, previews, imports, Settings/Profile and unauthenticated API/direct-action denials. Browser tests run against the unconfigured production preview; they do not establish authenticated hosted persistence.
- Browser testing identified an origin comparison using Next.js’s internal localhost URL rather than the incoming public Host. The helper now compares the exact incoming origin, rejects missing/foreign origins, and is covered by regression tests. No authorization assertion was weakened.
- Invitation acceptance checks the confirmed recipient and current pending invitation before changing a password. Wrong sessions, cancelled invitations and existing employee sessions are rejected; acceptance still rechecks all conditions in the database. Delivery readiness and provider outcomes are shown only to the verified Super Admin.
- No live Supabase migrations, access grants, account changes, customer writes, email sends or deployment occurred. The user reported no server secret key and supplied no invitation recipient. Live invitation delivery, real three-account CRUD/permission checks and Storage upload/download round trips remain connected-project checks in `docs/finishing-update.md`. Private-file tests use validation helpers and a local Storage schema stub.

## Default invitation-email callback fix — 29 October 2026

Supabase's default email link can return credentials in a browser-only URL fragment. `/auth/confirm` now renders the invitation client directly; code/token-hash verification remains server-side at `/auth/verify`. The client consumes and removes the fragment, waits for verified authentication before enabling acceptance, handles rejected/expired links, and processes a new fragment when a link is reopened on the same page. Existing pending-recipient, active-invitor and privilege checks remain unchanged. No custom SMTP, template editing, migration or new grants are required for this fix.

Lint, regenerated strict TypeScript, production build and all 103 unit/PostgreSQL tests passed. The full browser run passed the 72 existing checks and exposed missing same-page hash-change handling in both new callback tests. After fixing that handling, both desktop/mobile callback regressions passed in a focused rerun. Tests use synthetic URL fragments in the unconfigured preview, not real invitation credentials. Real Supabase session establishment and email acceptance must still be checked using a fresh delivered link on a reachable CRM address. No live email was sent or account modified here.

## Invitation resend and bulk module permissions — 29 October 2026

- Added verified-Super-Admin-only, same-origin PATCH invitation resend. Migration 0014 renews an existing nonaccepted invitation in place, preserves approved role/module/private-invoice selections, audits the action, blocks employee duplicates and enforces a database-backed one-minute resend interval. Failed/cancelled/expired invitations remain available in the invitation list for explicit retry. Archived employees are restored through the existing protected edit workflow, never automatically re-created or reactivated.
- Delivery handling now supports legacy registered-user errors with missing provider codes, uses the existing recovery onboarding fallback, and displays actionable provider-limit/recipient/network messages. No code claims that an accepted email-service request establishes inbox delivery; Supabase quotas, expired/consumed links and mail scanning remain external factors.
- Module controls apply explicit View/Edit/Full/Clear presets to all modules or a selected Justech/Al-Fikr/Workspace/directory group. Supplier Invoice authorization stays separate. Viewer selection clears write/delete flags. Setup preview permits exploring these controls with submission disabled; backend checks remain mandatory. Buttons wrap on small screens.
- Validation: 106 unit/PostgreSQL tests passed; all 76 desktop/mobile browser checks passed. After the final responsive CSS adjustment, both focused desktop/mobile bulk-permission tests passed again, including a horizontal-overflow assertion. Lint, strict TypeScript, production build and diff whitespace checks passed.
- New SQL tests check nonadministrator/anonymous denial, invitation renewal without duplicate records or privileges, cooldown, failed-send retry, accepted/employee refusal and unchanged private access. Provider mocks cover registered-auth fallback and rate limits. Browser checks cover group selection, private-finance exclusion, Viewer restrictions, preview save denial and forged resend rejection.
- No live Supabase changes, employee grants/restores, invitation sends or deployment occurred in the development workspace. Fresh hosted email acceptance and real-account permission checks remain required using the update guide.

## Forgotten-password recovery — 29 October 2026

- Added public `/forgot-password` and `/reset-password` pages, a login recovery link and default-email fragment forwarding from the home/login pages. Recovery requests use Supabase's public client and an explicit same-origin reset destination, with non-enumerating success notices and provider-limit feedback. Receiving pages verify the provider session, strip URL fragments and block invalid/expired links or unconfigured saves.
- Code/token-hash callbacks route active existing employees to password reset; the existing invite flow still requires its pending invitation. Password updates pass only `{password}` to the authenticated provider, never a caller-supplied user identifier/email. No service key, profile/role write, SQL migration or administrator recreation is involved. Sign-out is attempted after update; a sign-out failure does not falsely report that a completed password change failed.
- Lint, strict TypeScript, production build and whitespace checks passed. All 109 unit/PostgreSQL tests and all 78 desktop/mobile browser checks passed. New provider-mock coverage checks current-user verification, exact update arguments, bad/mismatched passwords, missing identities, rejected changes and sign-out outages. Browser coverage checks recovery navigation, default Site URL/login callback routing, expired links, fragment removal and preview write denial.
- Browser checks use the unconfigured preview; provider success/error tests are mocks, not live Auth operations. No real recovery email, password change, privilege modification or Supabase configuration change occurred here. Add the production `/reset-password` allowlist entry and complete one real recovery/login after Vercel deploys the update. See `docs/password-recovery.md`.
