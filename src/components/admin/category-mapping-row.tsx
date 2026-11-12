"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShopCategorySelect } from "@/components/admin/shop-category-select";
import { confirmAllSuggestions, saveCategoryMapping } from "@/lib/actions/categories";

/** One supplier category: where it goes, and a button to confirm a suggestion as is. */
export function CategoryMappingControl({
  id,
  value,
  confirmed,
}: {
  id: string;
  value: string;
  confirmed: boolean;
}) {
  const [current, setCurrent] = useState(value);
  const [isPending, startTransition] = useTransition();

  function save(next: string) {
    startTransition(async () => {
      const result = await saveCategoryMapping(id, next);
      if (result.ok) toast.success("Opgeslagen — de producten verhuizen binnen een paar minuten");
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <ShopCategorySelect
        defaultValue={current}
        autoLabel="Per product op naam indelen"
        disabled={isPending}
        className="h-8 w-80 text-xs"
        onChange={(next) => {
          setCurrent(next);
          save(next);
        }}
      />
      {!confirmed && (
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => save(current)}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Klopt
        </Button>
      )}
    </div>
  );
}

export function ConfirmAllButton({ supplierId, count }: { supplierId: string; count: number }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await confirmAllSuggestions(supplierId);
          if (result.ok) toast.success(`${count} voorstellen bevestigd`);
          else toast.error(result.error);
        })
      }
    >
      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      Alle {count} voorstellen goedkeuren
    </Button>
  );
}
