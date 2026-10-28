"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
export function PreferencesForm({ enabled }: { enabled: boolean }) {
  const [theme, setTheme] = useState("light"),
    [collapsed, setCollapsed] = useState(false),
    [notify, setNotify] = useState(true),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    fetch("/api/preferences", { signal: abort.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setStatus(d.error);
        else {
          setTheme(
            d.exists
              ? d.preferences.theme
              : localStorage.getItem("justech.theme") === "dark"
                ? "dark"
                : d.preferences.theme,
          );
          setCollapsed(
            d.exists
              ? d.preferences.sidebar_collapsed
              : localStorage.getItem("justech.sidebar") === "collapsed",
          );
          setNotify(d.preferences.notifications_enabled);
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) setStatus("Settings could not be loaded.");
      });
    return () => abort.abort();
  }, [enabled]);
  return (
    <form
      className="sales-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setStatus("");
        try {
          const r = await fetch("/api/preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              theme,
              sidebar_collapsed: collapsed,
              notifications_enabled: notify,
            }),
          });
          const d = await r.json();
          if (!r.ok) throw Error(d.error);
          localStorage.setItem("justech.theme", theme);
          localStorage.setItem(
            "justech.sidebar",
            collapsed ? "collapsed" : "expanded",
          );
          window.dispatchEvent(new Event("preferences"));
          window.dispatchEvent(new Event("notifications-preferences"));
          setStatus("Settings saved.");
        } catch (e) {
          setStatus(e instanceof Error ? e.message : "Save failed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Theme
        <select value={theme} onChange={(e) => setTheme(e.target.value)}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={collapsed}
          onChange={(e) => setCollapsed(e.target.checked)}
        />
        Collapse sidebar
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={notify}
          onChange={(e) => setNotify(e.target.checked)}
        />
        Show in-app notifications
      </label>
      {status && <p role="status">{status}</p>}
      <button className="button primary" disabled={!enabled || busy}>
        {busy ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
export function ProfileForm({
  name,
  enabled,
}: {
  name: string;
  enabled: boolean;
}) {
  const router = useRouter(),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="sales-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const f = new FormData(e.currentTarget),
            r = await fetch("/api/profile", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ full_name: f.get("full_name") }),
            });
          const d = await r.json();
          if (!r.ok) throw Error(d.error);
          setStatus("Profile saved.");
          router.refresh();
        } catch (e) {
          setStatus(e instanceof Error ? e.message : "Save failed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Full name
        <input name="full_name" defaultValue={name} maxLength={200} required />
      </label>
      {status && <p role="status">{status}</p>}
      <button className="button primary" disabled={!enabled || busy}>
        Save profile
      </button>
    </form>
  );
}
export function PasswordForm({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="sales-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget,
          f = new FormData(form);
        setBusy(true);
        setStatus("");
        try {
          const r = await fetch("/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              current: f.get("current"),
              password: f.get("password"),
              confirm: f.get("confirm"),
            }),
          });
          const d = await r.json();
          if (!r.ok) throw Error(d.error);
          setStatus("Password changed.");
          form.reset();
        } catch (e) {
          setStatus(
            e instanceof Error ? e.message : "Password could not be changed.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Current password
        <input
          name="current"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <label>
        New password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </label>
      <label>
        Confirm new password
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </label>
      {status && <p role="status">{status}</p>}
      <button className="button" disabled={!enabled || busy}>
        Change password
      </button>
    </form>
  );
}
export function InvitationCheck() {
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <button
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/team/readiness");
            const d = await r.json();
            if (!r.ok) throw Error(d.error);
            setStatus(
              !d.key_set
                ? "The server invitation key is missing. Follow the steps below."
                : !d.key_valid
                  ? "The server key could not be verified. Check that it belongs to this Supabase project."
                  : "The server key works. Send an invitation in Team Management, then check the recipient’s inbox to confirm delivery.",
            );
          } catch (e) {
            setStatus(e instanceof Error ? e.message : "Setup check failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Checking…" : "Check invitation setup"}
      </button>
      {status && <p role="status">{status}</p>}
    </>
  );
}
