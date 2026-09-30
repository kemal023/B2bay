import { redirect } from "next/navigation";
import { OnboardingForms } from "@/components/onboarding-forms";
import { getAppUser } from "@/lib/auth";

export default async function OnboardingPage() {
  const appUser = await getAppUser();
  if (!appUser) redirect("/sign-in");
  if (appUser.companyId) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Welkom bij CosmeWeb</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Koppel je account aan een bedrijf om te kunnen bestellen.
      </p>
      <div className="mt-8">
        <OnboardingForms />
      </div>
    </div>
  );
}
