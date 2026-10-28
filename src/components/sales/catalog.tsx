import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { salesBase, salesPath } from "@/lib/sales/config";
import {
  parameter,
  type SalesParams,
  type SalesAccess,
} from "@/lib/sales/data";
import { idSchema } from "@/lib/sales/validation";
import { ProductForm } from "./forms";
import { SalesPagination } from "./table";

export async function ProductCatalog({
  access,
  params,
  canWrite,
}: {
  access: SalesAccess | null;
  params: SalesParams;
  canWrite: boolean;
}) {
  const q = parameter(params, "q").slice(0, 100);
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(parameter(params, "page"), 10) || 1),
  );
  let products: Record<string, unknown>[] = [];
  let count = 0;
  let selected: Record<string, unknown> | undefined;
  if (access) {
    let query = access.db
      .from("products")
      .select("*", { count: "exact" })
      .order("name")
      .order("id")
      .range((page - 1) * 25, page * 25 - 1);
    if (q) query = query.ilike("name", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
    const r = await query;
    if (r.error) throw new Error("Products unavailable");
    products = r.data ?? [];
    count = r.count ?? 0;
    const id = parameter(params, "product");
    if (id) {
      if (!idSchema.safeParse(id).success) notFound();
      const r = await access.db
        .from("products")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (r.error) throw new Error("Product unavailable");
      if (!r.data) notFound();
      selected = r.data;
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Justech Sales · Shared products"
        title="Product catalog"
        description="Create a product once, then use it across opportunities, payments and subscriptions."
      >
        <Link className="button" href={salesPath("subscriptions")}>
          <ArrowLeft size={15} />
          Back to subscriptions
        </Link>
      </PageHeader>
      <div className="sales-catalog-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>{selected ? "Edit product" : "Add a product"}</h2>
          </div>
          <ProductForm product={selected} canWrite={canWrite} />
        </section>
        <section className="panel">
          <form className="table-toolbar" method="get">
            <input type="hidden" name="catalog" value="1" />
            <label className="sr-only" htmlFor="products-search">
              Search products
            </label>
            <input
              id="products-search"
              name="q"
              defaultValue={q}
              placeholder="Search products…"
            />
            <button className="button">Search</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Subscription section</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={String(p.id)}>
                    <td>
                      <Link
                        href={`${salesBase}/subscriptions?catalog=1&product=${p.id}`}
                      >
                        {String(p.name)}
                      </Link>
                    </td>
                    <td>
                      <Badge>{String(p.subscription_kind)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!products.length && (
            <EmptyState
              title="No products yet"
              description="Add the products your team sells. Turnitin and Other classify subscription records without changing the sidebar."
            />
          )}
          <SalesPagination
            section="subscriptions"
            params={{ catalog: "1", q }}
            page={page}
            total={count}
          />
        </section>
      </div>
    </>
  );
}
