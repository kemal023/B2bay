import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { I18nProvider } from "@/components/i18n-provider";
import { getDictionary } from "@/lib/i18n/server";

// Every storefront page renders the header, which reads the session cookie and
// queries live categories — so none of them can be prerendered at build time
// (there is no database connection then).
export const dynamic = "force-dynamic";

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getDictionary();

  return (
    <I18nProvider locale={locale} t={t}>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
    </I18nProvider>
  );
}
