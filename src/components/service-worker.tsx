"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker, condition de l'installation sur Android et de
 * la réception des notifications partout.
 *
 * Le navigateur l'ignore hors HTTPS (localhost excepté) : en développement
 * sur une IP locale, l'app reste utilisable, simplement pas installable.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // `updateViaCache: "none"` : le fichier `sw.js` est revérifié auprès du
    // serveur à chaque enregistrement, jamais relu depuis le cache HTTP. Sans
    // ça, une version corrigée du worker peut mettre 24 h à atteindre un
    // téléphone.
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
      // Un enregistrement raté ne doit rien casser : l'app fonctionne sans.
    });

    /**
     * Ouvrir l'app vaut « j'ai lu » : on efface la pastille de l'icône et on
     * retire les notifications encore posées dans le centre de notifications.
     *
     * Sans ce ménage, la pastille resterait jusqu'à ce que l'utilisateur
     * balaie chaque notification à la main — et le compteur, calculé dans
     * `sw.js` à partir des notifications affichées, repartirait de travers au
     * push suivant.
     */
    const markAsRead = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        navigator.clearAppBadge?.();
        const registration = await navigator.serviceWorker.ready;
        const shown = await registration.getNotifications();
        for (const notification of shown) notification.close();
      } catch {
        // Aucune conséquence : au pire la pastille s'attarde.
      }
    };

    markAsRead();
    document.addEventListener("visibilitychange", markAsRead);
    return () => document.removeEventListener("visibilitychange", markAsRead);
  }, []);

  return null;
}
