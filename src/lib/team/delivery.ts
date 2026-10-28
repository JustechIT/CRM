export type DeliveryError = { code?: string } | null;
export async function deliverInvitation(adapter: {
  invite: () => Promise<DeliveryError>;
  recover: () => Promise<DeliveryError>;
  record: (sent: boolean, code: string | null) => Promise<void>;
}) {
  let error: DeliveryError;
  try {
    error = await adapter.invite();
    if (
      error &&
      ["email_exists", "user_already_exists"].includes(error.code ?? "")
    )
      error = await adapter.recover();
  } catch {
    error = { code: "network_error" };
  }
  const sent = !error;
  let tracked = true;
  try {
    await adapter.record(sent, error?.code ?? (error ? "send_failed" : null));
  } catch {
    tracked = false;
  }
  return { sent, tracked };
}
