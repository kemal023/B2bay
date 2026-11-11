"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCatalogRules, updateSupplierMargin } from "@/lib/actions/rules";
import { Loader2, Save } from "lucide-react";

export function MinStockRuleForm({ minStockQty }: { minStockQty: number }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateCatalogRules(formData);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="minStockQty">Minimale voorraad</Label>
        <Input
          id="minStockQty"
          name="minStockQty"
          type="number"
          min={0}
          step={1}
          defaultValue={minStockQty}
          className="w-32"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Opslaan
      </Button>
    </form>
  );
}

export function SupplierMarginForm({
  supplierId,
  markupPercent,
}: {
  supplierId: string;
  markupPercent: number;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateSupplierMargin(formData);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="flex items-end gap-2">
      <input type="hidden" name="supplierId" value={supplierId} />
      <div className="relative">
        <Input
          name="markupPercent"
          type="number"
          min={0}
          step={1}
          defaultValue={markupPercent}
          className="w-24 pr-7"
          aria-label="Marge in procenten"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          %
        </span>
      </div>
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Toepassen
      </Button>
    </form>
  );
}
