import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { deliveryAddresses } from "@/db/schema";
import { AddressBlock } from "@/components/address-block";
import { AddDeliveryAddressForm, DeleteDeliveryAddressButton } from "@/components/delivery-addresses";
import { getAppUserWithCompany } from "@/lib/auth";
import { billingAsDelivery } from "@/lib/delivery";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.addresses.title };
}

export default async function AddressesPage() {
  const [user, { locale, t }] = await Promise.all([getAppUserWithCompany(), getDictionary()]);
  if (!user) redirect("/sign-in");
  if (!user.company) redirect("/onboarding");
  const a = t.addresses;

  const saved = await getDb().query.deliveryAddresses.findMany({
    where: eq(deliveryAddresses.companyId, user.company.id),
    orderBy: (d, { asc }) => asc(d.label),
  });
  const billing = billingAsDelivery(user.company);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="transition-colors hover:text-foreground">
          {t.footer.myOrders}
        </Link>
        <span className="text-border">/</span>
        <span className="text-foreground">{a.title}</span>
      </nav>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{a.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{a.intro}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {billing && (
          <div className="rounded-xl border border-border bg-muted/30 p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {a.billing}
            </p>
            <AddressBlock address={billing} locale={locale} />
          </div>
        )}
        {saved.map((address) => (
          <div key={address.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
            <AddressBlock address={address} locale={locale} />
            <DeleteDeliveryAddressButton id={address.id} />
          </div>
        ))}
      </div>
      {saved.length === 0 && <p className="mt-4 text-sm text-muted-foreground">{a.none}</p>}

      <section className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-semibold tracking-tight">{a.add}</h2>
        <div className="mt-4">
          <AddDeliveryAddressForm />
        </div>
      </section>
    </div>
  );
}
