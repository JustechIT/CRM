import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
// Refresh auth cookies. Reject unauthorized Sales POSTs before decoding action bodies.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const salesMutation =
    request.method === "POST" &&
    (request.nextUrl.pathname === "/modules/justech-sales" ||
      request.nextUrl.pathname.startsWith("/modules/justech-sales/"));
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
    return salesMutation
      ? deny(401, "Sales access required. No record was saved.")
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
  if (salesMutation) {
    if (!user) return deny(401, "Sales access required. No record was saved.");
    const [write, remove] = await Promise.all([
      db.rpc("has_permission", { requested: "sales.write" }),
      db.rpc("has_permission", { requested: "sales.delete" }),
    ]);
    if (write.error || remove.error)
      return deny(
        503,
        "Sales permissions could not be verified. No record was saved.",
      );
    if (write.data !== true && remove.data !== true)
      return deny(
        403,
        "Sales write permission is required. No record was saved.",
      );
  }
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
