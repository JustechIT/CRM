"use client";
import { useActionState } from "react";
import { login } from "@/app/login/actions";
export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(login, { error: "" });
  return (
    <form action={action}>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      <div className="form-grid">
        <label className="full">
          Work email
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            placeholder="you@company.com"
            disabled={!configured}
          />
        </label>
        <label className="full">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            disabled={!configured}
          />
        </label>
      </div>
      <button
        className="button primary"
        style={{ width: "100%", marginTop: 25 }}
        disabled={!configured || pending}
      >
        {pending ? "Signing in…" : "Sign in to your workspace"}
      </button>
      <p className="muted">
        Invitation-only access. Need help signing in? Contact your workspace
        administrator.
      </p>
    </form>
  );
}
