import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { getDictionary } from "@/lib/i18n/server";
import { RegisterForm } from "@/components/auth-forms";

export default async function SignUpPage() {
  const { t } = await getDictionary();
  return (
    <AuthShell
      title={t.auth.signUpTitle}
      description={t.auth.signUpDescription}
      footer={
        <>
          {t.auth.haveAccount}{" "}
          <Link
            href="/sign-in"
            className="font-medium text-foreground underline underline-offset-2"
          >
            {t.common.signIn}
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
