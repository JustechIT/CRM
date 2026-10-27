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
