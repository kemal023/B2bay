import { getDb } from "@/db";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompanyStatusActions } from "@/components/admin/company-status-actions";
import { AdminPageHeader, AdminTableShell } from "@/components/admin/page-header";
import { formatDate } from "@/lib/format";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  approved: "default",
  pending: "secondary",
  suspended: "destructive",
};

const statusLabels: Record<string, string> = {
  approved: "Goedgekeurd",
  pending: "In beoordeling",
  suspended: "Opgeschort",
};

export default async function AdminCompaniesPage() {
  const db = getDb();
  const allCompanies = await db.query.companies.findMany({
    orderBy: (t, { desc }) => desc(t.createdAt),
  });

  const pendingCount = allCompanies.filter((c) => c.status === "pending").length;

  return (
    <div>
      <AdminPageHeader
        title="Zakelijke accounts"
        description="Keur nieuwe bedrijfsaccounts goed voordat ze kunnen afrekenen."
        action={
          pendingCount > 0 ? (
            <Badge variant="secondary">
              {pendingCount} wacht{pendingCount === 1 ? "" : "en"} op beoordeling
            </Badge>
          ) : undefined
        }
      />

      <AdminTableShell>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Bedrijf</TableHead>
              <TableHead>KVK / btw</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aangemaakt</TableHead>
              <TableHead className="text-right">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allCompanies.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {c.kvkNumber || "—"} / {c.vatNumber || "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[c.status]}>{statusLabels[c.status]}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <CompanyStatusActions id={c.id} status={c.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminTableShell>
    </div>
  );
}
