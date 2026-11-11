import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/components/password-reset-forms";
import { getDictionary } from "@/lib/i18n/server";

export default async function ForgotPasswordPage() {
  const { t } = await getDictionary();
  return (
    <AuthShell
      title={t.auth.forgotTitle}
      description={t.auth.forgotDescription}
      footer={
        <Link href="/sign-in" className="font-medium text-foreground underline underline-offset-2">
          {t.auth.backToSignIn}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
