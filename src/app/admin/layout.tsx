import { redirect } from "next/navigation";
import Link from "next/link";
import { isPlatformAdmin } from "@/lib/auth";
import { Boxes, Building2, ClipboardList } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const allowed = await isPlatformAdmin();
  if (!allowed) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Beheer</h1>
      <nav className="mt-6 flex gap-2 border-b border-border">
        <Link
          href="/admin/suppliers"
          className="flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground"
        >
          <Boxes className="h-4 w-4" /> Leveranciers
        </Link>
        <Link
          href="/admin/companies"
          className="flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground"
        >
          <Building2 className="h-4 w-4" /> Bedrijven
        </Link>
        <Link
          href="/admin/orders"
          className="flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground"
        >
          <ClipboardList className="h-4 w-4" /> Bestellingen
        </Link>
      </nav>
      <div className="mt-8">{children}</div>
    </div>
  );
}
