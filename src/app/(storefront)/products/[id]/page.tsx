import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AddToCartForm } from "@/components/add-to-cart-form";
import { getProduct } from "@/lib/products";
import { getAppUser } from "@/lib/auth";
import { formatPriceCents } from "@/lib/format";
import { PackageSearch } from "lucide-react";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, user] = await Promise.all([getProduct(id), getAppUser()]);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="grid gap-10 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-lg bg-muted">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- supplier image domains are dynamic and admin-managed
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <PackageSearch className="h-16 w-16" />
            </div>
          )}
        </div>

        <div>
          {product.category && <Badge variant="secondary">{product.category}</Badge>}
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{product.name}</h1>

          <p className="mt-6 text-3xl font-bold">
            {formatPriceCents(product.priceCents, product.currency)}
            <span className="ml-1 text-base font-normal text-muted-foreground">
              / {product.unit}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Minimale bestelhoeveelheid: {product.minOrderQty} {product.unit}
            {" · "}
            {product.stockQty > 0 ? `${product.stockQty} op voorraad` : "Beperkte voorraad"}
            {product.ean && ` · EAN: ${product.ean}`}
          </p>

          <div className="mt-6">
            <AddToCartForm
              productId={product.id}
              minOrderQty={product.minOrderQty}
              signedIn={Boolean(user)}
            />
          </div>

          {product.description && (
            <>
              <Separator className="my-8" />
              <div className="prose prose-sm max-w-none text-muted-foreground">
                <p>{product.description}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
