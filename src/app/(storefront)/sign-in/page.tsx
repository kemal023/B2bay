import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { getDictionary } from "@/lib/i18n/server";
import { LoginForm } from "@/components/auth-forms";

export default async function SignInPage() {
  const { t } = await getDictionary();
  return (
    <AuthShell
      title={t.auth.signInTitle}
      description={t.auth.signInDescription}
      footer={
        <>
          {t.auth.noAccount}{" "}
          <Link
            href="/sign-up"
            className="font-medium text-foreground underline underline-offset-2"
          >
            {t.common.requestBusinessAccount}
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
