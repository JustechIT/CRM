import { requestHasSameOrigin } from "@/lib/server/request";
import { NextRequest, NextResponse } from "next/server";
import { database, employee } from "@/lib/supabase";
import { z } from "zod";
const schema = z.object({
  theme: z.enum(["light", "dark"]).optional(),
  sidebar_collapsed: z.boolean().optional(),
  notifications_enabled: z.boolean().optional(),
  pinned_pages: z
    .array(
      z
        .string()
        .max(200)
        .regex(/^\/(?!\/)/),
    )
    .max(100)
    .optional(),
});
export async function GET() {
  const p = await employee();
  if (!p)
    return NextResponse.json(
      { error: "Employee access required." },
      { status: 401 },
    );
  const db = await database(),
    r = await db
      .from("user_preferences")
      .select("theme,sidebar_collapsed,notifications_enabled,pinned_pages")
      .eq("user_id", p.id)
      .maybeSingle();
  return NextResponse.json(
    r.error
      ? { error: "Preferences unavailable." }
      : {
          exists: !!r.data,
          preferences: r.data ?? {
            theme: "light",
            sidebar_collapsed: false,
            notifications_enabled: true,
            pinned_pages: [],
          },
        },
    {
      status: r.error ? 503 : 200,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
export async function PATCH(req: NextRequest) {
  if (!requestHasSameOrigin(req))
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const p = await employee();
  if (!p)
    return NextResponse.json(
      { error: "Employee access required." },
      { status: 401 },
    );
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid preferences." },
      { status: 400 },
    );
  const db = await database();
  const exists = await db
    .from("user_preferences")
    .select("user_id")
    .eq("user_id", p.id)
    .maybeSingle();
  if (exists.error)
    return NextResponse.json(
      { error: "Preferences unavailable." },
      { status: 503 },
    );
  let r = exists.data
    ? await db.from("user_preferences").update(parsed.data).eq("user_id", p.id)
    : await db
        .from("user_preferences")
        .insert({ user_id: p.id, ...parsed.data });
  if (r.error?.code === "23505")
    r = await db
      .from("user_preferences")
      .update(parsed.data)
      .eq("user_id", p.id);
  return NextResponse.json(
    r.error ? { error: "Preferences could not be saved." } : { saved: true },
    { status: r.error ? 503 : 200 },
  );
}
