import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { getAppUserWithCompany } from "@/lib/auth";
import { formatDate, formatPriceCents } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, FileText } from "lucide-react";

const statusLabels: Record<string, string> = {
  placed: "Geplaatst — wacht op factuur",
  invoiced: "Factuur verstuurd",
  paid: "Betaald",
  fulfilled: "Afgerond",
  cancelled: "Geannuleerd",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getAppUserWithCompany();
  if (!user) redirect("/sign-in");
  if (!user.company) redirect("/onboarding");

  const db = getDb();
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: { items: true },
  });

  if (!order || order.companyId !== user.company.id) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4" /> Terug naar dashboard
        </Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bestelling van {formatDate(order.createdAt)}
        </h1>
        <Badge variant={order.status === "paid" || order.status === "fulfilled" ? "default" : "secondary"}>
          {statusLabels[order.status] ?? order.status}
        </Badge>
      </div>

      {order.status === "placed" && (
        <Alert className="mt-6">
          <Clock className="h-4 w-4" />
          <AlertTitle>Wacht op verzendkosten</AlertTitle>
          <AlertDescription>
            We bepalen de verzendkosten op basis van je bestelling en sturen
            je binnenkort een factuur om per bank over te maken.
          </AlertDescription>
        </Alert>
      )}

      {order.invoiceNumber && (
        <Alert className="mt-6">
          <FileText className="h-4 w-4" />
          <AlertTitle>Factuur {order.invoiceNumber}</AlertTitle>
          <AlertDescription>
            {order.invoiceNotes || "Maak het totaalbedrag over volgens de ontvangen factuur."}
          </AlertDescription>
        </Alert>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Producten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span>
                {item.nameSnapshot} <span className="text-muted-foreground">× {item.quantity}</span>
              </span>
              <span className="font-medium">
                {formatPriceCents(item.unitPriceCents * item.quantity, order.currency)}
              </span>
            </div>
          ))}

          <Separator className="my-2" />

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotaal</span>
            <span>{formatPriceCents(order.subtotalCents, order.currency)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Verzendkosten</span>
            <span>
              {order.shippingCents != null
                ? formatPriceCents(order.shippingCents, order.currency)
                : "Nog te bepalen"}
            </span>
          </div>
          <div className="flex items-center justify-between font-semibold">
            <span>Totaal</span>
            <span>{formatPriceCents(order.totalCents, order.currency)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
