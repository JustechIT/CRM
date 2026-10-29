# Small readability and opportunity Organization update

This update keeps the CRM's current layout, sidebar, routes, authentication, status choices, permissions and existing business workflows. It contains only small CSS readability changes plus the requested free-text Organization field in Justech and Al-Fikr opportunities.

## Apply to your existing online CRM

1. In **Supabase → SQL Editor**, run the contents of **supabase/migrations/0015_opportunity_organization_text.sql** once. Earlier migrations through 0014 must already be applied. Do not rerun older migrations, reset the database or delete records.
2. In **Vercel → CRM → Deployments**, wait for the latest opportunity/readability update on `codex/justech-crm-preview` to show **Ready**. Keep your existing environment variables and Supabase project.
3. Refresh **https://crm-sooty-three-35.vercel.app**. Open **Justech Sales → Opportunities → Add**, then **Al-Fikr Sales → Opportunities → Add**. Organization is now a normal text box: type a name directly, without choosing or creating a directory record.

The one new SQL file is needed to store organization text. The design changes themselves require no database changes. No secret/key change, new hosting setup, new table or automatic access grant is involved.

## What stays intact

- Existing opportunity IDs, owners, timestamps, revisions, products and saved directory references remain stored. The migration does not bulk-update or rewrite existing records. Old linked organization names remain visible through a fallback in the list views and forms.
- Editing an opportunity's Organization saves its display text; it does not rename the corresponding directory institution or silently create a new institution. Existing hidden account links remain stored.
- New opportunities can use typed organization text without a directory link. Product selection, validation, dates, values, stages, search, organization sorting, CSV export and CRUD/version checks retain their existing paths. Organization is required and limited to 250 characters.
- Customer fields in subscriptions, payments, Caution and all other sections stay linked as before. Their database constraints, relationships and access rules are unchanged.
- Only the two Justech opportunity policies' mandatory-directory check is adjusted to allow the now-optional link. Module permissions, creator checks, assigned/owned-record restrictions, Viewer denial and anonymous denial stay enforced.

## Small visual improvements

- Slightly larger navigation labels, buttons, form inputs and table text.
- Stronger muted-text, table-heading and border contrast in light and dark themes.
- Clearer form help and visible keyboard focus.
- Existing colors, layout, responsive navigation, sticky table columns, controls and actions remain in place. No dashboard redesign, new workflow, animation or feature is added.

## Quick review

Create or edit one authorized opportunity in each Sales module using a typed organization name; refresh, search by that name and sort by Organization. Check an old opportunity still displays its organization. Confirm subscription Customer and Product are still selected from existing records. Check mobile layout and light/dark themes. The code workspace does not change your hosted database or create real opportunities automatically.
