"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

/** Browser print dialog doubles as "save as PDF" on every major platform. */
export function PrintButton() {
  return (
    <Button onClick={() => window.print()} size="sm">
      <Printer className="h-4 w-4" />
      Afdrukken / opslaan als PDF
    </Button>
  );
}
