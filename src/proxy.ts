import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
// Refresh auth cookies. Reject unauthorized module POSTs before decoding action bodies.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const salesMutation =
    request.method === "POST" &&
    (request.nextUrl.pathname === "/modules/justech-sales" ||
      request.nextUrl.pathname.startsWith("/modules/justech-sales/"));
  const departmentMutation =
    request.method === "POST"
      ? request.nextUrl.pathname.match(
          /^\/modules\/justech-(marketing|operations|training)(?:\/|$)/,
        )?.[1]
      : undefined;
  const privateMutation =
    request.method === "POST" &&
    (request.nextUrl.pathname.startsWith("/finance/") ||
      request.nextUrl.pathname === "/team");
  const workspaceMutation =
    request.method === "POST"
      ? request.nextUrl.pathname.match(
          /^\/modules\/workspace\/(priorities|platform|events)(?:\/|$)/,
        )?.[1]
      : undefined;
  const alfikrMutation =
    request.method === "POST"
      ? request.nextUrl.pathname.match(
          /^\/modules\/(alfikr-sales|alfikr-marketing|alfikr-content)(?:\/|$)/,
        )?.[1]
      : undefined;
  const mutationScope = salesMutation
    ? "sales"
    : (departmentMutation ?? workspaceMutation ?? alfikrMutation);
  const scopeLabel = salesMutation ? "Sales" : "Department";
  function deny(status: number, message: string) {
    const denied = NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
    for (const cookie of response.cookies.getAll()) denied.cookies.set(cookie);
    return denied;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    return mutationScope || privateMutation
      ? deny(401, `${scopeLabel} access required. No record was saved.`)
      : response;
  const db = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const {
    data: { user },
  } = await db.auth.getUser();
  if (privateMutation) {
    if (!user) return deny(401, "Private access required.");
    const r =
      request.nextUrl.pathname === "/team"
        ? await db.rpc("team_admin_activation_ready")
        : await db.rpc("supplier_invoice_allowed", { manage: false });
    const admin =
      request.nextUrl.pathname === "/team"
        ? await db.rpc("is_super_admin")
        : null;
    if ((r.error || r.data !== true) && (admin?.error || admin?.data !== true))
      return deny(403, "Private access required.");
  }
  if (mutationScope) {
    if (!user)
      return deny(401, `${scopeLabel} access required. No record was saved.`);
    const [write, remove] = await Promise.all([
      db.rpc("has_permission", { requested: mutationScope + ".write" }),
      db.rpc("has_permission", { requested: mutationScope + ".delete" }),
    ]);
    if (write.error || remove.error)
      return deny(
        503,
        `${scopeLabel} permissions could not be verified. No record was saved.`,
      );
    if (write.data !== true && remove.data !== true)
      return deny(
        403,
        `${scopeLabel} write permission is required. No record was saved.`,
      );
  }
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
