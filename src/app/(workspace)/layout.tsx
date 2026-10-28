import { redirect } from "next/navigation";
import { employee, isConfigured } from "@/lib/supabase";
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
  return (
    <Shell
      name={profile?.full_name ?? "Your workspace"}
      preview={!configured}
      supplierInvoices={!!(await invoiceAccess())}
    >
      {children}
    </Shell>
  );
}
