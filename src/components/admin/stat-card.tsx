import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: "default" | "warning";
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            tone === "warning"
              ? "bg-amber-500/15 text-amber-500"
              : "bg-accent text-accent-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
        {href && (
          <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
        )}
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </>
  );

  const className =
    "group rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-foreground/20";

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
