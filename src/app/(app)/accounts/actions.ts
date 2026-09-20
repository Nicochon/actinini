"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/session";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";

/**
 * Gestion des comptes, réservée à l'administrateur du groupe.
 *
 * Deux moitiés, deux chemins d'autorisation différents :
 *
 * - **le profil** (nom, pseudo) est une ligne de `profiles`, écrite avec le
 *   client de session et autorisée par la policy `profiles_update_admin` ;
 * - **les identifiants** (email, mot de passe, existence du compte) vivent
 *   dans `auth.users`, hors de portée de la RLS : ils passent par l'API
 *   d'administration de Supabase et la clé secrète.
 *
 * Chaque action re-vérifie le droit d'admin : une server action est joignable
 * par un POST direct, sans passer par l'interface.
 */

export type AccountState = { error?: string; success?: string };

const MIN_PASSWORD = 8;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

/** Message commun quand la clé secrète manque — l'app tourne, pas cette page. */
const NO_KEY: AccountState = {
  error:
    "Les identifiants ne sont pas modifiables : la clé secrète Supabase " +
    "(SUPABASE_SECRET_KEY) n'est pas configurée sur ce déploiement.",
};

/**
 * Nom et pseudo partagent ces règles entre création et édition.
 *
 * Le pseudo accepte les espaces : c'est un nom d'usage affiché tel quel, pas un
 * identifiant technique — « laurie fisse » est un pseudo valide.
 */
function checkIdentity(fullName: string, pseudo: string): string | undefined {
  if (!fullName) return "Le nom est obligatoire.";
  if (!pseudo) return "Le pseudo est obligatoire.";
  return undefined;
}

function checkPassword(password: string, confirmation: string): string | undefined {
  if (password.length < MIN_PASSWORD) {
    return `Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`;
  }
  if (password !== confirmation) return "Les deux mots de passe ne correspondent pas.";
  return undefined;
}

/** Une adresse déjà prise par un autre compte, quel que soit le mot employé. */
function isDuplicateEmail(message: string) {
  return /already|exist|registered|duplicate/i.test(message);
}

// ------------------------------------------------------------------
// Création
// ------------------------------------------------------------------

/**
 * Crée un compte de bout en bout : la ligne `auth.users` et, par le trigger
 * `handle_new_user`, la ligne `profiles` qui va avec.
 *
 * `email_confirm: true` marque l'adresse comme vérifiée sans envoyer de mail
 * de confirmation. C'est voulu : les comptes sont créés par l'admin, qui
 * transmet lui-même le mot de passe, et le SMTP par défaut de Supabase est
 * trop bridé pour qu'une invitation par mail soit fiable.
 */
export async function createAccount(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const { supabase } = await requireAdmin();
  if (!hasAdminKey()) return NO_KEY;

  const email = text(formData, "email").toLowerCase();
  const fullName = text(formData, "full_name");
  const pseudo = text(formData, "pseudo");
  const password = text(formData, "password");
  const confirmation = text(formData, "password_confirm");

  if (!email.includes("@")) return { error: "L'adresse email n'est pas valide." };

  const identityError = checkIdentity(fullName, pseudo);
  if (identityError) return { error: identityError };

  const passwordError = checkPassword(password, confirmation);
  if (passwordError) return { error: passwordError };

  // `pseudo` est unique : sans ce contrôle, c'est le trigger qui échouerait,
  // et Supabase ne renverrait qu'un « Database error creating new user ».
  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("pseudo", pseudo)
    .maybeSingle();
  if (taken) return { error: "Ce pseudo est déjà pris." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // Lues par le trigger `handle_new_user` pour remplir `profiles`.
    user_metadata: { full_name: fullName, pseudo },
  });

  if (error) {
    return {
      error: isDuplicateEmail(error.message)
        ? "Un compte existe déjà avec cette adresse."
        : "Le compte n'a pas pu être créé.",
    };
  }

  revalidatePath("/accounts");
  return { success: `Compte de ${fullName} créé. Transmets-lui son mot de passe.` };
}

// ------------------------------------------------------------------
// Modification
// ------------------------------------------------------------------

