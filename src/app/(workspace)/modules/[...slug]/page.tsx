import { DepartmentPage } from "@/components/departments/page";
import { isDepartment } from "@/lib/departments/config";
import { SalesPage } from "@/components/sales/page";
import { notFound } from "next/navigation";
import { allPages, navigation } from "@/lib/navigation";
import { EmptyState, PageHeader, Badge } from "@/components/ui";
export default async function Module({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (slug[0] === "justech-sales")
    return <SalesPage slug={slug.slice(1)} params={await searchParams} />;
  const department = slug[0]?.replace(/^justech-/, "");
  if (slug[0]?.startsWith("justech-") && isDepartment(department))
    return (
      <DepartmentPage
        department={department}
        slug={slug.slice(1)}
        params={await searchParams}
      />
    );
  const path = "/modules/" + slug.join("/");
  const page = allPages.find((p) => p.href === path);
  if (!page) notFound();
  const section = navigation.find((s) =>
    s.items.some(
      (i) => i.href === path || i.children?.some((c) => c.href === path),
    ),
  );
  return (
    <>
      <PageHeader
        eyebrow={section?.label}
        title={page.label}
        description="A dedicated place for your team's work."
      >
        <Badge>Planned module</Badge>
      </PageHeader>
      <section className="panel">
        <EmptyState
          title={`${page.label}, thoughtfully connected`}
          description="This module is planned for a future release. It will connect with your shared accounts and contacts. No actions or records are available yet."
        />
      </section>
    </>
  );
}
