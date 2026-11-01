// App shell only: hashed Next.js assets and icons. Never caches navigations, API or presigned URLs.
const CACHE = "nodedrive-shell-v1";
const SHELL = /^\/(_next\/static\/|icons\/)/;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET" || url.origin !== self.location.origin || !SHELL.test(url.pathname)) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);

      if (cached) return cached;

      const response = await fetch(event.request);

      if (response.ok) cache.put(event.request, response.clone());

      return response;
    }),
  );
});
