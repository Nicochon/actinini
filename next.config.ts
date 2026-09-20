import type { NextConfig } from "next";

/**
 * En-têtes de sécurité, posés sur toutes les réponses.
 *
 * Aucun ne corrige une faille existante : ce sont des garde-fous, qui limitent
 * ce qu'une erreur future pourrait produire. Volontairement pas de CSP
 * complète ici — elle demande des nonces sur les scripts de Next, et une CSP
 * approximative donne surtout l'illusion d'être protégé.
 */
const securityHeaders = [
  // L'app n'a aucune raison d'être affichée dans le cadre d'un autre site.
  // Sans ça, on peut la superposer, invisible, à une page qui invite à cliquer
  // au bon endroit — un « Je ne viens pas » ou un « Oui, supprimer ».
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },

  // Ne pas divulguer le chemin visité aux sites tiers : une URL d'activité
  // n'a pas à voyager dans un `Referer` vers l'extérieur.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Un fichier servi en `text/plain` ne doit pas être réinterprété comme du
  // script parce que son contenu y ressemble.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Rien ici ne filme, n'écoute ni ne géolocalise.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        /**
         * Le service worker ne doit jamais être servi depuis le cache.
         *
         * Par défaut un navigateur peut garder `sw.js` jusqu'à 24 h : une
         * correction poussée en production n'atteindrait les téléphones que le
         * lendemain. Avec `no-store`, le nouveau worker est récupéré à la
         * première visite. (`updateViaCache: "none"` côté enregistrement dit la
         * même chose ; les deux ensemble couvrent tous les navigateurs.)
         */
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
