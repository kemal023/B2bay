import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { favorites, products } from "@/db/schema";
import { AddFavoritesToCartButton } from "@/components/bulk-cart-actions";
import { ProductCard } from "@/components/product-card";
import { getAppUserWithCompany } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { priceAccessFor } from "@/lib/price-visibility";
import { Heart } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.favorites.title };
}

export default async function FavoritesPage() {
  const [user, { locale, t }] = await Promise.all([getAppUserWithCompany(), getDictionary()]);
  if (!user) redirect("/sign-in");
  if (!user.company) redirect("/onboarding");
  const f = t.favorites;

  const rows = await getDb()
    .select({ product: products })
    .from(favorites)
    .innerJoin(products, eq(products.id, favorites.productId))
    .where(and(eq(favorites.companyId, user.company.id), eq(products.active, true)))
    .orderBy(desc(favorites.createdAt));
  const priceAccess = priceAccessFor(user);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="transition-colors hover:text-foreground">
          {t.footer.myOrders}
        </Link>
        <span className="text-border">/</span>
        <span className="text-foreground">{f.title}</span>
      </nav>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{f.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{f.intro}</p>
        </div>
        {rows.length > 0 && priceAccess === "visible" && <AddFavoritesToCartButton />}
      </div>

      {rows.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Heart className="h-7 w-7 text-muted-foreground" />
          </span>
          <p className="max-w-sm text-sm text-muted-foreground">{f.empty}</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {rows.map(({ product }) => (
            <ProductCard
              key={product.id}
              product={product}
              priceAccess={priceAccess}
              locale={locale}
              discountPercent={user.company?.discountPercent ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
