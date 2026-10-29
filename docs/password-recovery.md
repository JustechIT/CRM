# Reset a forgotten CRM password

The CRM now includes dedicated password request/reset pages. This update does not recreate employees, change roles or permissions, require a secret-key change, or run any database migration.

## For the online Justech CRM

1. In Vercel, open **CRM → Deployments** and wait for the latest password-recovery update to show **Ready**. If your production branch is different, deploy the latest `codex/justech-crm-preview` revision to the project using its existing settings.
2. In **Supabase → Authentication → URL Configuration**, keep the existing Site URL and invitation redirect addresses. Add this exact Redirect URL and save:
   ```text
   https://crm-sooty-three-35.vercel.app/reset-password
   ```
3. Open:
   ```text
   https://crm-sooty-three-35.vercel.app/forgot-password
   ```
4. Enter **souhail@justech.tn** and select **Send recovery email**. Do not send a user invitation for an existing administrator.
5. Open only the newest recovery email link. It should show **Reset your password**, with New password and Confirm password fields. Use at least 12 characters and make both fields match.
6. Select **Save new password**, then sign in using the new password. Your account identifier, Super Admin designation, private permissions and CRM records stay unchanged. Do not delete or recreate your account.

The page supports Supabase's default recovery email; custom templates/SMTP are not needed just to process a delivered recovery link. Existing default links returning to the Site URL or login are forwarded to the reset page in the browser. Browser-only tokens are verified through Supabase, then removed from the URL. Code/token-hash callbacks still verify on the server. Active existing employees are sent to password reset; pending invitation recipients retain the separate invitation-acceptance checks.

Supabase sending limits and link expiration still apply. If the email service says to wait, do not repeatedly click Send. If a link is expired/already used, request a new recovery email. A success notice does not reveal whether an entered email exists and does not prove inbox delivery.

Never share passwords, complete email links, URL fragments or secret keys in chat/screenshots. The password form updates only the authenticated Supabase user's password using the public client; it cannot select a different user or grant CRM privileges. It attempts to sign out after a successful update so you can sign in with the new password. A provider sign-out failure does not undo a completed password update.

For local testing, allow the actual local origin followed by `/reset-password` instead. Localhost emails must be opened on the computer running the application. The publicly reachable production address is preferable for team testing.

## Validation limits

Automated tests cover password validation, provider-identity checks, exact password-only update arguments, rejected/unauthenticated operations, sign-out failure handling, default callback/error routing, token removal, safe preview blocking and desktop/mobile navigation. The development workspace cannot reset the real administrator's password or verify a hosted inbox. Complete one fresh recovery email and login test after the deployment is Ready.
