import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { getAppUserWithCompany } from "@/lib/auth";
import { formatDate, formatPriceCents } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CircleAlert, CircleCheck, Clock } from "lucide-react";

const statusLabels: Record<string, string> = {
  placed: "Wacht op factuur",
  invoiced: "Factuur verstuurd",
  paid: "Betaald",
  fulfilled: "Afgerond",
  cancelled: "Geannuleerd",
};

export default async function DashboardPage() {
  const user = await getAppUserWithCompany();
  if (!user) redirect("/sign-in");
  if (!user.company) redirect("/onboarding");

  const db = getDb();
  const companyOrders = await db.query.orders.findMany({
    where: eq(orders.companyId, user.company.id),
    orderBy: (t, { desc }) => desc(t.createdAt),
    limit: 25,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{user.company.name}</h1>
          <p className="text-sm text-muted-foreground">Zakelijk dashboard</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/products">Verder winkelen</Link>
        </Button>
      </div>

      {user.company.status !== "approved" && (
        <Alert className="mt-6">
          <Clock className="h-4 w-4" />
          <AlertTitle>Account in beoordeling</AlertTitle>
          <AlertDescription>
            Je kunt producten verzamelen in je winkelmandje. Zodra ons team je
            bedrijf heeft geverifieerd, kun je afrekenen.
          </AlertDescription>
        </Alert>
      )}

      {user.role === "company_admin" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Collega&apos;s uitnodigen</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Deel deze code met collega&apos;s. Zij vullen deze in bij &quot;Bestaand
              bedrijf&quot; tijdens het aanmelden.
            </p>
            <p className="mt-2 font-mono text-lg font-semibold tracking-wider">
              {user.company.joinCode}
            </p>
          </CardContent>
        </Card>
      )}

      <h2 className="mt-10 text-lg font-semibold">Bestellingen</h2>
      {companyOrders.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nog geen bestellingen geplaatst.</p>
      ) : (
        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Totaal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companyOrders.map((order) => (
              <TableRow key={order.id} className="cursor-pointer">
                <TableCell>
                  <Link href={`/dashboard/orders/${order.id}`} className="block hover:underline">
                    {formatDate(order.createdAt)}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={order.status === "paid" || order.status === "fulfilled" ? "default" : "secondary"}>
                    {order.status === "paid" || order.status === "fulfilled" ? (
                      <CircleCheck className="h-3 w-3" />
                    ) : order.status === "cancelled" ? (
                      <CircleAlert className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {statusLabels[order.status] ?? order.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatPriceCents(order.totalCents, order.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
