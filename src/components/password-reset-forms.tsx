"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  requestPasswordReset,
  resetPasswordAction,
  type ActionResult,
  type ResetRequestResult,
} from "@/lib/actions/auth";
import { useI18n } from "@/components/i18n-provider";
import { MailCheck } from "lucide-react";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    async (_: ResetRequestResult | null, formData: FormData) => requestPasswordReset(formData),
    null,
  );
  const { t } = useI18n();

  if (state?.ok) {
    return (
      <Alert>
        <MailCheck className="h-4 w-4" />
        <AlertDescription>{t.auth.forgotSent}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t.auth.email}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      {state && !state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t.common.busy : t.auth.sendLink}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(
    async (_: ActionResult, formData: FormData) => resetPasswordAction(formData),
    { ok: true },
  );
  const { t } = useI18n();

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-2">
        <Label htmlFor="password">{t.auth.newPassword}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-xs text-muted-foreground">{t.auth.passwordHint}</p>
      </div>
      {!state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t.common.busy : t.auth.savePassword}
      </Button>
    </form>
  );
}
