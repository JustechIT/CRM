"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ProductCreator({ enabled }: { enabled: boolean }) {
  const router = useRouter(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="sales-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const f = new FormData(e.currentTarget),
            r = await fetch("/api/alfikr/products", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: f.get("name") }),
            });
          const d = await r.json();
          if (!r.ok) throw Error(d.error);
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Save failed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Product / Package name
        <input name="name" required maxLength={200} />
      </label>
      {error && <p role="alert">{error}</p>}
      <button className="button primary" disabled={!enabled || busy}>
        Add product / package
      </button>
    </form>
  );
}
