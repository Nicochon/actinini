/**
 * Service worker minimal — il rend l'app installable et lui donne un écran
 * hors ligne, sans jamais mettre en cache de page authentifiée.
 *
 * Règle de fond : on ne garde que ce qui est public et immuable. Les pages
 * sont toujours servies par le réseau ; en cas de coupure on affiche /offline
 * plutôt qu'un contenu périmé — ou, pire, la page d'un autre compte sur un
 * téléphone partagé.
 */
const VERSION = "v1";
const SHELL = `actinini-shell-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Les server actions et les appels d'authentification sont des POST :
  // jamais interceptés, jamais rejoués.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Supabase est sur une autre origine : on laisse le réseau faire son travail.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
    );
    return;
  }

  // Actifs figés de Next : leur URL porte un hachage, ils ne périment jamais.
  if (url.pathname.startsWith("/_next/static/") || PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(SHELL).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
