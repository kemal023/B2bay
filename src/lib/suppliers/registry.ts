import type { SupplierAdapter } from "./types";
import { genericRestAdapter } from "./generic-rest";
import { annapolAdapter } from "./annapol";

/**
 * Maps a supplier's `adapterType` (chosen in the admin UI) to the code that
 * knows how to talk to it. "generic_rest" covers any JSON REST API via a
 * configurable field mapping (see generic-rest.ts) — the right default for
 * most suppliers. Some suppliers need bespoke logic (their own XML feed
 * shape, pagination, a non-standard auth handshake); add a new file here
 * and register it under its own adapterType, as done for Annapol below.
 */
export const supplierAdapters: Record<string, SupplierAdapter> = {
  generic_rest: genericRestAdapter,
  annapol_xml: annapolAdapter,
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
  { value: "annapol_xml", label: "Annapol (XML-feeds)" },
];
