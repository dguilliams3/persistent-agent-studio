/**
 * Service Worker for Clio PWA
 *
 * Strategy (rewritten 2026-07-04, RUN-20260704-1520 — mobile stale-bundle fix):
 * - NAVIGATIONS (HTML): network-first with cache fallback. The previous worker
 *   pre-cached '/' and '/index.html' at install under a FIXED cache name and
 *   served them cache-first forever — every client stayed pinned to the bundle
 *   from their first visit, and mobile hard refreshes could not escape it.
 *   HTML must always try the network first.
 * - Hashed immutable assets (/assets/*): cache-first (safe — content-addressed
 *   filenames change on every build).
 * - Other same-origin GETs: network-first with cache fallback.
 * - API calls (workers.dev): never intercepted, never cached.
 *
 * BUILD RULE: the root `pnpm build` pipeline stamps CACHE_VERSION in dist/sw.js
 * using the current app build id. Keep the placeholder here; do NOT hand-bump it.
 * Old caches are purged on activate.
 */

const CACHE_VERSION = '__CACHE_VERSION__';

// Install: take over immediately. No shell pre-caching — the shell is cached
// on first successful navigation by the network-first handler below.
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate: purge every cache that isn't the current version (including the
// legacy fixed-name 'clio-v1' that pinned stale bundles), then claim clients.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Non-GET: never intercept.
  if (request.method !== 'GET') return;

  // API calls: network only, never cached.
  if (url.hostname.includes('workers.dev')) return;

  // Navigations (HTML): NETWORK-FIRST. Cache the fresh shell for offline use;
  // fall back to the cached shell only when the network is unreachable.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) => cached || caches.match('/index.html')
          )
        )
    );
    return;
  }

  // Hashed immutable assets: cache-first (filenames are content-addressed).
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else same-origin: network-first with cache fallback.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(
          (cached) => cached || new Response('Offline', { status: 503 })
        )
      )
  );
});
