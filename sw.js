/* Navi Go AI service worker: keeps the app shell available offline.
   Strategy: network-first for this site's own files (updates always arrive when online, cached copy when offline).
   Weather, flags, photos and fonts are cross-origin and are never intercepted, so live data is never served from this cache. */
const CACHE="navi-go-v5";
const SHELL=["./","index.html","style.css","data.js","i18n.js","media.js","airports.js","flights.js","weather.js","visa.js","script.js","api.js","extras.js","manifest.webmanifest","assets/logo.png","assets/emblem.png","assets/favicon.png","assets/icon-192.png","assets/icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=="GET"||u.origin!==location.origin||u.pathname.startsWith("/api/"))return;
  e.respondWith(fetch(r).then(res=>{if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy))}return res}).catch(()=>caches.match(r).then(m=>m||caches.match("index.html"))));
});
