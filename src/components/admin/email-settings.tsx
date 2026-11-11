"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendTestEmail } from "@/lib/actions/settings";
import { CheckCircle2, Loader2, Send, TriangleAlert } from "lucide-react";

export function EmailSettings({ configured, from }: { configured: boolean; from: string | null }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">E-mail</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Automatische mails: nieuwe aanmelding en bestelling (naar jou), goedkeuring, factuur,
          verzending en wachtwoord vergeten (naar de klant).
        </p>
      </div>

      {configured ? (
        <p className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          Ingesteld — mails gaan uit als <span className="font-medium">{from}</span>
        </p>
      ) : (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlert className="h-4 w-4 text-amber-500" />
            Nog niet ingesteld — er worden geen mails verstuurd
          </p>
          <p className="mt-1.5 text-muted-foreground">
            Vul <code>SMTP_HOST</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code> en{" "}
            <code>MAIL_FROM</code> in <code>.env.local</code> in en herstart de app. Ook
            wachtwoord vergeten werkt pas daarna.
          </p>
        </div>
      )}

      <Button
        variant="outline"
        disabled={isPending || !configured}
        onClick={() =>
          startTransition(async () => {
            const result = await sendTestEmail();
            if (result.ok) toast.success(result.message);
            else toast.error(result.error);
          })
        }
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Testmail naar mezelf
      </Button>
    </div>
  );
}
