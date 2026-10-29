"use client";
import { useActionState, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { acceptInvitation } from "@/app/invite/actions";
export function AcceptInvite({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(acceptInvitation, {
    error: "",
  });
  const [tokenError, setTokenError] = useState("");
  const [verifying, setVerifying] = useState(true);
  useEffect(() => {
    let active = true;
    async function verify() {
      const h = new URLSearchParams(location.hash.slice(1));
      const access_token = h.get("access_token");
      const refresh_token = h.get("refresh_token");
      // Remove credentials from browser history even if verification fails.
      if (location.hash)
        history.replaceState(null, "", location.pathname + location.search);
      if (
        h.has("error") ||
        h.has("error_code") ||
        new URLSearchParams(location.search).has("error")
      ) {
        if (active)
          setTokenError(
            "This invitation link has expired or was already used. Ask the administrator for a fresh invitation.",
          );
        return;
      }
      if (!configured) return;
      const db = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        { auth: { detectSessionInUrl: false } },
      );
      if (access_token || refresh_token) {
        if (!access_token || !refresh_token)
          throw new Error("Incomplete invitation");
        const result = await db.auth.setSession({
          access_token,
          refresh_token,
        });
        if (result.error) throw result.error;
      }
      const user = await db.auth.getUser();
      if (user.error || !user.data.user) {
        if (active)
          setTokenError(
            "No verified invitation was found. Open a fresh invitation email link on the computer running the CRM.",
          );
      }
    }
    // Defer until after React's development effect replay to consume tokens once.
    const start = () => {
      setVerifying(true);
      setTokenError("");
      void verify()
        .catch(() => {
          if (active)
            setTokenError(
              "Invitation link could not be verified. Ask the administrator for a fresh invitation.",
            );
        })
        .finally(() => {
          if (active) setVerifying(false);
        });
    };
    const timer = setTimeout(start, 0);
    window.addEventListener("hashchange", start);
    return () => {
      window.removeEventListener("hashchange", start);
      active = false;
      clearTimeout(timer);
    };
  }, [configured]);
  return (
    <form action={action} className="sales-form">
      {(state.error || tokenError) && (
        <p role="alert" className="form-error">
          {tokenError || state.error}
        </p>
      )}
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
        disabled={pending || !configured || verifying || Boolean(tokenError)}
      >
        {verifying
          ? "Verifying invitation…"
          : pending
            ? "Setting up…"
            : "Accept invitation"}
      </button>
    </form>
  );
}
