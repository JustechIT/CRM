import { redirect } from "next/navigation";
import { database, employee, isConfigured } from "@/lib/supabase";
import { invoiceAccess } from "@/lib/finance/access";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const configured = isConfigured();
  const profile = await employee();
  if (configured && !profile) redirect("/login");
  let modules: string[] | undefined;
  let team = true;
  if (configured) {
    const db = await database();
    const nav = await db.rpc("crm_navigation_access");
    if (!nav.error && nav.data) {
      modules = nav.data.modules;
      team = nav.data.team === true;
    } else {
      const scopes = [
        "directory",
        "sales",
        "marketing",
        "operations",
        "training",
        "priorities",
        "platform",
        "events",
      ];
      const caps = await Promise.all(
        scopes.map(async (scope) => {
          const r = await db.rpc("has_permission", {
            requested: scope + ".read",
          });
          return r.data === true && !r.error ? scope : null;
        }),
      );
      modules = caps.filter((s): s is string => !!s);
      team = false;
    }
  }
  return (
    <Shell
      name={profile?.full_name ?? "Your workspace"}
      preview={!configured}
      supplierInvoices={!!(await invoiceAccess())}
      allowedModules={modules}
      teamManagement={team}
    >
      {children}
    </Shell>
  );
}
