import { ForgotPassword } from "@/components/auth/password-recovery";
import { isConfigured } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export default function Forgot() {
  return (
    <main className="standalone">
      <h1>Forgot your password?</h1>
      <p>Enter your CRM email to request a secure password recovery link.</p>
      <ForgotPassword configured={isConfigured()} />
    </main>
  );
}
