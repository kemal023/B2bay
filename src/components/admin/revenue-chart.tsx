import { formatPriceCents } from "@/lib/format";
import type { MonthRow } from "@/lib/reports";

const monthLabel = (month: string, style: "short" | "long") =>
  new Intl.DateTimeFormat("nl-NL", style === "long" ? { month: "long", year: "numeric" } : { month: "short" }).format(
    new Date(`${month}-01T12:00:00`),
  );

/**
 * Net revenue per month as thin bars. Server-rendered, no chart library:
 * hovering or focusing a bar shows its month, revenue, margin and orders.
 * The same numbers are in the table below the chart.
 */
export function RevenueChart({ data }: { data: MonthRow[] }) {
  const max = Math.max(...data.map((d) => d.revenueCents), 1);

  return (
    <figure aria-label="Omzet per maand (excl. btw)">
      <div className="text-xs text-muted-foreground">{formatPriceCents(max)}</div>
      <div className="relative mt-1 h-48 border-b border-border">
        {/* Recessive gridlines at 50% and 100%. */}
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-border/70" />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border/70" />
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {data.map((d) => {
            const pct = (d.revenueCents / max) * 100;
            return (
              <div
                key={d.month}
                tabIndex={0}
                className="group relative flex h-full flex-1 items-end justify-center outline-none"
                aria-label={`${monthLabel(d.month, "long")}: ${formatPriceCents(d.revenueCents)}`}
              >
                <div
                  className="w-full max-w-10 rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80"
                  style={{ height: d.revenueCents > 0 ? `max(${pct}%, 2px)` : "0" }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-max -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md group-hover:block group-focus-visible:block">
                  <div className="font-medium">{monthLabel(d.month, "long")}</div>
                  <div className="tabular-nums">Omzet {formatPriceCents(d.revenueCents)}</div>
                  {d.marginCents != null && (
                    <div className="tabular-nums text-muted-foreground">
                      Marge {formatPriceCents(d.marginCents)}
                    </div>
                  )}
                  <div className="text-muted-foreground">{d.orders} bestelling(en)</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[2px]">
        {data.map((d) => (
          <span key={d.month} className="flex-1 text-center text-[11px] text-muted-foreground">
            {monthLabel(d.month, "short")}
          </span>
        ))}
      </div>
    </figure>
  );
}
