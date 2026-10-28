"use client";
import { useActionState } from "react";
import { changeInvoiceAccess } from "@/app/(workspace)/team/invoice-actions";
export function InvoiceAccessForm({
  userId,
  allowed,
  self,
}: {
  userId: string;
  allowed: boolean;
  self: boolean;
}) {
  const [state, action, pending] = useActionState(changeInvoiceAccess, {
    error: "",
  });
  return (
    <form action={action}>
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="allowed" value={allowed ? "false" : "true"} />
      <button className="button" disabled={pending || self}>
        {self
          ? "Your access"
          : pending
            ? "Updating…"
            : allowed
              ? "Revoke invoice access"
              : "Grant invoice access"}
      </button>
      {state.error && <p role="status">{state.error}</p>}
    </form>
  );
}
