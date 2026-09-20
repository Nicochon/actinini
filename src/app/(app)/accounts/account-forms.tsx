"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { AddButton, Card, Field, FormError, PrimaryButton } from "@/components/ui";
import type { Profile } from "@/lib/database.types";
import { displayName } from "@/lib/format";

import {
  createAccount,
  deleteAccount,
  setPassword,
  updateAccount,
  type AccountState,
} from "./actions";

/** Un compte tel que la page le fournit : son profil, plus son adresse. */
export type Account = Pick<Profile, "id" | "full_name" | "pseudo" | "is_admin"> & {
  email: string;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : label}
    </PrimaryButton>
  );
}

function Feedback({ state }: { state: AccountState }) {
  if (state.error) return <FormError>{state.error}</FormError>;
  if (state.success) {
    return (
      <p role="status" className="text-sage-deep bg-sage-pale mt-4 rounded-md px-3 py-2 text-[13px]">
        {state.success}
      </p>
    );
  }
  return null;
}

/** Petit bouton de barre d'actions, sous l'en-tête d'un compte. */
function PanelButton({
  active,
  tone = "ink",
  onClick,
  children,
}: {
  active: boolean;
  tone?: "ink" | "brick";
  onClick: () => void;
  children: ReactNode;
}) {
  const palette =
    tone === "brick"
      ? "text-brick-deep hover:border-brick"
      : "text-ink-soft hover:border-ink-soft";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={`rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors ${
        active ? "border-ink-soft text-ink" : `border-line ${palette}`
      }`}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------
// Création
// ------------------------------------------------------------------

/** Champs du formulaire de création, conservés entre deux tentatives. */
const EMPTY = { email: "", full_name: "", pseudo: "", password: "", password_confirm: "" };

/**
 * Formulaire de création, replié par défaut : la page sert surtout à consulter
 * et corriger, créer un compte reste un geste rare.
 *
 * Les champs sont contrôlés, et c'est nécessaire : React vide un formulaire non
 * contrôlé dès que l'action rend la main, y compris quand elle refuse. Un
 * pseudo déjà pris ferait donc tout retaper. On ne les remet à zéro qu'après
 * une création réussie.
 */
export function CreateAccount() {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  // Le vidage des champs est attaché à l'action, pas à un effet : il n'a lieu
  // qu'en cas de succès, au moment où le compte existe vraiment.
  const [state, formAction] = useActionState<AccountState, FormData>(async (prev, formData) => {
    const result = await createAccount(prev, formData);
    if (result.success) setValues(EMPTY);
    return result;
  }, {});

  const field = (name: keyof typeof EMPTY) => ({
    name,
    value: values[name],
    onChange: (event: { target: { value: string } }) =>
      setValues((current) => ({ ...current, [name]: event.target.value })),
  });

  if (!open) {
    return <AddButton onClick={() => setOpen(true)}>+ Créer un compte</AddButton>;
  }

  return (
    <Card>
      <form action={formAction}>
        <Field label="Email">
          <input type="email" autoComplete="off" required {...field("email")} />
        </Field>
        <Field label="Nom complet">
          <input type="text" autoComplete="off" required {...field("full_name")} />
        </Field>
        <Field label="Pseudo">
          <input type="text" autoComplete="off" required {...field("pseudo")} />
        </Field>
        <Field label="Mot de passe initial">
          <input type="password" autoComplete="new-password" required {...field("password")} />
        </Field>
        <Field label="Confirmer le mot de passe">
          <input
            type="password"
            autoComplete="new-password"
            required
            {...field("password_confirm")}
          />
        </Field>

        <p className="text-ink-soft mt-4 text-[13px]">
          Aucun mail n&apos;est envoyé : c&apos;est à toi de transmettre l&apos;adresse et le mot
          de passe. La personne pourra les changer depuis son onglet Profil.
        </p>

        <Feedback state={state} />
        <Submit label="Créer le compte" />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-ink-soft mt-3 w-full text-[13px] underline"
        >
          Fermer
        </button>
      </form>
    </Card>
  );
}

// ------------------------------------------------------------------
// Un compte
// ------------------------------------------------------------------

type Panel = "profile" | "password" | "delete";

export function AccountCard({ account, isSelf }: { account: Account; isSelf: boolean }) {
  const [panel, setPanel] = useState<Panel | null>(null);

  const toggle = (next: Panel) => setPanel((current) => (current === next ? null : next));

  return (
    <Card className="mb-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="font-display text-[17px] font-medium">{displayName(account)}</h3>
        {account.is_admin && (
          <span className="text-sage-deep bg-sage-pale rounded-[20px] px-2 py-0.5 text-[11px] font-semibold">
            Admin
          </span>
        )}
        {isSelf && <span className="text-ink-soft text-[11px]">c&apos;est toi</span>}
      </div>

      {/* Le titre porte le pseudo, sous lequel le groupe se connaît ; l'état
          civil et l'adresse sont ici, là où l'admin en a besoin. */}
      <p className="text-ink-soft mt-1 text-[13px] break-all">
        {[account.full_name, account.email].filter(Boolean).join(" · ")}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <PanelButton active={panel === "profile"} onClick={() => toggle("profile")}>
          Modifier
        </PanelButton>
        <PanelButton active={panel === "password"} onClick={() => toggle("password")}>
          Mot de passe
        </PanelButton>
        {!isSelf && (
          <PanelButton
            active={panel === "delete"}
            tone="brick"
            onClick={() => toggle("delete")}
          >
            Supprimer
          </PanelButton>
        )}
      </div>

      {panel === "profile" && <IdentityPanel account={account} />}
      {panel === "password" && <PasswordPanel account={account} />}
      {panel === "delete" && (
        <DeletePanel account={account} onCancel={() => setPanel(null)} />
      )}
    </Card>
  );
}

function IdentityPanel({ account }: { account: Account }) {
  const [state, formAction] = useActionState<AccountState, FormData>(updateAccount, {});

  return (
    <form action={formAction} className="border-line-soft mt-4 border-t pt-4">
      <input type="hidden" name="id" value={account.id} />
      <Field label="Nom complet">
        <input type="text" name="full_name" defaultValue={account.full_name} required />
      </Field>
      <Field label="Pseudo">
        <input type="text" name="pseudo" defaultValue={account.pseudo} required />
      </Field>
      <Field label="Email">
        <input type="email" name="email" defaultValue={account.email} autoComplete="off" />
      </Field>
      <Feedback state={state} />
      <Submit label="Enregistrer" />
    </form>
  );
}

function PasswordPanel({ account }: { account: Account }) {
  const [state, formAction] = useActionState<AccountState, FormData>(setPassword, {});

  return (
    <form action={formAction} className="border-line-soft mt-4 border-t pt-4">
      <input type="hidden" name="id" value={account.id} />
      <Field label="Nouveau mot de passe">
        <input type="password" name="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirmer le mot de passe">
        <input type="password" name="password_confirm" autoComplete="new-password" required />
      </Field>
      <p className="text-ink-soft mt-4 text-[13px]">
        Le mot de passe est remplacé immédiatement, sans mail de réinitialisation : préviens la
        personne concernée.
      </p>
      <Feedback state={state} />
      <Submit label="Remplacer le mot de passe" />
    </form>
  );
}

/**
 * Suppression en deux temps, comme pour une activité : ouvrir le panneau ne
 * fait qu'énoncer les conséquences. Pas de `confirm()` natif, qui bloque la
 * page et ne sait rien énumérer.
 */
function DeletePanel({ account, onCancel }: { account: Account; onCancel: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const remove = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await deleteAccount(account.id);
      // En cas de succès la ligne disparaît de la liste : rien à faire ici.
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="border-brick bg-brick-pale mt-4 rounded-[4px] border p-4">
      <p className="text-brick-deep text-sm font-medium">
        Supprimer le compte de {displayName(account)} ?
      </p>
      <p className="text-brick-deep mt-1 text-[13px]">
        La personne ne pourra plus se connecter. Ses invitations, ses votes, ses lignes de
        remboursement et ses appareils abonnés aux notifications disparaissent avec elle. Rien ne
        permet de revenir en arrière.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className="bg-brick-deep rounded-md px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Suppression…" : "Oui, supprimer définitivement"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="border-line bg-paper-raised text-ink-soft hover:border-ink-soft rounded-md border px-4 py-2.5 text-[13px] font-medium transition-colors disabled:opacity-60"
        >
          Annuler
        </button>
      </div>
      {error && (
        <p role="alert" className="text-brick-deep mt-3 text-[13px]">
          {error}
        </p>
      )}
    </div>
  );
}
