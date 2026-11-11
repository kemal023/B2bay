"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCompanyDetails } from "@/lib/actions/settings";
import type { CompanyDetails } from "@/lib/invoicing";
import { Loader2, Save } from "lucide-react";

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  type = "text",
  required,
  min,
  max,
}: {
  name: keyof CompanyDetails;
  label: string;
  defaultValue: string | number;
  placeholder?: string;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        min={min}
        max={max}
      />
    </div>
  );
}

export function CompanyDetailsForm({ details }: { details: CompanyDetails }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateCompanyDetails(formData);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-8">
      <div>
        <h3 className="text-sm font-medium">Bedrijf</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field name="legalName" label="Bedrijfsnaam" defaultValue={details.legalName} placeholder="CosmeWeb B.V." required />
          <Field name="email" label="E-mailadres" defaultValue={details.email} placeholder="info@cosmeweb.nl" type="email" />
          <Field name="addressLine" label="Adres" defaultValue={details.addressLine} placeholder="Straatnaam 12" required />
          <Field name="phone" label="Telefoonnummer" defaultValue={details.phone} placeholder="+31 6 12345678" />
          <Field name="postalCode" label="Postcode" defaultValue={details.postalCode} placeholder="1234 AB" required />
          <Field name="city" label="Plaats" defaultValue={details.city} placeholder="Amsterdam" required />
          <Field name="country" label="Land" defaultValue={details.country} placeholder="Nederland" />
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-sm font-medium">Fiscale gegevens</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Deze staan verplicht op elke factuur.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field name="kvkNumber" label="KVK-nummer" defaultValue={details.kvkNumber} placeholder="12345678" required />
          <Field name="vatNumber" label="Btw-nummer" defaultValue={details.vatNumber} placeholder="NL123456789B01" required />
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-sm font-medium">Betaling</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field name="iban" label="IBAN" defaultValue={details.iban} placeholder="NL00 BANK 0123 4567 89" required />
          <Field name="bic" label="BIC" defaultValue={details.bic} placeholder="ABNANL2A" />
          <Field
            name="paymentTermDays"
            label="Betaaltermijn (dagen)"
            defaultValue={details.paymentTermDays}
            type="number"
            min={0}
          />
          <Field
            name="vatRatePercent"
            label="Btw-percentage"
            defaultValue={details.vatRatePercent}
            type="number"
            min={0}
            max={100}
          />
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Opslaan
        </Button>
      </div>
    </form>
  );
}
