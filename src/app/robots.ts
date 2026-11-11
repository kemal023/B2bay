import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

/** Index the shop; keep accounts, cart, admin and documents out of search results. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/cart", "/dashboard", "/invoices", "/quick-order", "/reset-password"],
    },
    sitemap: siteUrl("/sitemap.xml"),
  };
}
