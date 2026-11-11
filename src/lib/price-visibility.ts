import type { AppCompany, AppUser } from "@/lib/auth";

/**
 * Wholesale prices are only for verified business customers, so the gate is
 * an *approved* company — not merely having signed up, which anyone off the
 * street can do. The three states exist so the storefront can explain why a
 * price is hidden instead of showing the same message to a prospect and to a
 * customer who is waiting on verification.
 */
export type PriceAccess = "visible" | "signed-out" | "pending";

export function priceAccessFor(
  user: (AppUser & { company: AppCompany | null }) | null,
): PriceAccess {
  if (!user) return "signed-out";
  // Staff browse the storefront to check their own catalogue.
  if (user.role === "platform_admin") return "visible";
  if (user.company?.status === "approved") return "visible";
  return "pending";
}
