"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker, condition de l'installation sur Android.
 * Le navigateur l'ignore hors HTTPS (localhost excepté) : en développement
 * sur une IP locale, l'app reste utilisable, simplement pas installable.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Un enregistrement raté ne doit rien casser : l'app fonctionne sans.
    });
  }, []);

  return null;
}
