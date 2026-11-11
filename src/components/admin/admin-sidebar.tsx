"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/actions/auth";
import {
  Boxes,
  Building2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  SlidersHorizontal,
  Store,
} from "lucide-react";
import { SiteLogo } from "@/components/site-logo";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Package;
  /** Exact-match only, so it doesn't light up for every /admin/* child route. */
  exact?: boolean;
  badge?: number;
};

export function AdminSidebar({
  email,
  name,
  pendingCompanies,
  openOrders,
}: {
  email: string;
  name: string | null;
  pendingCompanies: number;
  openOrders: number;
}) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const sections: { label: string; items: NavItem[] }[] = [
    {
      label: "Overzicht",
      items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }],
    },
    {
      label: "Catalogus",
      items: [
        { href: "/admin/products", label: "Producten", icon: Package },
        { href: "/admin/suppliers", label: "Leveranciers", icon: Boxes },
        { href: "/admin/rules", label: "Regels", icon: SlidersHorizontal },
      ],
    },
    {
      label: "Handel",
      items: [
        { href: "/admin/orders", label: "Bestellingen", icon: ClipboardList, badge: openOrders },
        { href: "/admin/companies", label: "Bedrijven", icon: Building2, badge: pendingCompanies },
      ],
    },
    {
      label: "Beheer",
      items: [{ href: "/admin/settings", label: "Instellingen", icon: Settings }],
    },
  ];

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-border bg-card">
      <Link
        href="/admin"
        className="flex h-16 items-center gap-3 border-b border-border px-5 transition-colors hover:bg-accent/40"
      >
        <SiteLogo height={28} onDark />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Beheer
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto p-3">
        {sections.map((section) => (
          <div key={section.label} className="mb-5 last:mb-0">
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    {active && (
                      <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
                    )}
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[11px] font-semibold tabular-nums text-amber-500">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="mb-2 flex items-center gap-2.5 rounded-md px-3 py-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold uppercase text-accent-foreground">
            {(name || email).slice(0, 2)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-medium">{name || email}</div>
            <div className="text-[10px] text-muted-foreground">Platformbeheerder</div>
          </div>
        </div>
        <Link
          href="/"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <Store className="h-4 w-4" />
          Naar de website
        </Link>
        <button
          onClick={() => startTransition(() => logoutAction())}
          disabled={isPending}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Uitloggen
        </button>
      </div>
    </aside>
  );
}
