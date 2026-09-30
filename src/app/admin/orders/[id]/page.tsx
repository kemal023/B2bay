import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { formatDate, formatPriceCents } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { InvoiceForm, OrderStatusActions } from "@/components/admin/order-actions";
import { ExternalLink, Truck } from "lucide-react";

const statusLabels: Record<string, string> = {
  placed: "Wacht op factuur",
  invoiced: "Factuur verstuurd",
  paid: "Betaald",
  fulfilled: "Afgerond",
  cancelled: "Geannuleerd",
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      items: { with: { supplier: { columns: { name: true, baseUrl: true } } } },
      company: true,
    },
  });

  if (!order) notFound();

  const bySupplier = new Map<
    string,
    { name: string; baseUrl: string | null; items: typeof order.items }
  >();
  for (const item of order.items) {
    const key = item.supplierId ?? "none";
    const entry = bySupplier.get(key) ?? {
      name: item.supplier?.name ?? "Eigen voorraad",
      baseUrl: item.supplier?.baseUrl ?? null,
      items: [],
    };
    entry.items.push(item);
    bySupplier.set(key, entry);
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{order.company.name}</h2>
          <p className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</p>
        </div>
        <Badge variant={order.status === "paid" || order.status === "fulfilled" ? "default" : "secondary"}>
          {statusLabels[order.status] ?? order.status}
        </Badge>
      </div>

      <div className="mt-4">
        <OrderStatusActions orderId={order.id} status={order.status} />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
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

        {order.status === "placed" ? (
          <InvoiceForm orderId={order.id} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Factuur</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Nummer:</span> {order.invoiceNumber || "—"}</p>
              {order.invoiceNotes && <p className="text-muted-foreground">{order.invoiceNotes}</p>}
              <p><span className="text-muted-foreground">Verstuurd:</span> {order.invoicedAt ? formatDate(order.invoicedAt) : "—"}</p>
              <p><span className="text-muted-foreground">Betaald:</span> {order.paidAt ? formatDate(order.paidAt) : "—"}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4" /> Inkoop bij leveranciers
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Alleen zichtbaar voor beheerders — de klant ziet dit nergens.
            Gebruik dit om te bepalen waar je deze bestelling moet inkopen.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...bySupplier.values()].map((group) => (
            <div key={group.name} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{group.name}</span>
                {group.baseUrl && (
                  <a
                    href={group.baseUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Naar leverancier <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {group.items.map((item) => (
                  <li key={item.id}>
                    {item.nameSnapshot} × {item.quantity}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
