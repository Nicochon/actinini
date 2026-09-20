"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

/**
 * Le `next` de l'URL, ramené à un chemin de ce site — ou la racine.
 *
 * On le fait analyser par le parseur d'URL plutôt que par des tests sur la
 * chaîne, parce que c'est celui du navigateur : lui seul sait que `/\ailleurs`
 * et `/<tabulation>//ailleurs` désignent un autre domaine, là où un
 * `startsWith("//")` les laisse passer. Sans ça, un lien vers notre page de
 * connexion peut déposer quelqu'un sur un site tiers **après** qu'il se soit
 * authentifié — le moment idéal pour lui réclamer à nouveau son mot de passe.
 */
function internalPath(next: string): string {
  const here = "https://actinini.invalid";
  try {
    const url = new URL(next, here);
    return url.origin === here ? `${url.pathname}${url.search}` : "/";
  } catch {
    return "/";
  }
}

/** Connexion email / mot de passe. Les comptes sont créés par l'admin. */
export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!email || !password) {
    return { error: "Renseigne ton email et ton mot de passe." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email ou mot de passe incorrect." };
  }

  // `next` vient de l'URL : on n'accepte qu'un chemin interne.
  redirect(internalPath(next));
}
