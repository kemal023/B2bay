import Link from "next/link";
import { BadgeCheck, FileCheck2, ShieldCheck } from "lucide-react";
import { SiteLogo } from "@/components/site-logo";
import { getDictionary } from "@/lib/i18n/server";

const POINT_ICONS = [BadgeCheck, ShieldCheck, FileCheck2];

export async function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const { t } = await getDictionary();
  const points = t.auth.shellPoints.map((text, i) => ({ icon: POINT_ICONS[i], text }));
  return (
    <div className="mx-auto grid max-w-5xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-20">
      <div className="order-2 hidden lg:order-1 lg:block">
        <Link href="/" className="flex items-center" aria-label="Cosme International">
          <SiteLogo height={38} className="dark:rounded-md dark:bg-white dark:px-2 dark:py-1" />
        </Link>
        <h2 className="mt-8 text-2xl font-semibold leading-snug tracking-tight">
          {t.auth.shellTitle}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t.auth.shellBody}
        </p>
        <ul className="mt-8 space-y-4">
          {points.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="pt-1 text-muted-foreground">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="order-1 w-full lg:order-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
          <div className="mt-6">{children}</div>
          <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}
