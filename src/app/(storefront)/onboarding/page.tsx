import { redirect } from "next/navigation";
import { OnboardingForms } from "@/components/onboarding-forms";
import { getAppUser } from "@/lib/auth";
import { Building2 } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";

export default async function OnboardingPage() {
  const appUser = await getAppUser();
  if (!appUser) redirect("/sign-in");
  if (appUser.companyId) redirect("/dashboard");
  const { t } = await getDictionary();

  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:px-6 lg:py-20">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Building2 className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{t.onboarding.welcome}</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {t.onboarding.intro}
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <OnboardingForms />
      </div>
    </div>
  );
}
