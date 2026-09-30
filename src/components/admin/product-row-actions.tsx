"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ProductForm } from "@/components/admin/product-form";
import { deleteProduct, toggleProductActive } from "@/lib/actions/products";
import { Loader2, Pencil, Trash2 } from "lucide-react";

type Product = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  unit: string;
  priceCents: number;
  costPriceCents: number | null;
  stockQty: number;
  minOrderQty: number;
  active: boolean;
};

export function ProductRowActions({ product }: { product: Product }) {
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await toggleProductActive(product.id, !product.active);
      if (!result.ok) toast.error(result.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteProduct(product.id);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
      <ProductForm
        product={product}
        trigger={
          <Button variant="ghost" size="icon" aria-label="Bewerken">
            <Pencil className="h-4 w-4" />
          </Button>
        }
      />
      <Button variant="ghost" size="sm" onClick={toggle} disabled={isPending}>
        {product.active ? "Verbergen" : "Tonen"}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isPending} aria-label="Verwijderen">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Product verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{product.name}&quot; wordt permanent verwijderd uit de catalogus.
              Als dit product uit een leverancierskoppeling komt, kan het bij de
              volgende synchronisatie opnieuw verschijnen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
