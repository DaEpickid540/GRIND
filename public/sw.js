// Bump this on every deploy that should invalidate old runtime caches.
const CACHE = "grind-v2";

// Minimal app-shell precache. Vite emits content-hashed bundle filenames
// (dist/assets/index-XXXX.js) that change every build, so we deliberately
// do NOT hardcode the JS/CSS bundle here — that list goes stale the moment
// a new build ships and the SW would keep serving dead references. Instead
// the fetch handler below caches-as-you-go: every successful same-origin GET
// (including the hashed bundle, fonts, and images) gets written into the
// runtime cache the first time it's fetched, so the full app is available
// offline after one normal page load.
const SHELL = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let cross-origin (APIs, CDNs) pass through untouched

  // SPA navigations: network-first, fall back to cached index.html so
  // deep-ish reloads still work offline (routing is client-side state, not URL-based).
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match("/index.html")))
    );
    return;
  }

  // Everything else (hashed JS/CSS bundles, images, fonts): network-first,
  // cache successful responses as they come in, fall back to cache when offline.
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

// Push notifications
self.addEventListener("push", e => {
  const data = e.data?.json() || { title: "GRIND", body: "Don't break your streak!" };
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: "/icon-192.png", badge: "/icon-192.png",
    data: { url: "/" }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || "/"));
});
