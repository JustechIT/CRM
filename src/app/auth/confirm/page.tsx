import Invite from "@/app/invite/page";
import { redirect } from "next/navigation";

// Default Supabase emails return tokens in the browser-only URL fragment.
// Render here so those tokens reach AcceptInvite without an HTTP redirect.
export default async function Confirm({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["code", "token_hash", "type"])
    if (typeof params[key] === "string") query.set(key, params[key]);
  if (query.has("code") || query.has("token_hash"))
    redirect(`/auth/verify?${query.toString()}`);
  return <Invite />;
}
