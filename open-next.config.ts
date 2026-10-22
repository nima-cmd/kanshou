import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Prerendered pages are served from Workers static assets: no R2 or KV needed.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
