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
      <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
        {t.legal.agreePrefix}{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
          {t.legal.terms}
        </Link>{" "}
        {t.legal.and}{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          {t.legal.privacy}
        </Link>
        {t.legal.agreeSuffix}.
      </p>
    </AuthShell>
  );
}
