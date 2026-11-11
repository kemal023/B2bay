import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { QuickOrderForm } from "@/components/bulk-cart-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getAppUserWithCompany } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { TriangleAlert } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.quickOrder.title };
}

export default async function QuickOrderPage() {
  const [user, { t }] = await Promise.all([getAppUserWithCompany(), getDictionary()]);
  if (!user) redirect("/sign-in");
  const approved = user.company?.status === "approved";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-10">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="transition-colors hover:text-foreground">
          {t.footer.myOrders}
        </Link>
        <span className="text-border">/</span>
        <span className="text-foreground">{t.quickOrder.title}</span>
      </nav>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{t.quickOrder.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.quickOrder.intro}</p>
      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        {approved ? (
          <QuickOrderForm />
        ) : (
          <Alert>
            <TriangleAlert className="h-4 w-4" />
            <AlertDescription>{t.cart.reviewBody}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
