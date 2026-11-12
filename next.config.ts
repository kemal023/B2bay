import type { NextConfig } from "next";

/**
 * Sent with every response. No full Content-Security-Policy: Next's inline
 * scripts would need nonces on every page; frame-ancestors alone covers the
 * clickjacking case, the rest stops content sniffing and referrer leaks.
 */
const securityHeaders = [
  // Nobody may show the shop inside a frame (clickjacking).
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites see at most our domain, never the page a customer came from.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Browsers only honour this over HTTPS, so it is harmless on localhost and
  // takes effect once the shop runs on its domain.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Produces a minimal standalone server (only the files a Docker image needs)
  // instead of requiring the full node_modules tree at runtime.
  output: "standalone",
  // Don't advertise the framework.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
