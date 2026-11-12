"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateVolumeTiers } from "@/lib/actions/settings";
import type { VolumeTier } from "@/lib/pricing";
import { Loader2, Save } from "lucide-react";

const ROWS = 4;

export function VolumeTiersForm({ tiers }: { tiers: VolumeTier[] }) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await updateVolumeTiers(formData);
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        })
      }
      className="space-y-6"
    >
      <div>
        <h3 className="text-sm font-medium">Staffelkorting</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Korting per orderregel vanaf een aantal stuks, voor alle klanten. Komt bovenop een
          prijsafspraak met een bedrijf. Laat regels leeg om ze uit te schakelen.
        </p>
        <p
          className={`mt-2 text-sm font-medium ${tiers.length ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}
        >
          {tiers.length
            ? `Actief: ${tiers.map((t) => `${t.percent}% vanaf ${t.minQty} stuks`).join(" · ")}`
            : "Nu geen staffelkorting actief."}
        </p>
      </div>

      <div className="max-w-sm space-y-2">
        <div className="grid grid-cols-2 gap-3 text-xs font-medium text-muted-foreground">
          <span>Vanaf aantal</span>
          <span>Korting (%)</span>
        </div>
        {Array.from({ length: ROWS }, (_, i) => (
          <div key={i} className="grid grid-cols-2 gap-3">
            <Input
              name={`minQty${i}`}
              type="number"
              min={2}
              step={1}
              placeholder="bv. 10"
              defaultValue={tiers[i]?.minQty ?? ""}
              aria-label={`Vanaf aantal, regel ${i + 1}`}
            />
            <Input
              name={`percent${i}`}
              type="number"
              min={0.1}
              max={99}
              step={0.1}
              placeholder="bv. 3"
              defaultValue={tiers[i]?.percent ?? ""}
              aria-label={`Korting, regel ${i + 1}`}
            />
          </div>
        ))}
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
