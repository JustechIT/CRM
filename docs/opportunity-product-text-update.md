# Product text in Sales opportunities

Product is now a normal required text field in both **Justech Sales → Opportunities** and **Al-Fikr Sales → Opportunities**. Enter the product/package name directly. Other sections keep their existing Product selections, and the design is unchanged.

## Activate on the online CRM

1. Open **supabase/migrations/0016_opportunity_product_text.sql**. Copy all its SQL into **Supabase → SQL Editor** and click **Run** once. Earlier migrations through 0015 must already have succeeded. Do not rerun old files, reset the database or delete records.
2. In **Vercel → CRM → Deployments**, wait for the latest Product-text update on `codex/justech-crm-preview` to show **Ready**.
3. Open **https://crm-sooty-three-35.vercel.app**, refresh with **Ctrl+Shift+R**, then open either Sales module's Opportunities Add/Edit form.

No environment variable, secret key, hosting or authentication setting needs changing.

## Existing records

The migration adds a short text column to each existing opportunity table without rewriting existing rows or creating tables/catalog products. Existing opportunity IDs, owners, timestamps, revisions and product links remain stored. Old linked product names remain visible as fallbacks. Editing Product changes the opportunity's displayed text, not the linked catalog item's name. New opportunities can use typed text without a catalog link. Names are trimmed, required and limited to 250 characters.

List/detail/form display, search, Product sorting and Justech CSV export use the typed value. Existing list-view column order/types and catalog labels remain available for compatibility. Product selection, business/category checks and required relationships in subscriptions, payments, quotations/Caution and other modules remain as before. Only the Justech opportunity product trigger accepts the now-optional link; nonempty supplied links still undergo business/FK checks. Module permissions, ownership/assignment rules, Viewer restrictions and private Finance authorization are unchanged.

## Quick check

Open an old opportunity and confirm its product still displays. Add one opportunity with a typed product, refresh, search by that text, edit it and refresh again. Confirm Customer/Product still use selection in subscriptions. Check that no duplicate product was added to the catalog. Use only accounts with the appropriate write permission.

The development workspace does not apply SQL to your hosted database or create real opportunity records. Automated PostgreSQL tests use synthetic records, and browser checks use the unconfigured preview; complete this brief connected-project check after applying the SQL and deployment.
