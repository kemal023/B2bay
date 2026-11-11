/** A delivery address as stored on an order (frozen at order time). */
export type DeliverySnapshot = {
  label: string;
  recipient: string | null;
  addressLine: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string | null;
};

type CompanyAddress = {
  name: string;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
};

/** The company's billing address used as delivery address (the default). */
export function billingAsDelivery(company: CompanyAddress): DeliverySnapshot | null {
  if (!company.addressLine || !company.postalCode || !company.city) return null;
  return {
    label: company.name,
    recipient: null,
    addressLine: company.addressLine,
    postalCode: company.postalCode,
    city: company.city,
    country: company.country,
    phone: null,
  };
}

/** Where an order goes: its own delivery address, else the billing address. */
export function deliveryFor(order: {
  deliveryAddress: unknown;
  company: CompanyAddress;
}): DeliverySnapshot | null {
  return (order.deliveryAddress as DeliverySnapshot | null) ?? billingAsDelivery(order.company);
}
