import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { formatPriceCents } from "@/lib/format";
import { getDictionary } from "@/lib/i18n/server";
import { getCompanyDetails } from "@/lib/invoicing";
import { termsDoc } from "@/lib/legal";
import { getShippingSettings } from "@/lib/shipping";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.legal.terms };
}

export default async function TermsPage() {
  const [{ locale, t }, seller, shipping] = await Promise.all([
    getDictionary(),
    getCompanyDetails(),
    getShippingSettings(),
  ]);
  const threshold = shipping.freeShippingThresholdCents;
  const doc = termsDoc(locale, seller, threshold != null ? formatPriceCents(threshold) : null);
  return <LegalPage doc={doc} updatedLabel={t.legal.lastUpdated} />;
}
