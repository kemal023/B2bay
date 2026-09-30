import type { SupplierAdapter } from "./types";
import { genericRestAdapter } from "./generic-rest";

/**
 * Maps a supplier's `adapterType` (chosen in the admin UI) to the code that
 * knows how to talk to it. "generic_rest" covers any JSON REST API via a
 * configurable field mapping (see generic-rest.ts) and is the right default
 * for Maxy, Annapol, or any future supplier — until one of them needs
 * bespoke logic (pagination, XML, a custom auth handshake, etc.), in which
 * case add a new file here and register it under its own adapterType.
 */
export const supplierAdapters: Record<string, SupplierAdapter> = {
  generic_rest: genericRestAdapter,
};

export function getSupplierAdapter(adapterType: string): SupplierAdapter {
  const adapter = supplierAdapters[adapterType];
  if (!adapter) {
    throw new Error(`Unknown supplier adapter type: "${adapterType}"`);
  }
  return adapter;
}

/** Adapter types selectable in the admin "add supplier" form. */
export const ADAPTER_TYPE_OPTIONS = [
  { value: "generic_rest", label: "Generieke JSON REST-API" },
];
