# Workspace and Team Management update

The existing design, sidebar destinations, database records and other business modules are retained. No deployment is needed. This update adds Team Priorities, project-based IT management, separate Conferences/Events tabs, and verified Team administration.

## Install on your Windows computer

1. Stop the old server with Ctrl+C. Extract the updated source into a new folder and copy your working `.env.local` into the folder containing `package.json`.
2. In your existing Supabase project's SQL Editor, run these files once, separately, in order:
   - `supabase/migrations/0009_workspace.sql`
   - `supabase/migrations/0010_team_management.sql`
3. Run `docs/setup/team-super-admin.sql` in a new query. It checks that exactly one **confirmed Supabase authentication user** with an **active employee profile** exists for **souhail@justech.tn**, the corrected email you confirmed. It records that actual UUID as the designated account. It grants no privileges at this stage. Missing, inactive, unconfirmed or ambiguous accounts cause an error instead of a guess.
4. Run `npm ci`, then `npm run dev -- --webpack`. Keep the terminal open and visit the Local address it displays.
5. Sign in as **souhail@justech.tn**, open **Team Management**, and select **Activate Super Admin**. Activation checks the authenticated session UUID against the previously verified identity and rechecks the confirmed email and active profile. Another administrator, a typed email, signup metadata or a role checkbox cannot activate it.
6. Use Team Management to explicitly choose each colleague's role and module permissions. New Workspace permissions have no automatic role grants. Existing colleagues keep their old department permissions until you intentionally save an updated role/permission configuration for them.

Do not reset the database or rerun 0001–0008. The principal setup script is run once; do not rerun older invoice access bootstrap scripts after you start managing permissions, since those scripts restore their original grants.

No live database migrations, Super Admin assignment, invitations or account grants were performed from the development workspace.

## Enable invitations

Only invitation delivery needs a Supabase administrative credential. In your local `.env.local`, add:

```env
SUPABASE_SECRET_KEY=YOUR_SERVER_ONLY_SUPABASE_SECRET_KEY
```

Use the project's server-side Secret key (or legacy service-role key), **never** a `NEXT_PUBLIC` variable. Keep `.env.local` private and out of Git; do not send this key in chat. Restart the development server after changing the file. Other record management does not need this key.

In Supabase Authentication → URL Configuration, set the local Site URL and permit the callback addresses you use, normally:

- `http://localhost:3000/auth/confirm`
- `http://localhost:3000/invite`

Use the actual port if your server starts on another port. Supabase email delivery must be enabled for the intended recipients. If your project's default email provider restricts delivery, configure its supported email delivery settings before using invitations.

In Team Management, select **Add user**, enter the employee's email/name/department, choose Manager, Employee or Viewer, and explicitly select module access. For customer/institution references, also enable Accounts & Contacts read access. Supplier Invoices have a separate unchecked-by-default authorization.

The recipient opens the email, verifies the authentication session, sets a password of at least 12 characters, and accepts the invitation. The database uses the administrator-stored invitation permissions, never recipient-supplied role metadata. Pending invitations expire after seven days, can be cancelled, and can be accepted only once by the matching confirmed account. Failed email requests cancel the reservation and do not grant employee privileges. Existing authentication identities without employee profiles can receive a recovery link for the same approved onboarding workflow.

## What the sections do

### Team Priorities

The six requested columns are preserved. Priorities reuse the existing `activities` store with an explicit Workspace scope. Existing Operations tasks and unrelated activities are not copied or changed. Employee, department, priority and status filters, **My Priorities**, search, date filters, sorting and pagination are available. Overdue incomplete tasks are highlighted. Active employees are selected from the existing directory.

### IT & Platform Management

The Projects view uses the seven requested columns and shows each project's real task-completion percentage. Opening a project displays its details, progress and its own Tasks / Issues table. Add/edit forms retain the parent project; filters and pagination remain scoped to that project. Tasks support Type, Assigned To, Priority and Status dropdowns. Progress is completed tasks divided by total tasks, or zero for a project with no tasks. Projects with linked tasks must have those tasks removed or reassigned before deletion, preserving relationships.

### Conferences & Events

Conferences and Events are separate tables/tabs under the existing sidebar destination. Both support CRUD, search, filtering, sorting and pagination. Conferences link existing institutions without creating duplicate organization/contact rows. Their requested nine table columns remain unchanged; Responsible and Follow-up Date are additional form/detail fields needed for employee assignment and overdue highlighting. Events use the six requested columns and existing employee assignments. Upcoming events within 30 days and overdue non-closed conference follow-ups are highlighted. Calendar comparisons use UTC dates consistently with the existing modules.

### Team Management and access rules

The requested six user columns are implemented with search, department/role/status filters, sorting and pagination. Only the verified designated Super Admin can invite, edit users, change roles or module permissions, activate/deactivate accounts, remove/restore users and manage restricted access.

- **Super Admin:** the single designated verified identity; full business-module access and protected user/permission management. Supplier Invoices still require explicit separate authorization. The account cannot be removed, demoted, deactivated or given a different identity through these management APIs.
- **Manager:** read/create/edit/delete only for the modules explicitly enabled by Super Admin; delete is a separate checkbox.
- **Employee:** explicitly enabled modules; writes/deletes are restricted to assigned work, or their own records where no assignee field exists.
- **Viewer:** read-only enabled modules. Even explicitly authorized Supplier Invoice Viewers cannot alter records, upload files or delete files.

Ordinary users cannot edit their roles, module grants or private access. Unauthorized modules, private links and pins are omitted from the sidebar. Server checks, protected database functions, RLS and private Storage policies enforce the same restrictions independently of navigation. New grants are not derived from a typed email or automatically inherited from a legacy Admin role.

Email remains the authentication account identifier and is displayed read-only when editing an existing employee. Changing an authentication identity is handled through your trusted Supabase account administration rather than silently changing the verified identifier in a CRM profile form.

Deactivation immediately stops CRM access, including existing sessions' database permissions. Removal archives/deactivates the employee instead of destroying authentication/ownership relationships or business history. Use the **Removed / Archived** status filter to find and restore an archived employee with explicitly selected permissions. The authentication identity remains retained; this is CRM access removal, not destructive deletion of linked historical records.

## Testing and limits

Automated tests apply the actual SQL migrations to an isolated PostgreSQL instance and cover persistence, parent/child relationships, computed progress, legacy permission preservation, verified activation, protected Super Admin identity, assigned-record limits, invitations, cancelled/expired/unverified access boundaries, deactivation, removal and private invoice/storage restrictions. Browser tests exercise desktop/mobile tables, forms, filters, navigation and unauthorized direct API/action attempts.

The development environment has no authenticated connection to your hosted Supabase project or mail provider. Actual email delivery, hosted login/activation, authenticated browser CRUD and file-service round trips must be checked in your connected project after setup. No fake business records or hardcoded business statistics are included.
