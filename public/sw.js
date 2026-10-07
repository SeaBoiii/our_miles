/* Cache the public application shell only. Private APIs and Supabase never enter Cache Storage. */
const ROOT = new URL(self.registration.scope).pathname;
const BASE_PATH = ROOT.replace(/\/$/, "");
const CACHE_PREFIX = `our-miles-public-${encodeURIComponent(ROOT)}-`;
const CACHE = `${CACHE_PREFIX}v4`;
const PUBLIC_FILES = ["offline.html", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"].map((file) => `${ROOT}${file}`);

function publicAsset(url) {
  return url.origin === self.location.origin && (
    url.pathname.startsWith(`${ROOT}_next/static/`) ||
    url.pathname.startsWith(`${ROOT}icons/`) ||
    url.pathname.startsWith(`${ROOT}fonts/`) ||
    url.pathname.startsWith(`${ROOT}cards/`) ||
    PUBLIC_FILES.includes(url.pathname)
  );
}

async function cacheShell(cache) {
  const response = await fetch(ROOT, { cache: "reload", credentials: "omit" });
  if (!response.ok) throw new Error("The public shell could not be cached.");
  // This HTML contains no wallet data. The browser authenticates before loading private state.
  await cache.put(ROOT, response.clone());
  const html = await response.text();
  const assets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => new URL(match[1].replace(/&amp;/g, "&"), self.registration.scope))
    .filter(publicAsset)
    .map((url) => url.href);
  await Promise.all([...new Set(assets)].map(async (asset) => {
    try {
      const result = await fetch(asset, { cache: "reload", credentials: "omit" });
      if (result.ok) await cache.put(asset, result);
    } catch { /* Runtime caching can fill optional resources after reconnecting. */ }
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PUBLIC_FILES);
    await cacheShell(cache);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => (key.startsWith(CACHE_PREFIX) || (ROOT === "/" && key === "our-miles-public-v1")) && key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(ROOT) || url.pathname === `${BASE_PATH}/api` || url.pathname.startsWith(`${BASE_PATH}/api/`)) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response.ok && url.pathname === ROOT) await cache.put(ROOT, response.clone());
        return response;
      } catch {
        return (url.pathname === ROOT ? await cache.match(ROOT) : undefined) || await cache.match(`${ROOT}offline.html`) || new Response("Our Miles is offline. Reconnect and try again.", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })());
    return;
  }

  if (publicAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === "basic") await cache.put(request, response.clone());
      return response;
    })());
  }
});
