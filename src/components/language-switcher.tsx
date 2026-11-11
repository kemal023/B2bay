"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { setLocale } from "@/lib/actions/locale";
import { LOCALES } from "@/lib/i18n/config";
import { useI18n } from "@/components/i18n-provider";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={t.common.language}
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-background p-0.5 text-xs font-medium",
        isPending && "opacity-60",
        className,
      )}
    >
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={code === locale}
          disabled={isPending || code === locale}
          onClick={() =>
            startTransition(async () => {
              await setLocale(code);
              router.refresh();
            })
          }
          className={cn(
            "rounded px-2 py-0.5 uppercase transition-colors",
            code === locale
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
