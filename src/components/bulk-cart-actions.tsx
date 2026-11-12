"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useI18n } from "@/components/i18n-provider";
import {
  addFavoritesToCart,
  quickOrder,
  reorder,
  toggleFavorite,
  type BulkResult,
} from "@/lib/actions/cart";
import { Heart, Loader2, RotateCcw, ShoppingCart } from "lucide-react";

export function ReorderButton({ orderId }: { orderId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await reorder(orderId);
          if (!result.ok) return void toast.error(result.error);
          toast.success(result.message, {
            description: result.notes.join(" "),
            action: { label: t.quickOrder.toCart, onClick: () => router.push("/cart") },
          });
        })
      }
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
      {t.reorder.button}
    </Button>
  );
}

export function QuickOrderForm() {
  const { t } = useI18n();
  const q = t.quickOrder;
  const [text, setText] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await quickOrder(text);
          setResult(r);
          if (r.ok) setText("");
        });
      }}
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder={q.placeholder}
        className="font-mono text-sm"
        aria-label={q.title}
      />
      {result && (
        <Alert variant={result.ok ? "default" : "destructive"}>
          <AlertDescription className="space-y-1">
            <p>{result.ok ? result.message : result.error}</p>
            {result.ok && result.notes.map((n) => <p key={n} className="text-muted-foreground">{n}</p>)}
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending || !text.trim()}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
          {q.submit}
        </Button>
        {result?.ok && (
          <Button asChild variant="outline">
            <Link href="/cart">{q.toCart}</Link>
          </Button>
        )}
      </div>
    </form>
  );
}

export function FavoriteButton({ productId, initial }: { productId: string; initial: boolean }) {
  const { t } = useI18n();
  const [favorite, setFavorite] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const label = favorite ? t.favorites.remove : t.favorites.add;

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={label}
      title={label}
      aria-pressed={favorite}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await toggleFavorite(productId);
          if (!result.ok) return void toast.error(result.error);
          setFavorite(result.favorite);
          toast.success(result.favorite ? t.favorites.added : t.favorites.removed);
        })
      }
    >
      <Heart className={`h-4 w-4 ${favorite ? "fill-rose-500 text-rose-500" : ""}`} />
    </Button>
  );
}

export function AddFavoritesToCartButton() {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await addFavoritesToCart();
          if (!result.ok) return void toast.error(result.error);
          toast.success(result.message, {
            action: { label: t.quickOrder.toCart, onClick: () => router.push("/cart") },
          });
        })
      }
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
      {t.favorites.addAll}
    </Button>
  );
}

