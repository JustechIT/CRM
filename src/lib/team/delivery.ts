export type DeliveryError = {
  code?: string;
  status?: number;
  message?: string;
} | null;
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
      (["email_exists", "user_already_exists"].includes(error.code ?? "") ||
        (error.status === 422 &&
          /already (?:been )?(?:registered|invited)|user already exists/i.test(
            error.message ?? "",
          )))
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
  return {
    sent,
    tracked,
    ...(!sent ? { errorCode: error?.code ?? "send_failed" } : {}),
  };
}

export function invitationDeliveryMessage(code: string) {
  if (
    [
      "over_email_send_rate_limit",
      "over_request_rate_limit",
      "email_rate_limit_exceeded",
    ].includes(code)
  )
    return "Supabase has temporarily limited email sending. Wait before retrying; repeated clicks will not help. If this continues, check Authentication email limits in Supabase.";
  if (["email_address_not_authorized", "email_address_invalid"].includes(code))
    return "Supabase could not send to this address. Check the address and your Supabase email recipient restrictions. The default email service may only allow approved recipients.";
  if (code === "network_error")
    return "The email service could not be reached. Please retry shortly.";
  if (code === "email_provider_disabled")
    return "Email sign-in is disabled in Supabase. Enable the Email provider under Authentication.";
  return "Supabase could not send the email. Check Authentication logs and email delivery settings. No access was granted. You can retry using Resend invitation.";
}
