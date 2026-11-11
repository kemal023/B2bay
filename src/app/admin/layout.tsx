import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { getAppUser } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

// Deliberately its own shell (dark, sidebar nav) — never reuses the
// storefront header/footer, so staff can never mistake this for the
// public site (and vice versa).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAppUser();
  if (!user || user.role !== "platform_admin") redirect("/dashboard");

  const db = getDb();
  const counts = await db.execute<{ pending_companies: number; open_orders: number }>(sql`
    SELECT
      (SELECT COUNT(*) FROM companies WHERE status = 'pending')::int AS pending_companies,
      (SELECT COUNT(*) FROM orders WHERE status IN ('placed', 'invoiced'))::int AS open_orders
  `);
  const row = counts.rows[0];

  return (
    <div className="dark flex min-h-screen bg-background text-foreground">
      <AdminSidebar
        email={user.email}
        name={user.name}
        pendingCompanies={Number(row?.pending_companies ?? 0)}
        openOrders={Number(row?.open_orders ?? 0)}
      />
      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-6 py-8 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
