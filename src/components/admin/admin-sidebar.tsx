"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/actions/auth";
import { Boxes, Building2, ClipboardList, LogOut, Package, Store } from "lucide-react";

const navItems = [
  { href: "/admin/products", label: "Producten", icon: Package },
  { href: "/admin/suppliers", label: "Leveranciers", icon: Boxes },
  { href: "/admin/companies", label: "Bedrijven", icon: Building2 },
  { href: "/admin/orders", label: "Bestellingen", icon: ClipboardList },
];

export function AdminSidebar({ email, name }: { email: string; name: string | null }) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
          CW
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold">CosmeWeb</div>
          <div className="text-xs text-muted-foreground">Beheer</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-border p-3">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        >
          <Store className="h-4 w-4" />
          Naar de website
        </Link>
        <button
          onClick={() => startTransition(() => logoutAction())}
          disabled={isPending}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Uitloggen
        </button>
        <div className="truncate px-3 pt-2 text-xs text-muted-foreground">
          {name || email}
        </div>
      </div>
    </aside>
  );
}
