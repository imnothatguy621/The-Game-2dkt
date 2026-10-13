// Skywarden offline support: keeps the game and its fonts on the device so it runs with no connection.
const VERSION = 'sw-2026-10-13a';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k.startsWith('sw-')).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.pathname.startsWith('/api/')) return;
  if (/huggingface\.co|hf\.co|raw\.githubusercontent\.com/.test(u.host)) return;   // the on-device AI keeps its own model cache
  // the page itself: try the network first so updates arrive, fall back to the saved copy offline
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(VERSION).then(c => c.put('./', cp)); return res; }).catch(() => caches.match('./').then(m => m || caches.match('./index.html'))));
    return;
  }
  // everything else (icons, fonts, libraries): saved copy first, refreshed in the background
  e.respondWith(caches.match(r).then(hit => {
    const net = fetch(r).then(res => { if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(VERSION).then(c => c.put(r, cp)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
