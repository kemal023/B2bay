import { AdminPageHeader } from "@/components/admin/page-header";
import { CompanyDetailsForm } from "@/components/admin/company-details-form";
import { ShippingSettingsForm } from "@/components/admin/shipping-settings-form";
import { getCompanyDetails, missingCompanyFields } from "@/lib/invoicing";
import { getShippingSettings } from "@/lib/shipping";
import { EmailSettings } from "@/components/admin/email-settings";
import { emailConfigured } from "@/lib/email/send";
import { VolumeTiersForm } from "@/components/admin/volume-tiers-form";
import { getVolumeTiers } from "@/lib/pricing";
import { paymentsEnabled } from "@/lib/payments";
import { TriangleAlert } from "lucide-react";

export default async function AdminSettingsPage() {
  const [details, shipping, tiers] = await Promise.all([
    getCompanyDetails(),
    getShippingSettings(),
    getVolumeTiers(),
  ]);
  const missing = missingCompanyFields(details);

  return (
    <div>
      <AdminPageHeader
        title="Instellingen"
        description="Je bedrijfsgegevens voor de factuur en je verzendregels."
      />

      {missing.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <TriangleAlert className="h-4 w-4 text-amber-500" />
            Nog niet compleet
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Je kunt pas facturen aanmaken als deze gegevens ingevuld zijn:{" "}
            <span className="font-medium text-foreground">{missing.join(", ")}</span>.
          </p>
        </div>
      )}

      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        <CompanyDetailsForm details={details} />
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        <ShippingSettingsForm shipping={shipping} />
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        <VolumeTiersForm tiers={tiers} />
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        <EmailSettings configured={emailConfigured()} from={process.env.MAIL_FROM ?? null} />
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-medium">Online betalen (Mollie)</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Klanten betalen een factuur direct met iDEAL, Bancontact of creditcard; de bestelling wordt dan
          automatisch op &ldquo;betaald&rdquo; gezet. Zonder Mollie betalen klanten per bankoverschrijving.
        </p>
        {paymentsEnabled() ? (
          <p className="mt-3 text-sm">
            Ingesteld{process.env.MOLLIE_API_KEY?.startsWith("test_") ? " — testmodus (test_-sleutel)" : " — live"}.
          </p>
        ) : (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
            Nog niet ingesteld. Maak een account op mollie.com, zet de API-sleutel in{" "}
            <code>MOLLIE_API_KEY</code> in <code>.env.local</code> en herstart de app.
          </p>
        )}
      </section>
    </div>
  );
}
