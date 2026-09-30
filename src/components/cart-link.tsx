import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCartWithTotals } from "@/lib/actions/cart";

export async function CartLink() {
  const { items } = await getCartWithTotals();
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <Button asChild variant="ghost" size="sm" className="relative">
      <Link href="/cart">
        <ShoppingCart className="h-4 w-4" />
        Winkelmandje
        {count > 0 && (
          <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1 text-[11px]">
            {count}
          </Badge>
        )}
      </Link>
    </Button>
  );
}
