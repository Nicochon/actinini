import type { MetadataRoute } from "next";

/**
 * Rend l'app installable sur l'écran d'accueil (PWA).
 *
 * `/manifest.webmanifest` doit rester accessible sans session : il est lu
 * avant toute connexion. Voir l'exclusion correspondante dans `src/proxy.ts`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nos activités",
    short_name: "Activités",
    description: "Organiser les sorties du groupe : dates, budget, participants.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F3F4F1",
    theme_color: "#F3F4F1",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android recadre l'icône : la version « maskable » garde le motif
      // dans les 80 % centraux, avec un fond bord à bord.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
