import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal standalone server (only the files a Docker image needs)
  // instead of requiring the full node_modules tree at runtime.
  output: "standalone",
};

export default nextConfig;
