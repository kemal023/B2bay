"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setCompanyStatus } from "@/lib/actions/companies";
import { Loader2 } from "lucide-react";

export function CompanyStatusActions({
  id,
  status,
}: {
  id: string;
  status: "pending" | "approved" | "suspended";
}) {
  const [isPending, startTransition] = useTransition();

  function set(next: "pending" | "approved" | "suspended") {
    startTransition(async () => {
      const result = await setCompanyStatus(id, next);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex items-center gap-1">
      {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
      {status !== "approved" && (
        <Button size="sm" onClick={() => set("approved")} disabled={isPending}>
          Goedkeuren
        </Button>
      )}
      {status !== "suspended" && (
        <Button size="sm" variant="outline" onClick={() => set("suspended")} disabled={isPending}>
          Opschorten
        </Button>
      )}
      {status === "suspended" && (
        <Button size="sm" variant="outline" onClick={() => set("pending")} disabled={isPending}>
          Heropenen
        </Button>
      )}
    </div>
  );
}
