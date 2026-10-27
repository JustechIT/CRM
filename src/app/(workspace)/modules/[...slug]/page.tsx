import { notFound } from "next/navigation";
import { allPages, navigation } from "@/lib/navigation";
import { EmptyState, PageHeader, Badge } from "@/components/ui";
export default async function Module({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
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
