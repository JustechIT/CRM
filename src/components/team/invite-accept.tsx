"use client";
import { useActionState, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { acceptInvitation } from "@/app/invite/actions";
export function AcceptInvite({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(acceptInvitation, {
    error: "",
  });
  const [tokenError, setTokenError] = useState("");
  useEffect(() => {
    if (!configured) return;
    const h = new URLSearchParams(location.hash.slice(1));
    const access_token = h.get("access_token"),
      refresh_token = h.get("refresh_token");
    if (access_token && refresh_token) {
      const db = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      );
      db.auth.setSession({ access_token, refresh_token }).then((r) => {
        if (r.error)
          setTokenError(
            "Invitation link could not be verified. Request a new invitation.",
          );
        else history.replaceState(null, "", "/invite");
      });
    }
  }, [configured]);
  return (
    <form action={action} className="sales-form">
      {(state.error || tokenError) && (
        <p role="alert" className="form-error">
          {state.error || tokenError}
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
      <button className="button primary" disabled={pending || !configured}>
        {pending ? "Setting up…" : "Accept invitation"}
      </button>
    </form>
  );
}
