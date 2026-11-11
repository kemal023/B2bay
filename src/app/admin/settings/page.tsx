import { AdminPageHeader } from "@/components/admin/page-header";
import { CompanyDetailsForm } from "@/components/admin/company-details-form";
import { ShippingSettingsForm } from "@/components/admin/shipping-settings-form";
import { getCompanyDetails, missingCompanyFields } from "@/lib/invoicing";
import { getShippingSettings } from "@/lib/shipping";
import { EmailSettings } from "@/components/admin/email-settings";
import { emailConfigured } from "@/lib/email/send";
import { TriangleAlert } from "lucide-react";

export default async function AdminSettingsPage() {
  const [details, shipping] = await Promise.all([getCompanyDetails(), getShippingSettings()]);
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
        <EmailSettings configured={emailConfigured()} from={process.env.MAIL_FROM ?? null} />
      </section>
    </div>
  );
}
