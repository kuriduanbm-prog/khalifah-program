// KHALIFAH PROGRAM - Production PWA Service Worker (v7.7)
const CACHE_NAME = 'khalifah-cache-v19.12';
const NAV_TIMEOUT_MS = 3000;

// Critical local assets required for the app shell to function offline
const PRECACHE_ASSETS = [
  'index.html',
  './index.html',
  './',
  'style.css',
  'style.css?v=19.12',
  'ui-v8.css?v=19.12',
  'dark.css?v=19.12',
  'ui-v8.js?v=19.12',
  'ai.js?v=19.12',
  'app.js',
  'app.js?v=19.12',
  'manifest.json',
  'assets/logo.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-192.png',
  'assets/icon-maskable-512.png'
];

// Optional CDN assets (cached individually so failures don't block install)
const OPTIONAL_CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

// v19.12 · Vercel (cleanUrls) ตอบ /index.html ด้วยการ redirect ไปที่ /
// Safari/Chrome ไม่ยอมให้ service worker ส่ง response ที่ผ่าน redirect ให้หน้าเว็บ ("Response served by service worker has redirections")
// จึงต้องเก็บ/ส่งเป็น response ใหม่ที่ไม่มีประวัติ redirect เสมอ
async function cleanResponse(res) {
  if (!res || !res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

// Install Event: Safely pre-cache assets without failing if one URL has issues
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[KHALIFAH PWA] Pre-caching local app shell');
      for (const asset of PRECACHE_ASSETS) {
        try {
          const res = await fetch(asset, { cache: 'reload' });
          if (!res || !res.ok) throw new Error('HTTP ' + (res && res.status));
          await cache.put(asset, await cleanResponse(res));
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
  // ไฟล์บอกเวอร์ชัน: ดึงจากเครือข่ายเสมอ เพื่อให้รู้ทันทีเมื่อมีการอัปเดต
  if (url.pathname.endsWith('/version.json')) return;
  // ผู้ช่วย AI (Vercel function): ไม่แคช
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  // 1. NAVIGATION REQUESTS (Opening the PWA, refreshing, or clicking links)
  // Strategy: Network-First with Cache Fallback -> Guaranteed to never show "Site can't be reached"
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    // v19.12 · เน็ตอ่อน/ต่อ Wi-Fi แต่ไม่มีอินเทอร์เน็ต/แพ็กเกจหมด: คำขอค้างนานจนหน้าขาว
    // รอเครือข่ายไม่เกิน 3 วินาที ถ้าไม่ตอบใช้หน้าแอปที่เก็บไว้ในเครื่องทันที (เครือข่ายยังโหลดต่อเบื้องหลังเพื่ออัปเดตแคช)
    const net = fetch(request).then(cleanResponse).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        const copy = networkResponse.clone();
        const copy2 = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => { cache.put(request, copy); if (url.origin === self.location.origin) cache.put('index.html', copy2); });
      }
      return networkResponse;
    });
    event.waitUntil(net.catch(() => {}));
    event.respondWith((async () => {
      const shell = async () => cleanResponse((await caches.match(request)) || (await caches.match('./')) || (await caches.match(request, { ignoreSearch: true })) ||
        (await caches.match('index.html')) || (await caches.match('./index.html')));
      const first = await Promise.race([
        net.then((r) => (r && r.status === 200 ? r : 'bad'), () => 'fail'),
        new Promise((r) => setTimeout(() => r('timeout'), NAV_TIMEOUT_MS))
      ]);
      if (first && typeof first === 'object') return first;
      const cached = await shell();
      if (cached) return cached;
      try { const r = await net; if (r) return r; } catch (e) {}
      return new Response(
        '<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>KHALIFAH PROGRAM</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{font-family:sans-serif;text-align:center;padding:2rem;background:#f8fafc;color:#1e293b;}</style></head><body><h2>KHALIFAH PROGRAM</h2><p>เครื่องนี้ยังไม่มีแอปเก็บไว้สำหรับใช้ตอนไม่มีเน็ต</p><p style="font-size:.9rem;color:#475569">เชื่อมต่ออินเทอร์เน็ตแล้วเปิดแอป 1 ครั้ง หลังจากนั้นจะเปิดและเช็คละหมาดได้แม้ไม่มีเน็ต</p><button onclick="location.reload()" style="padding:0.6rem 1.2rem;background:#0284c7;color:#fff;border:none;border-radius:8px;font-size:1rem;cursor:pointer;">ลองใหม่อีกครั้ง</button></body></html>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    })());
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

// v11.5 · Background Sync: ส่งรูปละหมาด/เช็คชื่อที่ค้างในคิว แม้ผู้ใช้ปิดแอปไปแล้ว (Android/Chrome)
function k8OutboxDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('khalifah-outbox', 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('q')) r.result.createObjectStore('q', { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function k8OutboxFlushSw() {
  const db = await k8OutboxDb();
  const items = await new Promise((res, rej) => { const t = db.transaction('q', 'readonly'); const q = t.objectStore('q').getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); });
  items.sort((a, b) => a.createdAt - b.createdAt);
  let left = 0;
  for (const it of items) {
    let ok = false;
    try {
      let body = it.body; try { const b = JSON.parse(body); if (b.data) { b.data.sentAt = Date.now(); delete b.data.ageMs; } body = JSON.stringify(b); } catch (e) {}
      const resp = await fetch(it.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
      const j = await resp.json();
      ok = !!j && (j.success !== false || (j.code && j.code !== 'AUTH_REQUIRED'));
    } catch (e) { ok = false; }
    if (ok) await new Promise((res) => { const t = db.transaction('q', 'readwrite'); t.objectStore('q').delete(it.id); t.oncomplete = res; t.onerror = res; });
    else { left++; break; }
  }
  if (left) throw new Error('outbox pending'); // ให้เบราว์เซอร์ลองใหม่ภายหลัง
}
self.addEventListener('sync', (event) => {
  if (event.tag === 'k8-outbox') event.waitUntil(k8OutboxFlushSw());
});

// v17.14 · แตะการแจ้งเตือนแล้วเปิด/สลับมาที่แอป
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { try { c.postMessage({ type: 'k8-open-notif' }); } catch (e) {} return c.focus(); } }
    return self.clients.openWindow('./');
  }));
});
