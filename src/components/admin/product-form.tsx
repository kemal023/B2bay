"use client";

import { useState, useTransition, type ReactNode } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { createProduct, updateProduct } from "@/lib/actions/products";
import { Loader2 } from "lucide-react";
import { ShopCategorySelect } from "@/components/admin/shop-category-select";
import { shopCategoryValue } from "@/lib/shop-category";
import { mainLabel, subLabel } from "@/lib/taxonomy.mjs";

type ProductFormValues = {
  id: string;
  name: string;
  ean: string | null;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  mainCategory?: string | null;
  subCategory?: string | null;
  categoryOrigin?: string | null;
  unit: string;
  priceCents: number;
  costPriceCents: number | null;
  stockQty: number;
  minOrderQty: number;
  active: boolean;
};

export function ProductForm({
  trigger,
  product,
}: {
  trigger: ReactNode;
  /** Omit to create a new (manual, no-supplier) product. */
  product?: ProductFormValues;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = product
        ? await updateProduct(product.id, formData)
        : await createProduct(formData);

      if (result.ok) {
        toast.success(product ? "Product bijgewerkt" : "Product toegevoegd");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{product ? "Product bewerken" : "Product toevoegen"}</SheetTitle>
          <SheetDescription>
            {product?.costPriceCents != null
              ? "Dit product komt uit een leverancierskoppeling — de kostprijs en voorraad blijven automatisch actueel. Naam, omschrijving en verkoopprijs pas je hier zelf aan."
              : "Naam, prijs en voorraad zoals de klant ze te zien krijgt."}
          </SheetDescription>
        </SheetHeader>

        <form action={handleSubmit} className="space-y-4 px-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor="name">Naam</Label>
            <Input id="name" name="name" defaultValue={product?.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ean">EAN</Label>
            <Input id="ean" name="ean" defaultValue={product?.ean ?? ""} placeholder="bv. 5901436709251" />
            <p className="text-xs text-muted-foreground">
              Barcode. Uniek per fysiek product — producten met dezelfde EAN
              van verschillende leveranciers worden automatisch gekoppeld.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Omschrijving</Label>
            <Textarea id="description" name="description" defaultValue={product?.description ?? ""} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="imageUrl">Afbeelding-URL</Label>
            <Input id="imageUrl" name="imageUrl" defaultValue={product?.imageUrl ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shopCategory">Categorie in de shop</Label>
            <ShopCategorySelect
              id="shopCategory"
              name="shopCategory"
              autoLabel="Automatisch (via de leverancierscategorie of de naam)"
              defaultValue={
                product?.categoryOrigin === "manual" ? shopCategoryValue(product.mainCategory, product.subCategory) : ""
              }
              className="h-9 w-full text-sm"
            />
            {product?.mainCategory && product.categoryOrigin !== "manual" && (
              <p className="text-xs text-muted-foreground">Staat nu automatisch in: {mainLabel(product.mainCategory, "nl")}{product.subCategory ? ` › ${subLabel(product.subCategory, "nl")}` : ""}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="category">Categorie (leverancier)</Label>
              <Input id="category" name="category" defaultValue={product?.category ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Eenheid</Label>
              <Input id="unit" name="unit" defaultValue={product?.unit ?? "stuk"} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="priceEuro">Verkoopprijs (€)</Label>
              <Input
                id="priceEuro"
                name="priceEuro"
                type="number"
                step="0.01"
                min="0"
                defaultValue={product ? (product.priceCents / 100).toFixed(2) : undefined}
                required
              />
              {product?.costPriceCents != null && (
                <p className="text-xs text-muted-foreground">
                  Kostprijs: € {(product.costPriceCents / 100).toFixed(2)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="stockQty">Voorraad</Label>
              <Input
                id="stockQty"
                name="stockQty"
                type="number"
                min="0"
                defaultValue={product?.stockQty ?? 0}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="minOrderQty">Minimale bestelhoeveelheid</Label>
            <Input
              id="minOrderQty"
              name="minOrderQty"
              type="number"
              min="1"
              defaultValue={product?.minOrderQty ?? 1}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={product?.active ?? true}
              className="h-4 w-4 rounded border-border"
            />
            Zichtbaar in de winkel
          </label>

          <SheetFooter className="px-0">
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {product ? "Wijzigingen opslaan" : "Product opslaan"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
