"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  moduleChoices,
  roleChoices,
  type TeamUser,
  type ModuleGrant,
} from "@/lib/team/config";
import {
  applyPermissionPreset,
  permissionGroups,
  type PermissionPreset,
} from "@/lib/team/permissions";
export function UserForm({
  user,
  enabled = true,
}: {
  user?: TeamUser;
  enabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState(
    user?.role_id === "legacy" ? "" : (user?.role_id ?? "employee"),
  );
  const [permissionGroup, setPermissionGroup] = useState("all");
  const [grants, setGrants] = useState<ModuleGrant[]>(user?.modules ?? []);
  const change = (
    module: string,
    key: "read" | "write" | "delete",
    checked: boolean,
  ) =>
    setGrants((old) => {
      const prev = old.find((m) => m.module === module) ?? {
        module,
        read: false,
        write: false,
        delete: false,
      };
      const next = { ...prev, [key]: checked };
      if (key === "read" && !checked) {
        next.write = false;
        next.delete = false;
      }
      if (key !== "read" && checked) next.read = true;
      return [...old.filter((m) => m.module !== module), next];
    });
  return (
    <form
      className="sales-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!enabled) return;
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        try {
          const r = await fetch(
            user ? "/api/team/users" : "/api/team/invitations",
            {
              method: user ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: user?.id,
                full_name: f.get("full_name"),
                ...(!user ? { email: f.get("email") } : {}),
                department: f.get("department"),
                role,
                active: f.get("active") === "on",
                supplier_access: f.get("supplier") === "on",
                modules: grants.map((m) => ({
                  ...m,
                  write: role !== "viewer" && m.write,
                  delete: role !== "viewer" && m.delete,
                })),
              }),
            },
          );
          const d = await r.json();
          if (!r.ok) throw Error(d.error);
          router.push(user ? "/team?saved=1" : "/team?invited=1");
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "The request failed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {user?.role_id === "legacy" && (
        <p className="notice">
          This employee uses existing department roles ({user.legacy_roles}).
          Saving intentionally replaces those roles with the role and module
          permissions selected below. Choose all needed modules before saving.
        </p>
      )}
      <div className="form-grid">
        <label>
          Full Name
          <input
            name="full_name"
            defaultValue={user?.full_name}
            required
            maxLength={200}
          />
        </label>
        <label>
          Email
          <input
            name="email"
            type="email"
            defaultValue={user?.email}
            required={!user}
            readOnly={!!user}
          />
        </label>
        <label>
          Department
          <select
            name="department"
            defaultValue={user?.departments[0]?.id ?? "sales"}
          >
            {[
              "sales",
              "marketing",
              "operations",
              "training",
              "it",
              "management",
            ].map((d) => (
              <option value={d} key={d}>
                {d[0].toUpperCase() + d.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Role
          <select
            name="role"
            required
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              if (e.target.value === "viewer")
                setGrants((old) =>
                  old.map((g) => ({ ...g, write: false, delete: false })),
                );
            }}
          >
            <option value="" disabled>
              Choose a role
            </option>
            {roleChoices.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="active"
            defaultChecked={!user || user.status === "active"}
            disabled={!user}
          />
          Active account
        </label>
      </div>
      {user?.removed_at && (
        <p className="notice">
          This account is archived, not permanently deleted. To restore access,
          select Active account, choose its role and module permissions, then
          Save user. The person keeps their existing login.
        </p>
      )}
      <h2>Module permissions</h2>
      <div className="panel permission-presets">
        <label>
          Apply permissions to
          <select
            value={permissionGroup}
            onChange={(e) => setPermissionGroup(e.target.value)}
          >
            {permissionGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <div className="actions">
          {(
            [
              ["view", "View all"],
              ["edit", "View & edit all"],
              ["full", "Full access"],
              ["none", "Clear access"],
            ] as const
          ).map(([preset, label]) => (
            <button
              type="button"
              className="button"
              key={preset}
              disabled={
                role === "viewer" && (preset === "edit" || preset === "full")
              }
              onClick={() =>
                setGrants((old) =>
                  applyPermissionPreset(
                    old,
                    permissionGroups.find((g) => g.id === permissionGroup)!
                      .modules,
                    preset as PermissionPreset,
                    role,
                  ),
                )
              }
            >
              {label}
            </button>
          ))}
        </div>
        <p className="muted">
          Choose a group, then apply access with one click. Full access includes
          deletion. Review the checkboxes below before saving. Supplier Invoices
          always require separate authorization.
        </p>
        <p role="status">
          {grants.filter((g) => g.read).length} of {moduleChoices.length}{" "}
          modules selected. Changes apply only when you save or send the
          invitation.
        </p>
      </div>
      <p className="muted">
        Managers manage permitted module records. Employees manage assigned work
        (or their own records where no assignee exists). Viewers cannot write.
        Enable Accounts & Contacts for organization references in Sales,
        Operations, Training and Conferences.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Module</th>
              <th>Read</th>
              <th>Create / Edit</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {moduleChoices.map(([module, label]) => {
              const g = grants.find((m) => m.module === module);
              return (
                <tr key={module}>
                  <td>{label}</td>
                  {(["read", "write", "delete"] as const).map((k) => (
                    <td key={k}>
                      <input
                        aria-label={`${label}: ${k}`}
                        type="checkbox"
                        checked={g?.[k] ?? false}
                        disabled={role === "viewer" && k !== "read"}
                        onChange={(e) => change(module, k, e.target.checked)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          name="supplier"
          defaultChecked={user?.supplier_access ?? false}
        />
        Explicitly authorize Supplier Invoices
      </label>
      <p className="muted">
        Supplier Invoices remain private unless this separate permission is
        enabled. No role automatically grants access.
      </p>
      <div className="form-actions">
        <Link className="button" href="/team">
          Cancel
        </Link>
        <button className="button primary" disabled={busy || !enabled}>
          {busy ? "Saving…" : user ? "Save user" : "Send invitation"}
        </button>
      </div>
    </form>
  );
}
export function RemoveUser({ user }: { user: TeamUser }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <details className="sales-delete">
      <summary>Remove this user</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await fetch("/api/team/users", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: user.id,
                full_name: user.full_name,
                department: user.departments[0]?.id ?? "sales",
                role: user.role_id === "legacy" ? "employee" : user.role_id,
                active: false,
                supplier_access: false,
                modules: [],
                remove: true,
              }),
            });
            const d = await r.json();
            if (!r.ok) throw Error(d.error);
            router.push("/team?removed=1");
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Removal failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          Removal disables CRM access and archives this user. Their existing
          business records and relationships are retained.
        </p>
        <label>
          Type REMOVE to confirm
          <input pattern="REMOVE" required />
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="button danger" disabled={busy}>
          Remove user
        </button>
      </form>
    </details>
  );
}
export function InvitationActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(false), 60000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function submit(method: "PATCH" | "DELETE") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/team/invitations", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error ?? "The request failed.");
      setMessage(
        method === "PATCH"
          ? "The email service accepted the new invitation. Use only the newest email link, in a private window."
          : "Invitation cancelled.",
      );
      if (method === "PATCH") {
        setCooldown(true);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="actions">
        <button
          type="button"
          className="button"
          disabled={busy || cooldown}
          onClick={() => void submit("PATCH")}
        >
          {busy
            ? "Working…"
            : cooldown
              ? "Sent — wait one minute"
              : "Resend invitation"}
        </button>
        {status === "Pending" && (
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => void submit("DELETE")}
          >
            Cancel invitation
          </button>
        )}
      </div>
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
