import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * Client Supabase côté serveur (composants serveur et server actions).
 * À recréer à chaque requête : il porte les cookies de session.
 */
export async function createClient() {
  // `cookies()` d'abord, et l'ordre n'est pas cosmétique : il signale à Next que
  // la route est dynamique. Valider l'environnement avant lui ferait échouer la
  // tentative de prérendu du build — et donc le build entier — au lieu de
  // laisser la page basculer en rendu à la demande.
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient<Database>(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Appelé depuis un composant serveur : le refresh de session est
            // déjà assuré par le middleware, on peut ignorer.
          }
        },
      },
    },
  );
}
