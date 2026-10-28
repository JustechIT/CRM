import { requestHasSameOrigin } from "@/lib/server/request";
import { NextRequest, NextResponse } from "next/server";
import { database, employee } from "@/lib/supabase";
import { z } from "zod";
export async function GET() {
  const p = await employee();
  if (!p)
    return NextResponse.json(
      { error: "Employee access required." },
      { status: 401 },
    );
  const db = await database();
  const setting = await db
    .from("user_preferences")
    .select("notifications_enabled")
    .eq("user_id", p.id)
    .maybeSingle();
  if (setting.error)
    return NextResponse.json(
      { error: "Notification settings unavailable." },
      { status: 503 },
    );
  if (setting.data?.notifications_enabled === false)
    return NextResponse.json(
      { items: [], enabled: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  const r = await db.rpc("my_notifications");
  return NextResponse.json(
    r.error
      ? { error: "Notifications unavailable." }
      : { items: r.data ?? [], enabled: true },
    {
      status: r.error ? 503 : 200,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
export async function PATCH(req: NextRequest) {
  if (!requestHasSameOrigin(req))
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  if (!(await employee()))
    return NextResponse.json(
      { error: "Employee access required." },
      { status: 401 },
    );
  const p = z
    .object({ keys: z.array(z.string().max(200)).max(50) })
    .safeParse(await req.json());
  if (!p.success)
    return NextResponse.json(
      { error: "Invalid notifications." },
      { status: 400 },
    );
  const db = await database(),
    r = await db.rpc("mark_notifications_read", { keys: p.data.keys });
  return NextResponse.json(
    r.error ? { error: "Read status could not be saved." } : { saved: true },
    { status: r.error ? 503 : 200 },
  );
}
