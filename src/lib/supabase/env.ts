/**
 * URL et clé publique du projet Supabase.
 *
 * Supabase a renommé la clé anon en « publishable key » et distribue désormais
 * `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` dans son onboarding. Les deux noms
 * sont acceptés pour que la variable copiée depuis le dashboard fonctionne
 * telle quelle, quel que soit l'âge du projet.
 *
 * Les deux sont lues littéralement : Next remplace `process.env.NEXT_PUBLIC_*`
 * à la compilation par analyse statique, un accès dynamique ne serait pas
 * substitué dans le bundle navigateur.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Échoue à l'appel, pas à l'import : un build sans variables reste possible. */
export function supabaseEnv() {
  if (!URL || !KEY) {
    throw new Error(
      "Supabase n'est pas configuré : renseigne NEXT_PUBLIC_SUPABASE_URL et " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }
  return { url: URL, key: KEY };
}
