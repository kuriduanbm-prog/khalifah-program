// KHALIFAH PROGRAM - Production PWA Service Worker (v2.8)
const CACHE_NAME = 'khalifah-cache-v2.8';

// Critical local assets required for the app shell to function offline
const PRECACHE_ASSETS = [
  'index.html',
  './index.html',
  './',
  'style.css',
  'app.js',
  'app.js?v=2.8',
  'manifest.json',
  'assets/logo.png',
  'assets/icon-192.png',
  'assets/icon-512.png'
];

// Optional CDN assets (cached individually so failures don't block install)
const OPTIONAL_CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

// Install Event: Safely pre-cache assets without failing if one URL has issues
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[KHALIFAH PWA] Pre-caching local app shell');
      for (const asset of PRECACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[KHALIFAH PWA] Pre-cache item failed (non-fatal):', asset, err);
        }
      }

      // Pre-cache CDN assets asynchronously in background
      for (const cdnUrl of OPTIONAL_CDN_ASSETS) {
        try {
          await cache.add(cdnUrl);
        } catch (err) {
          // CDN cache fail is non-fatal
        }
      }
    })
  );
  self.skipWaiting();
});

// Activate Event: Clear all previous caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[KHALIFAH PWA] Purging outdated cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Bulletproof handler that NEVER leaves the browser hanging
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests or Google Apps Script API calls (pass directly to network)
  if (request.method !== 'GET' || url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    return;
  }

  // 1. NAVIGATION REQUESTS (Opening the PWA, refreshing, or clicking links)
  // Strategy: Network-First with Cache Fallback -> Guaranteed to never show "Site can't be reached"
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          console.log('[KHALIFAH PWA] Network unavailable, serving cached app shell for navigation');
          const cached = await caches.match(request);
          if (cached) return cached;

          // Fallback to index.html if exact request URL didn't match cache key
          const fallback = await caches.match('index.html') || await caches.match('./index.html') || await caches.match('./');
          if (fallback) return fallback;

          // Ultimate fallback Response if cache was cleared
          return new Response(
            '<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>KHALIFAH PROGRAM</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{font-family:sans-serif;text-align:center;padding:2rem;background:#f8fafc;color:#1e293b;}</style></head><body><h2>KHALIFAH PROGRAM</h2><p>กำลังเชื่อมต่อข้อมูล กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วเปิดใหม่อีกครั้ง</p><button onclick="location.reload()" style="padding:0.6rem 1.2rem;background:#0284c7;color:#fff;border:none;border-radius:8px;font-size:1rem;cursor:pointer;">ลองใหม่อีกครั้ง</button></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // 2. STATIC ASSETS (CSS, JS, Images, Fonts, CDNs)
  // Strategy: Stale-While-Revalidate (Serve cached instantly if available, update in background)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
