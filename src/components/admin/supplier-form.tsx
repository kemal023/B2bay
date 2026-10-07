"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { createSupplier } from "@/lib/actions/suppliers";
import { ADAPTER_TYPE_OPTIONS } from "@/lib/suppliers/registry";
import { Plug, Plus } from "lucide-react";

const fieldSpecs: { key: string; label: string; defaultValue: string }[] = [
  { key: "fieldSku", label: "SKU / artikelnummer", defaultValue: "sku" },
  { key: "fieldName", label: "Naam", defaultValue: "name" },
  { key: "fieldDescription", label: "Omschrijving", defaultValue: "description" },
  { key: "fieldImageUrl", label: "Afbeelding-URL", defaultValue: "imageUrl" },
  { key: "fieldCategory", label: "Categorie", defaultValue: "category" },
  { key: "fieldUnit", label: "Eenheid", defaultValue: "unit" },
  { key: "fieldPrice", label: "Inkoopprijs (kostprijs)", defaultValue: "price" },
  { key: "fieldCurrency", label: "Valuta", defaultValue: "currency" },
  { key: "fieldStock", label: "Voorraad", defaultValue: "stock" },
  { key: "fieldMinOrderQty", label: "Min. bestelhoeveelheid", defaultValue: "minOrderQty" },
];

export function SupplierForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [adapterType, setAdapterType] = useState("generic_rest");
  const [authType, setAuthType] = useState("none");

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      formData.set("adapterType", adapterType);
      formData.set("authType", authType);
      const result = await createSupplier(formData);
      if (result.ok) {
        toast.success("Leverancier toegevoegd");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Leverancier toevoegen
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" /> Nieuwe leverancier-API koppelen
          </SheetTitle>
          <SheetDescription>
            Kies het type koppeling en vul de gegevens van de leverancier in.
          </SheetDescription>
        </SheetHeader>

        <form action={handleSubmit} className="space-y-6 px-4 pb-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Naam van de leverancier</Label>
              <Input id="name" name="name" placeholder="Maxy" required />
            </div>
            <div className="space-y-2">
              <Label>Type koppeling</Label>
              <Select value={adapterType} onValueChange={setAdapterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADAPTER_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="syncIntervalMinutes">Synchronisatie-interval (minuten)</Label>
              <Input id="syncIntervalMinutes" name="syncIntervalMinutes" type="number" defaultValue={60} min={5} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultMarkupPercent">Standaardmarge voor nieuwe producten (%)</Label>
              <Input id="defaultMarkupPercent" name="defaultMarkupPercent" type="number" defaultValue={30} min={0} />
              <p className="text-xs text-muted-foreground">
                Verkoopprijs = kostprijs + deze marge. Alleen gebruikt bij eerste
                import — daarna pas je prijzen per product aan bij Producten.
              </p>
            </div>
          </div>

          <Separator />

          {adapterType === "annapol_xml" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Annapol levert drie XML-feeds (categorieën, voorraad,
                producten) op hetzelfde account. Vul hier de inloggegevens
                in — de drie feed-URL&apos;s worden automatisch opgebouwd.
              </p>
              <div className="space-y-2">
                <Label htmlFor="annapolUser">E-mailadres (user)</Label>
                <Input id="annapolUser" name="annapolUser" placeholder="naam@bedrijf.nl" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="credential">Hash (API-sleutel)</Label>
                <Input id="credential" name="credential" type="password" autoComplete="off" required />
              </div>
            </div>
          ) : adapterType === "maxy_xml" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Maxy levert één XML-export met Engelse productnamen erin —
                geen vertaling nodig. Vul de klantgegevens van het
                account in; de feed-URL wordt automatisch opgebouwd.
              </p>
              <div className="space-y-2">
                <Label htmlFor="maxyClient">E-mailadres (client)</Label>
                <Input id="maxyClient" name="maxyClient" placeholder="naam@bedrijf.nl" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="credential">Token (API-sleutel)</Label>
                <Input id="credential" name="credential" type="password" autoComplete="off" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxyShop">Shop-ID</Label>
                <Input id="maxyShop" name="maxyShop" defaultValue="1" />
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="baseUrl">API-endpoint (productenlijst)</Label>
                  <Input id="baseUrl" name="baseUrl" placeholder="https://api.maxy.example/v1/products" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="itemsPath">Pad naar productenlijst in de response</Label>
                  <Input id="itemsPath" name="itemsPath" placeholder="bv. data.products (leeg = root array)" />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Authenticatie</Label>
                  <Select value={authType} onValueChange={setAuthType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Geen</SelectItem>
                      <SelectItem value="bearer">Bearer token</SelectItem>
                      <SelectItem value="api_key_header">API-key header (X-Api-Key)</SelectItem>
                      <SelectItem value="basic">Basic auth (gebruiker:wachtwoord)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {authType !== "none" && (
                  <div className="space-y-2">
                    <Label htmlFor="credential">
                      {authType === "basic" ? "gebruiker:wachtwoord" : "API-sleutel / token"}
                    </Label>
                    <Input id="credential" name="credential" type="password" autoComplete="off" />
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-sm font-medium">Veldnamen in de API-response</Label>
                <div className="grid grid-cols-2 gap-3">
                  {fieldSpecs.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Label htmlFor={f.key} className="text-xs text-muted-foreground">
                        {f.label}
                      </Label>
                      <Input id={f.key} name={f.key} defaultValue={f.defaultValue} className="h-8" />
                    </div>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" name="priceIsDecimal" className="h-4 w-4 rounded border-border" />
                  Prijs staat als decimaal getal (bv. 12.50) in plaats van centen
                </label>
              </div>
            </>
          )}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Bezig..." : "Leverancier opslaan"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
