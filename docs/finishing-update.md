# Update guide: Al-Fikr, import, Settings, Profile and notifications

This is a local development update. It does not deploy the website or change your live database automatically. Existing Justech modules, records, verified administrator identity and Supplier Invoice allowlist are preserved.

## See the changes on Windows

1. Stop your old CRM terminal with **Ctrl+C**.
2. Download and extract the new source. Copy your existing **`.env.local`** into the new folder containing **`package.json`**.
3. In your existing **Supabase → SQL Editor**, run these files separately, once, in order:
   - `supabase/migrations/0011_alfikr.sql`
   - `supabase/migrations/0012_personal_dashboard_notifications.sql`
   - `supabase/migrations/0013_directory_import.sql`
4. Do **not** rerun 0001–0010, reset the database, or rerun previous account-access bootstrap scripts.
5. Open Command Prompt in the new project folder. Run **`npm ci`**, wait for it to finish, then run **`npm run dev -- --webpack`**.
6. Open the Local address shown in the terminal and sign in. Keep the terminal open.

The existing verified Super Admin can access Al-Fikr. Other employees need explicitly enabled Al-Fikr module permissions in Team Management. Existing Supplier Invoice permissions are not automatically expanded or removed.

## Turn on real invitation emails

You reported that the invitation key is not set. No live test email has been sent, and no recipient address was provided for a real test.

1. Sign in as **souhail@justech.tn** and open **Settings → User invitations**.
2. Open your local CRM `.env.local` with Notepad. Keep its existing two public Supabase lines.
3. In **Supabase → Settings → API Keys**, copy your project's **server-side Secret key** (or legacy service-role key).
4. Add a new line in `.env.local`:
   ```env
   SUPABASE_SECRET_KEY=YOUR_PRIVATE_SERVER_KEY
   ```
5. Save, stop the server with Ctrl+C, and restart it. Never paste this key in chat, use a `NEXT_PUBLIC` name for it, or commit `.env.local`.
6. In **Supabase Authentication → URL Configuration**, allow your actual CRM address followed by **`/auth/confirm`** and **`/invite`**. For the normal local workflow these are `http://localhost:3000/auth/confirm` and `http://localhost:3000/invite`. Use your actual host/port if different. A local test recipient must open the link on a computer where that CRM address is reachable.
7. Select **Check invitation setup** in Settings. It verifies the key using a read-only Auth API request and never displays the key.
8. In **Team Management → Add user**, invite a new recipient who is not already an employee. Confirm the email arrives. Sign out of the CRM or use a private browser window, then open its link, choose a password and accept the invitation. The app verifies a valid pending invitation before changing any password.

A valid key does not prove inbox delivery. Supabase must allow emails to that recipient; default provider restrictions, email delivery settings, spam filtering and redirect allowlists can still prevent receipt. Settings shows recent invitation outcomes. “Accepted by email service” means the provider accepted the request, not that the recipient read or received it. Failed sends are tracked and pending reservations are cancelled. Existing authentication identities without employee profiles can use a recovery-link onboarding fallback.

The key is only used after verified Super Admin checks. It is not used for ordinary records, profiles, imports or private files. No hosting/deployment credentials are needed.

## What changed

### Al-Fikr

Seven tables follow the Excel headers exactly:

- Sales: Opportunities, Quotations, Subscriptions.
- Marketing: Campaigns, Content Calendar.
- Content Management: Content Catalog, Content Workflow.

Each table supports Add, View, Edit, Delete, search, status/date filters, sorting and 25-row pagination. References use real institutions, products and employees. Workflow entries link existing catalog items. Linked catalog items cannot be deleted before their workflow records are removed or reassigned.

For Al-Fikr Sales, institutions and products must be classified **Al-Fikr** or **Both**. Existing Justech-only records are not silently reclassified. Use the shared directory to add/classify institutions and **Manage products / packages** to create an Al-Fikr package.

Each overview calculates its six workbook indicators from accessible database records. Subscription Currency is an additional form/detail field because the workbook's Annual Value has no currency column. Enter it when entering Annual Value. Annual totals use the latest non-cancelled confirmed/active/expired term per institution/product overlapping the selected year. TND, EUR and USD (and other supplied codes) stay separate; values are not converted or added across currencies. Missing values display zero. No business data is seeded.

### Excel / CSV import

Open **Accounts & Contacts → Import**. Import is for accounts/institutions and contacts; other module tables are not imported by this workflow.

