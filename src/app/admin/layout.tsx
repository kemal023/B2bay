import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

// Deliberately its own shell (dark, sidebar nav) — never reuses the
// storefront header/footer, so staff can never mistake this for the
// public site (and vice versa).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAppUser();
  if (!user || user.role !== "platform_admin") redirect("/dashboard");

  return (
    <div className="dark flex min-h-screen bg-background text-foreground">
      <AdminSidebar email={user.email} name={user.name} />
      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-6 py-8 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
