import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components hangs on the Workers runtime, and the app renders on the
  // client anyway, so it stays off.
  // Covers load straight from AniList's CDN. Never route images through our
  // host's optimizer, so no image-transformation quota can ever be hit.
  images: { unoptimized: true },
  // Let the iPad and phones reach `pnpm dev` over home Wi-Fi.
  allowedDevOrigins: ["*.local", "192.168.*.*", "10.*.*.*"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;

// Gives `next dev` the same bindings (local D1, secrets from .dev.vars) as the deployed Worker.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
