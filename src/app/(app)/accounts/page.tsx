import { Card, SectionLabel } from "@/components/ui";
import type { Profile } from "@/lib/database.types";
import { plural } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";

import { AccountCard, CreateAccount, type Account } from "./account-forms";

export const metadata = { title: "Comptes" };

/**
 * Adresses email des comptes, indexées par identifiant.
 *
 * Elles vivent dans `auth.users`, que la RLS ne montre pas : seule l'API
 * d'administration les donne. Sans clé secrète, la page se contente des
 * profils — c'est dégradé, pas cassé.
 */
async function readEmails(): Promise<Record<string, string>> {
  if (!hasAdminKey()) return {};

  try {
    const admin = createAdminClient();
    // Le groupe compte 15 personnes au plus : une seule page suffit.
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error || !data) return {};

    return Object.fromEntries(data.users.map((user) => [user.id, user.email ?? ""]));
  } catch {
    // Clé invalide ou Supabase injoignable : la liste reste lisible sans les adresses.
    return {};
  }
}

export default async function AccountsPage() {
  const { supabase, profile } = await requireAdmin();

  const [{ data }, emails] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, pseudo, is_admin")
      .order("full_name")
      .overrideTypes<Pick<Profile, "id" | "full_name" | "pseudo" | "is_admin">[]>(),
    readEmails(),
  ]);

  const accounts: Account[] = (data ?? []).map((person) => ({
    ...person,
    email: emails[person.id] ?? "",
  }));

  return (
    <>
      <SectionLabel>{plural(accounts.length, "compte")} dans le groupe</SectionLabel>

      {!hasAdminKey() && (
        <Card className="mb-3">
          <p className="text-sm font-medium">Gestion des identifiants hors service</p>
          <p className="text-ink-soft mt-1 text-[13px]">
            Les noms et pseudos restent modifiables, mais créer un compte, changer une adresse ou
            un mot de passe demande la clé secrète du projet Supabase. Renseigne{" "}
            <code className="text-ink">SUPABASE_SECRET_KEY</code> dans les variables
            d&apos;environnement, puis redéploie.
          </p>
        </Card>
      )}

      {accounts.map((account) => (
        <AccountCard key={account.id} account={account} isSelf={account.id === profile.id} />
      ))}

      <div className="perforation" />
      <SectionLabel>Nouveau compte</SectionLabel>
      <CreateAccount />
    </>
  );
}
