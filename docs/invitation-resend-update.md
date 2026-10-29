# Invitations and easier permissions: update steps

This update does not deploy the CRM, delete users, change existing permissions or send emails automatically.

1. Stop the old CRM terminal with **Ctrl+C**. Download and extract the updated project.
2. Copy the existing **.env.local** into the new folder beside **package.json**. Keep your private key private.
3. Open **supabase/migrations/0014_invitation_resend.sql** in Notepad. Copy all its text into your existing **Supabase → SQL Editor** and click **Run** once. Earlier migrations 0001–0013 must already be applied; do not rerun them or reset your database.
4. In the new project folder, run **npm ci**, then **npm run dev -- --webpack**. Open the Local address printed in the terminal.
5. Sign in as the verified Super Admin and open **Team Management → Invitations**. Click **Resend invitation** on the existing entry. Failed, cancelled and expired invitations stay visible for retry. Resend retains the same invitation and approved permissions, renews its seven-day CRM expiry, and requires a one-minute wait between attempts. Supabase's separate email limits and link expiry still apply.
6. Open only the newest email, in a private window. A localhost link must be opened on the computer running the CRM. Do not repeatedly reuse an old link: Supabase links are single-use and can expire. A mail security scanner can also consume a link; resending does not bypass Supabase verification or email-provider limits.

If the person was already a CRM employee, removal archived the account to preserve business history. Choose **Account Status → Removed / Archived → Apply filters**, click their name, select **Active account**, review the role and permissions, then **Save user**. They keep their existing login. Do not create another account or delete records from Supabase. This update does not silently restore anybody.

If email sending is limited, the new error explains that and asks you to wait. Longer provider quotas, blocked recipients, SMTP failures or redirect restrictions require checking Supabase Authentication logs/settings. The application cannot remove those service limits. A successful send means the email provider accepted the request, not that delivery or login has been verified.

## Easier module permissions

In Add/Edit user, choose **Apply permissions to**: All modules, Justech, Al-Fikr, Workspace or Accounts & Contacts. Then choose:

- **View all**: read access for that group.
- **View & edit all**: read/create/edit, without deletion.
- **Full access**: read/create/edit/delete.
- **Clear access**: remove access for that group.

Review individual checkboxes if needed. Changes apply only after **Save user** or invitation acceptance. Viewer roles remain read-only. Switching to Viewer clears write/delete selections; switching back does not automatically restore them. Employee ownership/assignment limits still apply. Supplier Invoices are excluded from every group/preset and still require the separate explicit checkbox. No existing user is granted new access automatically.

## Checks still needed in your connected project

Use one pending test invitation: resend, confirm the newest email arrives, accept it on a reachable CRM address, and verify exactly the selected modules. Try resending again immediately: it must be blocked. Check an expired/cancelled invitation can be renewed, and an existing employee is edited/restored instead. Verify BJ, Ahmed and ordinary users cannot invoke the resend endpoint. Test bulk permissions on a non-administrator account, refresh after saving, and confirm Supplier Invoices stay denied without explicit authorization.

Automated checks use isolated PostgreSQL, synthetic identities/provider outcomes and the browser's unconfigured preview. They do not send real emails, alter your hosted Supabase project or establish real invitation delivery/login.
