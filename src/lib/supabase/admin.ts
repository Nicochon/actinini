import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/**
 * Client Supabase porteur de la **clé secrète du projet** — à n'utiliser que
 * depuis une server action, jamais dans un composant client.
 *
 * Cette clé ignore la Row Level Security : elle lit et écrit tout, sans
 * `auth.uid()` ni policy. C'est précisément pourquoi le reste de l'app ne
 * l'utilise pas — l'autorisation y est portée par la RLS, et les notifications
 * push passent par des fonctions `security definer` plutôt que par elle.
 *
 * Elle n'est indispensable que pour `auth.users`, la table des identifiants,
 * que Supabase réserve à son API d'administration : créer un compte, changer
 * une adresse ou un mot de passe, supprimer un compte. **Règle du fichier :
 * on ne s'en sert que pour `.auth.admin.*`.** Tout ce qui touche aux tables
 * publiques (dont `profiles`) continue de passer par le client de session, et
 * donc par la RLS, qui reste le garde-fou.
 *
 * Supabase a renommé la clé `service_role` en « secret key » ; les deux noms
 * sont acceptés, comme pour la clé publique (voir `env.ts`).
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * La clé secrète est-elle configurée ?
 *
 * Sans elle l'app tourne normalement : seule la gestion des identifiants est
 * hors service, et la page des comptes le dit au lieu d'échouer. C'est la même
 * discipline que les clés VAPID des notifications.
 */
export function hasAdminKey(): boolean {
  return Boolean(URL && SECRET);
}

export function createAdminClient() {
  if (!URL || !SECRET) {
    throw new Error(
      "La clé secrète Supabase n'est pas configurée : renseigne SUPABASE_SECRET_KEY.",
    );
  }

  return createSupabaseClient<Database>(URL, SECRET, {
    // Ce client ne porte aucune session : pas de cookie à rafraîchir, rien à
    // persister. Sans ces options, supabase-js tenterait d'écrire un stockage
    // qui n'existe pas côté serveur.
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
