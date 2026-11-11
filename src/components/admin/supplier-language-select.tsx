"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { selectClassName } from "@/components/billing-fields";
import { setSupplierLanguage } from "@/lib/actions/suppliers";
import { SOURCE_LANGUAGES } from "@/lib/source-languages";

export function SupplierLanguageSelect({ id, value }: { id: string; value: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <select
      aria-label="Taal van de productteksten"
      defaultValue={value}
      disabled={isPending}
      className={`${selectClassName} h-8 w-44 text-xs`}
      onChange={(e) => {
        const language = e.target.value;
        startTransition(async () => {
          const result = await setSupplierLanguage(id, language);
          if (result.ok) toast.success("Taal opgeslagen — de vertaler pakt de producten opnieuw op");
          else toast.error(result.error);
        });
      }}
    >
      {SOURCE_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
