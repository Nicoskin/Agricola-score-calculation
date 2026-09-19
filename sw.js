/* Service worker: сайт полностью работает без интернета.
   VERSION меняется при каждом обновлении сайта — старый кэш удаляется. */
const VERSION = 'v4';
const CORE = 'agricola-core-' + VERSION;
const FONTS = 'agricola-fonts-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CORE);
    await Promise.all(ASSETS.map(a => cache.add(new Request(a, {cache:'reload'})).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CORE && k !== FONTS).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Страница: сначала сеть, чтобы приходили обновления; без сети — из кэша. */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CORE);
        cache.put('./index.html', res.clone());
        return res;
      } catch (err) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  /* Шрифты Google: кладём в отдельный кэш при первом заходе с интернетом. */
  if (FONT_HOSTS.includes(url.host)) {
    e.respondWith((async () => {
      const cache = await caches.open(FONTS);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req.url, {mode:'cors', credentials:'omit'});
        if (res.ok) await cache.put(req, res.clone());
        return res;
      } catch (err) {
        return hit || fetch(req);
      }
    })());
    return;
  }

  /* Свои файлы: сначала кэш, иначе сеть с докладыванием в кэш. */
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const hit = await caches.match(req, {ignoreSearch:true});
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') {
        const cache = await caches.open(CORE);
        cache.put(req, res.clone());
      }
      return res;
    })());
  }
});
