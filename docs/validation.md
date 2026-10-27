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
