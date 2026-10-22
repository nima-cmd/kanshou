import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kanshou 鑑賞",
    short_name: "Kanshou",
    description: "Our anime diary: today's slate, progress, and the log.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0e0d13",
    theme_color: "#0e0d13",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
