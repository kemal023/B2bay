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
import { deleteSupplier, toggleSupplierActive, triggerSupplierSync } from "@/lib/actions/suppliers";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";

export function SupplierRowActions({ id, active }: { id: string; active: boolean }) {
  const [isPending, startTransition] = useTransition();

  function sync() {
    startTransition(async () => {
      const result = await triggerSupplierSync(id);
      if (result.ok) {
        toast.success(`${result.productsUpserted ?? 0} producten gesynchroniseerd`);
      } else {
        toast.error(result.error);
      }
    });
  }

  function toggle() {
    startTransition(async () => {
      const result = await toggleSupplierActive(id, !active);
      if (!result.ok) toast.error(result.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteSupplier(id);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={sync} disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Sync
      </Button>
      <Button variant="ghost" size="sm" onClick={toggle} disabled={isPending}>
        {active ? "Deactiveren" : "Activeren"}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isPending} aria-label="Verwijderen">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leverancier verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit verwijdert de leverancier en al hun producten uit de catalogus.
              Deze actie kan niet ongedaan worden gemaakt.
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
