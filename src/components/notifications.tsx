"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
type Item = {
  event_key: string;
  title: string;
  href: string;
  kind: string;
  due_date: string | null;
  is_read: boolean;
};
export function Notifications({ preview }: { preview: boolean }) {
  const [open, setOpen] = useState(false),
    [items, setItems] = useState<Item[]>([]),
    [status, setStatus] = useState(""),
    [enabled, setEnabled] = useState(true),
    [loading, setLoading] = useState(!preview);
  useEffect(() => {
    if (preview) return;
    const abort = new AbortController();
    const refresh = async () => {
      try {
        const r = await fetch("/api/notifications", { signal: abort.signal });
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setItems(d.items);
        setEnabled(d.enabled !== false);
        setStatus("");
        setLoading(false);
      } catch (e) {
        if (!abort.signal.aborted) {
          setStatus(
            e instanceof Error ? e.message : "Notifications unavailable.",
          );
          setLoading(false);
        }
      }
    };
    void refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("notifications-preferences", refresh);
    return () => {
      abort.abort();
      clearInterval(timer);
      window.removeEventListener("notifications-preferences", refresh);
    };
  }, [preview]);
  const mark = async (keys: string[]) => {
    try {
      const r = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys }),
        keepalive: true,
      });
      if (!r.ok) throw Error("Read status could not be saved.");
      setItems((old) =>
        old.map((i) =>
          keys.includes(i.event_key) ? { ...i, is_read: true } : i,
        ),
      );
    } catch {
      setStatus("Read status could not be saved. Check your connection.");
    }
  };
  const unread = items.filter((i) => !i.is_read).length;
  return (
    <div className="popover-anchor">
      <button
        className="icon-button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={19} />
        {unread > 0 && <span className="notification-count">{unread}</span>}
      </button>
      {open && (
        <div className="popover notification-popover">
          <strong>Notifications</strong>
          {preview ? (
            <p>Sign in to see your assigned work and reminders.</p>
          ) : loading ? (
            <p>Loading notifications…</p>
          ) : status ? (
            <p role="alert">{status}</p>
          ) : !enabled ? (
            <p>Notifications are off. Enable them in Settings.</p>
          ) : !items.length ? (
            <p>You’re all caught up.</p>
          ) : (
            <>
              <button
                className="text-link"
                onClick={() => void mark(items.map((i) => i.event_key))}
              >
                Mark all read
              </button>
              {items.map((i) => (
                <div
                  key={i.event_key}
                  className={
                    i.is_read ? "notification-item" : "notification-item unread"
                  }
                >
                  <Link
                    href={i.href}
                    onClick={() => {
                      void mark([i.event_key]);
                      setOpen(false);
                    }}
                  >
                    {i.title}
                  </Link>
                  <small>
                    {i.kind}
                    {i.due_date ? ` · ${i.due_date}` : ""}
                  </small>
                </div>
              ))}
            </>
          )}
          <button className="text-link" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
