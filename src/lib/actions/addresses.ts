"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { deliveryAddresses } from "@/db/schema";
import { getAppUserWithCompany } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { isEuCountry } from "@/lib/vat";

export type AddressResult = { ok: true; message: string } | { ok: false; error: string };

export async function addDeliveryAddress(formData: FormData): Promise<AddressResult> {
  const { t } = await getDictionary();
  const user = await getAppUserWithCompany();
  if (!user?.company) return { ok: false, error: t.cart.noCompanyBody };

  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const label = text("label");
  const addressLine = text("addressLine");
  const postalCode = text("postalCode");
  const city = text("city");
  const country = text("country").toUpperCase();
  if (!label) return { ok: false, error: t.addresses.labelRequired };
  if (!addressLine || !postalCode || !city) return { ok: false, error: t.onboarding.addressRequired };
  if (!isEuCountry(country)) return { ok: false, error: t.onboarding.countryInvalid };

  await getDb()
    .insert(deliveryAddresses)
    .values({
      companyId: user.company.id,
      label,
      recipient: text("recipient") || null,
      addressLine,
      postalCode,
      city,
      country,
      phone: text("phone") || null,
    });
  revalidatePath("/dashboard/addresses");
  revalidatePath("/cart");
  return { ok: true, message: t.addresses.saved };
}

export async function deleteDeliveryAddress(id: string): Promise<AddressResult> {
  const { t } = await getDictionary();
  const user = await getAppUserWithCompany();
  if (!user?.company) return { ok: false, error: t.cart.noCompanyBody };
  // Past orders keep their own copy of the address, so deleting is safe.
  await getDb()
    .delete(deliveryAddresses)
    .where(and(eq(deliveryAddresses.id, id), eq(deliveryAddresses.companyId, user.company.id)));
  revalidatePath("/dashboard/addresses");
  revalidatePath("/cart");
  return { ok: true, message: t.addresses.removed };
}
