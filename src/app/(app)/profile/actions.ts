"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";

export type ProfileState = { error?: string; success?: string };

/**
 * Nom, pseudo et infos de remboursement.
 *
 * `is_admin` est hors de portée : le privilège est retiré en base. Les infos
 * de remboursement, elles, ne sont modifiables que d'ici — un trigger refuse
 * qu'on touche à celles de quelqu'un d'autre, fût-on l'admin.
 */
export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const { supabase, profile } = await requireProfile();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const pseudo = String(formData.get("pseudo") ?? "").trim();
  const paymentInfo = String(formData.get("payment_info") ?? "").trim();

  if (!fullName || !pseudo) return { error: "Le nom et le pseudo sont obligatoires." };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, pseudo, payment_info: paymentInfo || null })
    .eq("id", profile.id);

  if (error) {
    // 23505 = violation de la contrainte d'unicité sur `pseudo`.
    return {
      error: error.code === "23505" ? "Ce pseudo est déjà pris." : "Le profil n'a pas pu être enregistré.",
    };
  }

  revalidatePath("/profile");
  return { success: "Profil enregistré." };
}

/** Email et/ou mot de passe, via Supabase Auth. */
export async function updateCredentials(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const { supabase, user } = await requireProfile();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("password_confirm") ?? "");

  const emailChanged = email && email !== user.email;

  if (!emailChanged && !password) {
    return { error: "Rien à modifier." };
  }
  if (password && password.length < 8) {
    return { error: "Le mot de passe doit faire au moins 8 caractères." };
  }
  if (password && password !== confirmation) {
    return { error: "Les deux mots de passe ne correspondent pas." };
  }

  const { error } = await supabase.auth.updateUser({
    ...(emailChanged ? { email } : {}),
    ...(password ? { password } : {}),
  });

  if (error) return { error: "Les identifiants n'ont pas pu être modifiés." };

  return {
    success: emailChanged
      ? "Un lien de confirmation a été envoyé à la nouvelle adresse."
      : "Mot de passe modifié.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
