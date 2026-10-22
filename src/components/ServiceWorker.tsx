"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js in production builds. Browsers only allow service workers
 * on HTTPS or localhost, so over plain http on home Wi-Fi this does nothing.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
