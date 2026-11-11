"use server";

import { revalidatePath } from "next/cache";
import { isPlatformAdmin } from "@/lib/auth";
import { saveCompanyDetails, type CompanyDetails } from "@/lib/invoicing";
import { saveShippingSettings } from "@/lib/shipping";

export type SettingsActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function updateCompanyDetails(
  formData: FormData,
): Promise<SettingsActionResult> {
  try {
    if (!(await isPlatformAdmin())) throw new Error("Geen toegang.");

    const text = (key: string) => String(formData.get(key) ?? "").trim();
    const paymentTermDays = Number(formData.get("paymentTermDays") ?? 14);
    const vatRatePercent = Number(formData.get("vatRatePercent") ?? 21);

    if (!Number.isFinite(paymentTermDays) || paymentTermDays < 0) {
      return { ok: false, error: "Betaaltermijn moet 0 of hoger zijn." };
    }
    if (!Number.isFinite(vatRatePercent) || vatRatePercent < 0 || vatRatePercent > 100) {
      return { ok: false, error: "Btw-percentage moet tussen 0 en 100 liggen." };
    }

    const details: CompanyDetails = {
      legalName: text("legalName"),
      addressLine: text("addressLine"),
      postalCode: text("postalCode"),
      city: text("city"),
      country: text("country") || "Nederland",
      kvkNumber: text("kvkNumber"),
      vatNumber: text("vatNumber"),
      iban: text("iban"),
      bic: text("bic"),
      email: text("email"),
      phone: text("phone"),
      paymentTermDays: Math.floor(paymentTermDays),
      vatRatePercent: Math.round(vatRatePercent),
    };

    await saveCompanyDetails(details);

    revalidatePath("/admin/settings");
    return { ok: true, message: "Bedrijfsgegevens opgeslagen." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}

export async function updateShippingSettings(
  formData: FormData,
): Promise<SettingsActionResult> {
  try {
    if (!(await isPlatformAdmin())) throw new Error("Geen toegang.");

    const enabled = formData.get("freeShippingEnabled") === "on";
    const thresholdEuro = Number(String(formData.get("freeShippingThresholdEuro") ?? "").replace(",", "."));

    if (enabled && (!Number.isFinite(thresholdEuro) || thresholdEuro <= 0)) {
      return { ok: false, error: "Vul een drempelbedrag groter dan 0 in." };
    }

    await saveShippingSettings({
      freeShippingThresholdCents: enabled ? Math.round(thresholdEuro * 100) : null,
    });

    revalidatePath("/", "layout");
    return {
      ok: true,
      message: enabled ? "Gratis verzending opgeslagen." : "Gratis verzending uitgeschakeld.",
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Onbekende fout." };
  }
}
