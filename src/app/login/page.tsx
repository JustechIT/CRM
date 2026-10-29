import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { isConfigured } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export default function Login() {
  const configured = isConfigured();
  return (
    <main className="standalone">
      <Link href="/" className="brand">
        <span className="brand-symbol">j</span>justech
      </Link>
      <div className="eyebrow">Your internal workspace</div>
      <h1>Welcome back.</h1>
      <p>Good relationships start with a connected team.</p>
      {!configured && (
        <div className="notice">
          <p>
            Supabase is not configured. Sign-in is disabled.{" "}
            <Link href="/settings" className="text-link">
              Read the setup guide
            </Link>{" "}
            or{" "}
            <Link href="/" className="text-link">
              explore the empty workspace
            </Link>
            .
          </p>
        </div>
      )}
      <LoginForm configured={configured} />
      <Link href="/forgot-password" className="text-link">
        Forgot your password?
      </Link>
    </main>
  );
}
