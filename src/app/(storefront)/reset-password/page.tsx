import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ResetPasswordForm } from "@/components/password-reset-forms";
import { isResetTokenValid } from "@/lib/auth/password-reset";
import { getDictionary } from "@/lib/i18n/server";
import { TriangleAlert } from "lucide-react";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ token = "" }, { t }] = await Promise.all([searchParams, getDictionary()]);
  const valid = token ? await isResetTokenValid(token) : false;

  return (
    <AuthShell
      title={t.auth.resetTitle}
      description={t.auth.resetDescription}
      footer={
        <Link href="/sign-in" className="font-medium text-foreground underline underline-offset-2">
          {t.auth.backToSignIn}
        </Link>
      }
    >
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-4">
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertDescription>{t.auth.resetInvalid}</AlertDescription>
          </Alert>
          <Button asChild variant="outline" className="w-full">
            <Link href="/forgot-password">{t.auth.requestNewLink}</Link>
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
