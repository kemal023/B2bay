"use client";

import { useCallback, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { startCheckoutSession } from "@/lib/actions/checkout";
import { TriangleAlert } from "lucide-react";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

export function CheckoutClient() {
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    try {
      const { clientSecret } = await startCheckoutSession();
      return clientSecret;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kon checkout niet starten.");
      throw err;
    }
  }, []);

  if (!stripePromise) {
    return (
      <Alert variant="destructive">
        <TriangleAlert className="h-4 w-4" />
        <AlertTitle>Betalingen zijn nog niet geconfigureerd</AlertTitle>
        <AlertDescription>
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ontbreekt in de omgevingsvariabelen.
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <TriangleAlert className="h-4 w-4" />
        <AlertTitle>Checkout mislukt</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
