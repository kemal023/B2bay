import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getDictionary } from "@/lib/i18n/server";
import { getCompanyDetails } from "@/lib/invoicing";
import { privacyDoc } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.legal.privacy };
}

export default async function PrivacyPage() {
  const [{ locale, t }, seller] = await Promise.all([getDictionary(), getCompanyDetails()]);
  return <LegalPage doc={privacyDoc(locale, seller)} updatedLabel={t.legal.lastUpdated} />;
}
