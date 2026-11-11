import { revalidatePath } from "next/cache";
import { paymentsEnabled, syncPayment } from "@/lib/payments";

/**
 * Mollie webhook. Mollie posts only the payment id; the status is always
 * fetched from Mollie itself, so a forged call can't mark anything as paid.
 */
export async function POST(req: Request) {
  if (!paymentsEnabled()) return new Response("Not enabled", { status: 404 });
  const form = await req.formData().catch(() => null);
  const id = String(form?.get("id") ?? "");
  if (!/^tr_[A-Za-z0-9]+$/.test(id)) return new Response("Bad request", { status: 400 });

  try {
    await syncPayment(id);
    revalidatePath("/dashboard");
    revalidatePath("/admin/orders");
    return new Response("OK");
  } catch (err) {
    console.error("[mollie] webhook", err);
    // A non-2xx makes Mollie retry later.
    return new Response("Error", { status: 500 });
  }
}
