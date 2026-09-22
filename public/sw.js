/* DHRUVA offline service worker — cache-first for GETs, network fallback, offline support */
const CACHE = 'dhruva-v1'
const API = '/api/'

self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) {
    if (req.destination === 'image' && url.hostname.includes('tile.openstreetmap.org')) {
      e.respondWith(
        caches.open(CACHE).then(async (cache) => {
          const hit = await cache.match(req)
          if (hit) return hit
          const res = await fetch(req)
          cache.put(req, res.clone())
          return res
        }),
      )
    }
    return
  }

  if (req.url.includes(API)) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        try {
          const res = await fetch(req)
          if (res.ok) cache.put(req, res.clone())
          return res
        } catch {
          const hit = await cache.match(req)
          if (hit) return hit
          return new Response(JSON.stringify({ offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      }),
    )
    return
  }

  // app shell: network-first, then cache
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const res = await fetch(req)
        cache.put(req, res.clone())
        return res
      } catch {
        const hit = await cache.match(req)
        if (hit) return hit
        const fallback = await cache.match('/')
        if (fallback) return fallback
        return new Response('Offline', { status: 503 })
      }
    }),
  )
})