import { ResetPassword } from "@/components/auth/password-recovery";
import { isConfigured } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export default function Reset() {
  return (
    <main className="standalone">
      <h1>Reset your password</h1>
      <p>Choose a new password with at least 12 characters.</p>
      <ResetPassword configured={isConfigured()} />
    </main>
  );
}
