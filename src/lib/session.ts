import { redirect } from "next/navigation";

import type { Profile } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

/**
 * Session courante + profil, pour un composant serveur ou une server action.
 * Redirige vers /login si la session est absente ou orpheline.
 *
 * Le middleware garde déjà les routes ; ce garde-fou sert à obtenir le profil
 * et à protéger les server actions, qui ne passent pas par le middleware.
 */
export async function requireProfile() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  // Compte auth sans ligne profiles : état incohérent, on renvoie à la connexion.
  if (!profile) redirect("/login");

  return { supabase, user, profile };
}
