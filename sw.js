"use strict";

const CACHE = "multi-delivery-v4.2.0";
const DYNAMIC_CACHE = "multi-delivery-dynamic-v4.2.0";
const SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./suporte.html",
  "./manifest.webmanifest",
  "./assets/favicon.svg",
  "./assets/produto-padrao.svg",
  "./assets/logo-restaurante.svg",
  "./assets/banner1.svg",
  "./css/style.css?v=4.2.0",
  "./css/paginas.css?v=4.2.0",
  "./css/accessibility.css?v=4.2.0",
  "./css/enhancements.css?v=4.2.0",
  "./css/suporte.css?v=4.2.0",
  "./js/app-utils.js?v=4.2.0",
  "./js/config.js?v=4.2.0",
  "./js/monitoring.js?v=4.2.0",
  "./js/notifications.js?v=4.2.0",
  "./js/favorites-sync.js?v=4.2.0",
  "./js/home.js?v=4.2.0",
  "./js/suporte.js?v=4.2.0",
  "./js/site-enhancements.js?v=4.2.0"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function redePrimeiro(request, cacheName, fallback) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || (fallback ? caches.match(fallback) : Response.error());
  }
}

async function cachePrimeiro(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(DYNAMIC_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) return;

  if (event.request.mode === "navigate") {
    event.respondWith(redePrimeiro(event.request, CACHE, "./offline.html"));
    return;
  }

  const destination = event.request.destination;
  if (destination === "style" || destination === "script") {
    // CSS e JS precisam refletir o último deploy; o cache é somente fallback.
    event.respondWith(redePrimeiro(event.request, DYNAMIC_CACHE));
    return;
  }

  if (destination === "image" || destination === "font" || event.request.url.endsWith(".svg")) {
    event.respondWith(cachePrimeiro(event.request));
  }
});

self.addEventListener("push", (event) => {
  let payload = { title: "Multi Delivery", body: "Você tem uma nova atualização.", url: "./perfil.html" };
  try { payload = { ...payload, ...event.data.json() }; } catch { /* Usa mensagem padrão. */ }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "./assets/favicon.svg",
    badge: "./assets/favicon.svg",
    data: { url: payload.url }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || "./perfil.html", self.registration.scope).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
    const aberta = janelas.find((janela) => janela.url === destino);
    return aberta ? aberta.focus() : clients.openWindow(destino);
  }));
});
