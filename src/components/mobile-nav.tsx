"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SiteLogo } from "@/components/site-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/components/i18n-provider";

export type NavCategory = { slug: string; label: string; subs: { slug: string; label: string }[] };

const linkClass = "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent";

export function MobileNav({
  categories,
  signedIn,
}: {
  categories: NavCategory[];
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t.common.openMenu}>
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="flex items-center justify-between gap-3">
            <SiteLogo height={32} className="dark:rounded-md dark:bg-white dark:px-2 dark:py-1" />
            <span className="sr-only">Cosme International</span>
            <LanguageSwitcher />
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-1 px-3 py-4">
          <Link href="/products" onClick={close} className={linkClass}>
            {t.common.allProducts}
          </Link>
          {signedIn ? (
            <>
              <Link href="/dashboard" onClick={close} className={linkClass}>
                {t.common.dashboard}
              </Link>
              <Link href="/cart" onClick={close} className={linkClass}>
                {t.common.cart}
              </Link>
            </>
          ) : (
            <>
              <Link href="/sign-in" onClick={close} className={linkClass}>
                {t.common.signIn}
              </Link>
              <Link href="/sign-up" onClick={close} className={linkClass}>
                {t.common.requestBusinessAccount}
              </Link>
            </>
          )}

          {categories.length > 0 && (
            <>
              <p className="mt-4 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t.common.categories}
              </p>
              {categories.map((c) => (
                <details key={c.slug} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                    {c.label}
                    {c.subs.length > 0 && <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />}
                  </summary>
                  <div className="mb-1 ml-3 flex flex-col border-l border-border pl-2">
                    <Link
                      href={`/products?cat=${c.slug}`}
                      onClick={close}
                      className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
                    >
                      {t.common.allIn} {c.label}
                    </Link>
                    {c.subs.map((s) => (
                      <Link
                        key={s.slug}
                        href={`/products?cat=${c.slug}&sub=${s.slug}`}
                        onClick={close}
                        className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        {s.label}
                      </Link>
                    ))}
                  </div>
                </details>
              ))}
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
