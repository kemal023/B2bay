"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BillingFields } from "@/components/billing-fields";
import { I18nProvider } from "@/components/i18n-provider";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { recheckVat, updateCompanyBilling } from "@/lib/actions/companies";
import { Loader2, Pencil, RefreshCw } from "lucide-react";

type Company = {
  id: string;
  name: string;
  kvkNumber: string | null;
  billingEmail: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  vatNumber: string | null;
};

export function CompanyEditDialog({ company }: { company: Company }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateCompanyBilling(company.id, formData);
      if (result.ok) {
        toast.success("Bedrijfsgegevens opgeslagen");
        setOpen(false);
      } else toast.error(result.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label="Bewerken">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{company.name}</DialogTitle>
          <DialogDescription>
            Factuurgegevens. Een gewijzigd btw-nummer wordt direct in VIES gecontroleerd.
          </DialogDescription>
        </DialogHeader>
        <I18nProvider locale="nl" t={dictionaries.nl}>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Bedrijfsnaam</Label>
              <Input id="name" name="name" defaultValue={company.name} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="kvkNumber">KVK / handelsregister</Label>
                <Input id="kvkNumber" name="kvkNumber" defaultValue={company.kvkNumber ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingEmail">Facturatie-e-mail</Label>
                <Input
                  id="billingEmail"
                  name="billingEmail"
                  type="email"
                  defaultValue={company.billingEmail ?? ""}
                />
              </div>
            </div>
            <BillingFields defaults={company} />
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Opslaan
            </Button>
          </form>
        </I18nProvider>
      </DialogContent>
    </Dialog>
  );
}

export function RecheckVatButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label="Btw-nummer controleren in VIES"
      title="Btw-nummer controleren in VIES"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await recheckVat(id);
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        })
      }
    >
      <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
    </Button>
  );
}