/** Nom, pseudo et adresse email d'un compte existant. */
export async function updateAccount(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const { supabase } = await requireAdmin();

  const id = text(formData, "id");
  const fullName = text(formData, "full_name");
  const pseudo = text(formData, "pseudo");
  const email = text(formData, "email").toLowerCase();

  if (!id) return { error: "Compte introuvable." };

  const identityError = checkIdentity(fullName, pseudo);
  if (identityError) return { error: identityError };
  if (email && !email.includes("@")) return { error: "L'adresse email n'est pas valide." };

  // Le profil : écriture ordinaire, autorisée par `profiles_update_admin`.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: fullName, pseudo })
    .eq("id", id);

  if (profileError) {
    // 23505 = violation de la contrainte d'unicité sur `pseudo`.
    return {
      error:
        profileError.code === "23505"
          ? "Ce pseudo est déjà pris."
          : "Le profil n'a pas pu être enregistré.",
    };
  }

  revalidatePath("/accounts");

  if (!email) return { success: "Profil enregistré." };

  // L'adresse : hors RLS, donc via l'API d'administration — et seulement si
  // elle a changé, pour ne pas dépenser un appel à chaque enregistrement.
  if (!hasAdminKey()) {
    return { error: "Profil enregistré, mais l'adresse n'a pas pu l'être : clé secrète absente." };
  }

  const admin = createAdminClient();
  const { data: current } = await admin.auth.admin.getUserById(id);
  if (current?.user?.email === email) return { success: "Profil enregistré." };

  const { error: emailError } = await admin.auth.admin.updateUserById(id, {
    email,
    // Sans cela, l'ancienne adresse resterait active jusqu'à ce que la
    // personne clique un lien de confirmation qu'elle ne recevra pas.
    email_confirm: true,
  });

  if (emailError) {
    return {
      error: isDuplicateEmail(emailError.message)
        ? "Profil enregistré, mais cette adresse est déjà utilisée par un autre compte."
        : "Profil enregistré, mais l'adresse n'a pas pu être modifiée.",
    };
  }

  return { success: "Profil et adresse enregistrés." };
}

/**
 * Pose un nouveau mot de passe, sans passer par la personne concernée.
 *
 * Pas de lien de réinitialisation par mail : il supposerait un SMTP fiable, et
 * l'admin est déjà celui qui distribue les accès de la main à la main.
 */
export async function setPassword(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  await requireAdmin();
  if (!hasAdminKey()) return NO_KEY;

  const id = text(formData, "id");
  const password = text(formData, "password");
  const confirmation = text(formData, "password_confirm");

  if (!id) return { error: "Compte introuvable." };

  const passwordError = checkPassword(password, confirmation);
  if (passwordError) return { error: passwordError };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password });

  if (error) return { error: "Le mot de passe n'a pas pu être modifié." };

  return { success: "Mot de passe modifié. Transmets-le à la personne concernée." };
}

// ------------------------------------------------------------------
// Suppression
// ------------------------------------------------------------------

/**
 * Supprime le compte et tout ce qui lui est rattaché.
 *
 * `profiles` est en cascade sur `auth.users`, et les invitations, votes,
 * remboursements et appareils abonnés sont en cascade sur `profiles` : une
 * seule suppression suffit. Les activités qu'il aurait créées, elles, ne sont
 * pas en cascade — la base refuserait la suppression, d'où le contrôle.
 */
export async function deleteAccount(id: string): Promise<{ error?: string }> {
  const { supabase, profile } = await requireAdmin();
  if (!hasAdminKey()) return NO_KEY;

  if (!id) return { error: "Compte introuvable." };
  if (id === profile.id) {
    return { error: "Tu ne peux pas supprimer ton propre compte d'administrateur." };
  }

  const { count } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("created_by", id);

  if (count && count > 0) {
    return {
      error:
        "Ce compte a créé des activités : supprime-les d'abord, sinon la base " +
        "refuse la suppression.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);

  if (error) return { error: "Le compte n'a pas pu être supprimé." };

  revalidatePath("/accounts");
  revalidatePath("/");
  return {};
}
