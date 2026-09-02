import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf les fichiers statiques, les images, et les
     * ressources d'installation de la PWA. Le manifeste et le service worker
     * sont lus sans session : les faire passer par le garde les redirigerait
     * vers /login, et l'installation échouerait.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
