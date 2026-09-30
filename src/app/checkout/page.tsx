import { redirect } from "next/navigation";
import { CheckoutClient } from "@/components/checkout-client";
import { getAppUserWithCompany } from "@/lib/auth";
import { getCartWithTotals } from "@/lib/actions/cart";

export default async function CheckoutPage() {
  const [user, { items }] = await Promise.all([
    getAppUserWithCompany(),
    getCartWithTotals(),
  ]);

  if (!user?.company || user.company.status !== "approved") {
    redirect("/cart");
  }
  if (items.length === 0) {
    redirect("/cart");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Checkout</h1>
      <CheckoutClient />
    </div>
  );
}
