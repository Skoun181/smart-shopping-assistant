import { assets, immutable } from '$app/manifest';
import { version } from '$app/env';
import { self as worker } from '$app/service-worker';

const CACHE = 'shopping-static-' + version;
const ASSETS = new Set([...assets, ...immutable].map((asset) => asset.path));

worker.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([...ASSETS])));
  worker.skipWaiting();
});
worker.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(async (keys) => {
    await Promise.all(keys.filter((key) => key.startsWith('shopping-static-') && key !== CACHE).map((key) => caches.delete(key)));
    await worker.clients.claim();
  }));
});
worker.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Never cache API calls, HTML, auth cookies, sessions or private user data.
  if (event.request.method !== 'GET' || url.origin !== worker.location.origin || !ASSETS.has(url.pathname)) return;
  event.respondWith(caches.match(event.request).then((hit) => hit ?? fetch(event.request)));
});
