import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CartLink } from "@/components/cart-link";
import { UserMenu } from "@/components/user-menu";
import { getAppUser } from "@/lib/auth";
import { LayoutDashboard, ShieldCheck } from "lucide-react";

export async function SiteHeader() {
  const user = await getAppUser();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
            CW
          </span>
          <span className="text-lg">CosmeWeb</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <Link href="/products" className="transition-colors hover:text-foreground">
            Producten
          </Link>
          <Link href="/#hoe-werkt-het" className="transition-colors hover:text-foreground">
            Hoe het werkt
          </Link>
          <Link href="/#leveranciers" className="transition-colors hover:text-foreground">
            Leveranciers
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {user.role === "platform_admin" && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin">
                    <ShieldCheck className="h-4 w-4" />
                    Beheer
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <CartLink />
              <UserMenu email={user.email} name={user.name} />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/sign-in">Inloggen</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/sign-up">Zakelijk account aanvragen</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
