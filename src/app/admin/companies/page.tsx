import { getDb } from "@/db";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompanyStatusActions } from "@/components/admin/company-status-actions";
import { AdminPageHeader, AdminTableShell } from "@/components/admin/page-header";
import { formatDate } from "@/lib/format";
import { CompanyEditDialog, RecheckVatButton } from "@/components/admin/company-edit-dialog";
import { countryName, vatTreatmentFor } from "@/lib/vat";

const vatBadge: Record<string, { label: string; className: string }> = {
  valid: { label: "VIES geldig", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  invalid: { label: "Ongeldig", className: "bg-destructive/10 text-destructive" },
  unverified: { label: "Niet gecontroleerd", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
};

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
              <TableHead>Land</TableHead>
              <TableHead>Btw-nummer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aangemaakt</TableHead>
              <TableHead className="text-right">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allCompanies.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.addressLine ? `${c.addressLine}, ${c.postalCode} ${c.city}` : "Geen adres"}
                    {c.kvkNumber && ` · KVK ${c.kvkNumber}`}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{countryName(c.country)}</TableCell>
                <TableCell className="text-sm">
                  {c.vatNumber ? (
                    <div className="space-y-1">
                      <div className="font-mono text-xs">{c.vatNumber}</div>
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${vatBadge[c.vatStatus]?.className ?? ""}`}>
                        {vatBadge[c.vatStatus]?.label ?? c.vatStatus}
                      </span>
                      {vatTreatmentFor(c) === "reverse_charge" && (
                        <span className="ml-1 text-[11px] text-muted-foreground">btw verlegd</span>
                      )}
                      {c.vatRegisteredName && (
                        <div className="text-[11px] text-muted-foreground">VIES: {c.vatRegisteredName}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[c.status]}>{statusLabels[c.status]}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {c.vatNumber && <RecheckVatButton id={c.id} />}
                    <CompanyEditDialog company={c} />
                    <CompanyStatusActions id={c.id} status={c.status} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminTableShell>
    </div>
  );
}