1. Download the blank template if useful and fill it with your own records. Use the first row for column names.
2. Select UTF-8 CSV or XLSX, choose the worksheet if necessary, and read the file.
3. Match each field to a source column. Account type/status/business defaults are visible and editable.
4. Select **Check & preview**. Resolve all errors. Download the validation report if needed.
5. Confirm the review checkbox and select **Confirm import**.

Limits: 5 MB file, 500 data rows, 40 columns, and 20 MB advertised expanded XLSX content. Password-encrypted or overly complex workbooks are rejected. Formats with macros are not accepted. Non-UTF-8 CSV files are rejected with conversion instructions instead of silently corrupting accented names. Formulas are not executed. Phone numbers and identifiers should be text in Excel to preserve leading zeroes.

Account duplicates match normalized name, country and city. Contacts match institution plus email, or first/last name when no email is supplied. Matching is conservative, with no fuzzy merge or silent overwrite. Contact institutions must already exist; exact names must be unambiguous, otherwise use the institution's UUID. Import institutions first.

The server revalidates at confirmation, resolves references and checks duplicates in bulk. The final database function serializes directory writes, skips duplicates, writes atomically and records the real acting employee as owner. A failed batch rolls back. Retrying the same request does not create another import. Source files are parsed in memory and are not retained in Storage; job summaries contain counts and IDs, not raw contact files.

### Home dashboard and notifications

Home now displays actual accessible open opportunities, Caution records, expiring subscriptions and open work counts, plus your open priorities, upcoming events and permitted recent audit activity. Unauthorized metrics stay unavailable rather than inventing zero totals. Private Supplier Invoice data and private user-management audit entries are excluded from the Home activity feed.

The bell shows up to 50 current accessible assignments/reminders: team priorities, Operations/IT tasks, owned Operations follow-ups, assigned conference follow-ups and assigned Justech/Al-Fikr publications. It refreshes every minute. Read state is personal and persistent; changed records use a new revision key. Turning in-app notifications off in Settings hides the feed. This is an in-app feature, not a scheduled email-reminder service.

### Settings and My Profile

Settings saves light/dark appearance, sidebar collapse and in-app notifications for your account. Header appearance/pinning controls also persist to the database, and existing browser choices are retained on first synchronization. Pins remain filtered by module access.

My Profile displays your actual email, departments, roles and status. Only the verified Super Admin can update a display name; other members contact the administrator for user-information changes. Each active employee can change their own password after confirming the current password. You cannot change identity, activate an account, assign departments/roles or grant permissions through this screen. Super Admin verification remains bound to the real authentication UUID and confirmed email, not a display name.

The update also fixes same-origin checks for valid incoming hostnames/IPs such as `127.0.0.1`, local network addresses and the configured public host. Other-origin mutations remain rejected; callbacks retain the incoming public host instead of being rewritten to internal localhost.

## Final checks with Souhail, BJ and Ahmed

The development workspace cannot sign in to your Windows browser or your three live accounts. Use this short acceptance check after applying the update:

- **Souhail:** open Team Management and Settings; check invitation setup and send one approved test invitation once the key is configured.
- **Each account:** open its authorized modules. Where write access is enabled, save a real record, refresh, edit and refresh again. A Viewer must be blocked from saving/editing.
- **Each explicitly authorized finance account:** open Supplier Invoices and upload/download a PDF, PNG or JPEG. Verify the downloaded file opens. A Viewer is read-only, and an Employee can change their own invoices; existing legacy access remains unchanged until Super Admin explicitly changes their role.
- **Restricted account:** confirm hidden modules and Supplier Invoices cannot be opened by entering a direct URL. Do not revoke the designated administrator's own access as a test.
- **Profile/settings:** change a preference and refresh; as Super Admin, edit your display name and confirm that role/permissions stay unchanged. Other members must see administrator-managed user information.
- **Imports:** preview a small file first, including an existing record, and verify duplicates are skipped and errors block confirmation.
- **Notifications/dashboard:** use actual assigned work and confirm counts/read states update without exposing another person's notifications or private invoices.

Automated tests exercise the actual SQL and simulated roles, parser fixtures, provider error/success handling, file signatures, and desktop/mobile preview/API-denial flows. Hosted authenticated browser operations, actual Storage byte round trips and real email delivery remain live checks; they have not been claimed as completed here.
