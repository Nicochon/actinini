/**
 * Service worker — il rend l'app installable, lui donne un écran hors ligne,
 * et reçoit les notifications push. Jamais de page authentifiée en cache.
 *
 * Règle de fond : on ne garde que ce qui est public et immuable. Les pages
 * sont toujours servies par le réseau ; en cas de coupure on affiche /offline
 * plutôt qu'un contenu périmé — ou, pire, la page d'un autre compte sur un
 * téléphone partagé.
 */
// À incrémenter à chaque modification de ce fichier : c'est ce qui force les
// navigateurs déjà équipés à installer la nouvelle version. Sans ça, un
// téléphone gardant la v1 n'aurait aucun gestionnaire `push`.
const VERSION = "v2";
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

/**
 * Réception d'une notification.
 *
 * iOS impose qu'un push aboutisse **toujours** à une notification visible :
 * un seul push silencieux et le système révoque l'abonnement de l'appareil,
 * sans prévenir. D'où le repli sur un texte générique si la charge utile est
 * absente ou illisible, plutôt qu'un `return` discret.
 */
self.addEventListener("push", (event) => {
  let payload = { title: "Nos activités", body: "Du nouveau dans le groupe.", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Charge utile non-JSON : on garde le texte générique.
  }

  event.waitUntil(
    self.registration
      .showNotification(payload.title, {
        body: payload.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        // Regroupe les notifications d'une même activité : la seconde
        // remplace la première au lieu d'empiler deux fois le même sujet.
        tag: payload.url,
        data: { url: payload.url },
      })
      .then(refreshBadge),
  );
});

/**
 * Pastille chiffrée sur l'icône de l'app.
 *
 * Le compte est celui des notifications encore affichées : pas de compteur à
 * stocker, et le chiffre suit ce que l'utilisateur voit réellement dans son
 * centre de notifications.
 *
 * Seul iOS l'affiche — Chrome sur Android n'expose pas `setAppBadge`, mais
 * pose de lui-même une pastille dès qu'une notification n'est pas lue. Le
 * résultat est le même des deux côtés, le chiffre en moins sur Android.
 */
async function refreshBadge() {
  if (!("setAppBadge" in self.navigator)) return;
  try {
    const shown = await self.registration.getNotifications();
    if (shown.length > 0) {
      await self.navigator.setAppBadge(shown.length);
    } else {
      await self.navigator.clearAppBadge();
    }
  } catch {
    // La pastille est un agrément : jamais au prix d'une notification perdue.
  }
}

/**
 * Clic sur une notification : on ramène l'app au premier plan sur la bonne
 * activité, sans ouvrir un second onglet si elle est déjà ouverte.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      for (const client of windows) {
        await client.focus();
        try {
          await client.navigate(target);
        } catch {
          // `navigate` est refusé dans certains contextes (app iOS lancée
          // depuis l'écran d'accueil) : l'app est au premier plan, c'est
          // l'essentiel, l'utilisateur atterrit sur la page courante.
        }
        await refreshBadge();
        return;
      }

      await self.clients.openWindow(target);
      await refreshBadge();
    })(),
  );
});
