import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CartItemRow } from "@/components/cart-item-row";
import { getCartWithTotals } from "@/lib/actions/cart";
import { getAppUserWithCompany } from "@/lib/auth";
import { formatPriceCents } from "@/lib/format";
import { ShoppingCart, TriangleAlert } from "lucide-react";

export default async function CartPage() {
  const [{ items, subtotalCents }, user] = await Promise.all([
    getCartWithTotals(),
    getAppUserWithCompany(),
  ]);

  const companyApproved = user?.company?.status === "approved";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Winkelmandje</h1>

      {!user?.company ? (
        <Alert className="mt-6">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Nog geen bedrijfsaccount</AlertTitle>
          <AlertDescription>
            Rond eerst de aanmelding van je bedrijf af om te kunnen bestellen.{" "}
            <Link href="/onboarding" className="underline">Naar aanmelden</Link>
          </AlertDescription>
        </Alert>
      ) : !companyApproved ? (
        <Alert className="mt-6">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Account in beoordeling</AlertTitle>
          <AlertDescription>
            Je bedrijfsaccount wordt nog geverifieerd. Je kunt producten
            alvast verzamelen, maar afrekenen kan pas na goedkeuring.
          </AlertDescription>
        </Alert>
      ) : null}

      {items.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center text-muted-foreground">
          <ShoppingCart className="h-10 w-10" />
          <p>Je winkelmandje is leeg.</p>
          <Button asChild variant="outline">
            <Link href="/products">Bekijk producten</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {items.map((item) => (
              <CartItemRow key={item.id} item={item} />
            ))}
          </div>

          <Card className="h-fit">
            <CardContent className="space-y-4 pt-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotaal</span>
                <span className="font-medium">{formatPriceCents(subtotalCents)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Verzendkosten en btw worden bij checkout berekend.
              </p>
              {companyApproved ? (
                <Button asChild className="w-full" size="lg">
                  <Link href="/checkout">Naar checkout</Link>
                </Button>
              ) : (
                <Button className="w-full" size="lg" disabled>
                  Naar checkout
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
