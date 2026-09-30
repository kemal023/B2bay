import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth-forms";

export default function SignInPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center px-4 py-16 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Inloggen</CardTitle>
          <CardDescription>Log in op je zakelijke account.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Nog geen account?{" "}
            <Link href="/sign-up" className="text-foreground underline">
              Zakelijk account aanvragen
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
