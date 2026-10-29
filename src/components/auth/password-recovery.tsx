"use client";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { changeRecoveredPassword } from "@/lib/team/password-recovery";

function browser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { detectSessionInUrl: false } },
  );
}

// Dashboard-issued recovery emails can return to the configured Site URL/login.
export function RecoveryRedirect() {
  useEffect(() => {
    function check() {
      if (!["/", "/login"].includes(location.pathname)) return;
      const hash = new URLSearchParams(location.hash.slice(1));
      if (hash.get("type") === "recovery" || hash.has("error_code"))
        location.replace(`/reset-password${location.hash}`);
    }
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);
  return null;
}

export function ForgotPassword({ configured }: { configured: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <form
      className="sales-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!configured || busy) return;
        const email = String(
          new FormData(event.currentTarget).get("email") ?? "",
        ).trim();
        setBusy(true);
        setError("");
        setSent(false);
        try {
          // A direct recovery link works even when opened on a different browser.
          // This client never stores credentials; the receiving page creates SSR cookies.
          const client = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            {
              auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
                flowType: "implicit",
              },
            },
          );
          const result = await client.auth.resetPasswordForEmail(email, {
            redirectTo: `${location.origin}/reset-password`,
          });
          if (result.error)
            throw new Error(
              result.error.status === 429
                ? "Supabase has temporarily limited recovery emails. Wait before trying again."
                : "The recovery email could not be requested. Check your connection or ask your administrator to check Supabase email settings.",
            );
          setSent(true);
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "The request failed. Please try again later.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {sent && (
        <p role="status" className="success">
          If this address has an account, you will receive a recovery email.
          Open only the newest link. Check spam too.
        </p>
      )}
      <label>
        Email
        <input
          type="email"
          name="email"
          required
          maxLength={254}
          autoComplete="email"
        />
      </label>
      <button className="button primary" disabled={!configured || busy}>
        {busy ? "Requesting…" : "Send recovery email"}
      </button>
      {!configured && (
        <p className="notice">
          Connect Supabase before requesting a recovery email.
        </p>
      )}
      <Link className="text-link" href="/login">
        Back to sign in
      </Link>
    </form>
  );
}

export function ResetPassword({ configured }: { configured: boolean }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let active = true;
    async function verify() {
      const hash = new URLSearchParams(location.hash.slice(1));
      if (location.hash)
        history.replaceState(null, "", location.pathname + location.search);
      if (
        hash.has("error") ||
        hash.has("error_code") ||
        new URLSearchParams(location.search).has("error")
      )
        throw Error(
          "This recovery link has expired or was already used. Request a new recovery email below.",
        );
      if (!configured)
        throw Error(
          "Supabase is not configured. Password changes are disabled.",
        );
      const client = browser();
      const access_token = hash.get("access_token"),
        refresh_token = hash.get("refresh_token");
      if (access_token || refresh_token) {
        if (!access_token || !refresh_token || hash.get("type") !== "recovery")
          throw Error("Open a valid password recovery link from your email.");
        const session = await client.auth.setSession({
          access_token,
          refresh_token,
        });
        if (session.error)
          throw Error(
            "This recovery link could not be verified. Request a new recovery email below.",
          );
      }
      const user = await client.auth.getUser();
      if (user.error || !user.data.user)
        throw Error(
          "Open your recovery email link first, or request a new one below.",
        );
      if (active) setReady(true);
    }
    const start = () => {
      setReady(false);
      setError("");
      void verify().catch((e) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "The recovery link could not be verified.",
          );
      });
    };
    const timer = setTimeout(start, 0);
    window.addEventListener("hashchange", start);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener("hashchange", start);
    };
  }, [configured]);
  if (done)
    return (
      <div>
        <p className="success" role="status">
          Your password has been changed. Your account, records and permissions
          are unchanged.
        </p>
        <Link href="/login" className="button primary">
          Sign in with your new password
        </Link>
      </div>
    );
  return (
    <form
      className="sales-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!ready || busy || !configured) return;
        const form = new FormData(event.currentTarget);
        const password = String(form.get("password") ?? "");
        if (password.length < 12 || password !== form.get("confirm")) {
          setError("Use at least 12 characters and make both passwords match.");
          return;
        }
        setBusy(true);
        setError("");
        try {
          const client = browser();
          await changeRecoveredPassword(
            client.auth,
            password,
            String(form.get("confirm") ?? ""),
          );
          setDone(true);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Password could not be changed.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {!ready && !error && <p role="status">Verifying your recovery link…</p>}
      <label>
        New password
        <input
          name="password"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
        />
      </label>
      <label>
        Confirm password
        <input
          name="confirm"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
        />
      </label>
      <button
        className="button primary"
        disabled={!ready || busy || !configured}
      >
        {busy ? "Saving…" : "Save new password"}
      </button>
      <Link className="text-link" href="/forgot-password">
        Request a new recovery email
      </Link>
    </form>
  );
}
