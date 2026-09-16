import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
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
