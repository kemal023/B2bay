import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex justify-center px-4 py-16">
      <SignUp fallbackRedirectUrl="/onboarding" forceRedirectUrl="/onboarding" />
    </div>
  );
}
