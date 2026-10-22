// Kanshou service worker: makes the app open offline and keeps covers cached.
// Pages: network first, cached copy when offline. Build assets: cache first
// (their names are content-hashed). AniList images: cache first, capped.

const VERSION = "v1";
const PAGES = `kanshou-pages-${VERSION}`;
const ASSETS = `kanshou-assets-${VERSION}`;
const IMAGES = `kanshou-images-${VERSION}`;
const MAX_IMAGES = 400;
const IMAGE_HOSTS = ["s4.anilist.co", "img.anili.st"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.add("/")).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  const keep = [PAGES, ASSETS, IMAGES];
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  // Cross-origin images come back opaque (status 0); those are fine to cache too.
  if (res.ok || res.type === "opaque") cache.put(request, res.clone());
  return res;
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request)) ?? (await cache.match("/")) ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  } else if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, ASSETS));
  } else if (IMAGE_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request, IMAGES).finally(() => trim(IMAGES, MAX_IMAGES)));
  }
});
