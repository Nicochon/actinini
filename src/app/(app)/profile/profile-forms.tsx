"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Card, Field, FormError, PrimaryButton } from "@/components/ui";
import type { Profile } from "@/lib/database.types";

import { updateCredentials, updateProfile, type ProfileState } from "./actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : label}
    </PrimaryButton>
  );
}

function Feedback({ state }: { state: ProfileState }) {
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

export function IdentityForm({
  profile,
}: {
  profile: Pick<Profile, "full_name" | "pseudo" | "payment_info">;
}) {
  const [state, formAction] = useActionState<ProfileState, FormData>(updateProfile, {});

  return (
    <Card>
      <form action={formAction}>
        <Field label="Nom complet">
          <input type="text" name="full_name" defaultValue={profile.full_name} required />
        </Field>
        <Field label="Pseudo — c'est lui qui s'affiche partout">
          <input type="text" name="pseudo" defaultValue={profile.pseudo} required />
        </Field>
        <Field label="Comment te rembourser">
          <textarea
            name="payment_info"
            defaultValue={profile.payment_info ?? ""}
            placeholder="Wero au 06 12 34 56 78, ou IBAN FR76…"
          />
          <p className="text-ink-soft mt-1.5 text-[12px]">
            Affiché aux membres du groupe qui te doivent de l&apos;argent, sur les activités où
            tu as avancé des frais. Personne d&apos;autre ne peut modifier ce champ, pas même
            l&apos;administrateur.
          </p>
        </Field>
        <Feedback state={state} />
        <Submit label="Enregistrer" />
      </form>
    </Card>
  );
}

export function CredentialsForm({ email }: { email: string }) {
  const [state, formAction] = useActionState<ProfileState, FormData>(updateCredentials, {});

  return (
    <Card>
      <form action={formAction}>
        <Field label="Email">
          <input type="email" name="email" defaultValue={email} autoComplete="email" />
        </Field>
        <Field label="Nouveau mot de passe">
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="Laisser vide pour ne pas le changer"
          />
        </Field>
        <Field label="Confirmer le mot de passe">
          <input type="password" name="password_confirm" autoComplete="new-password" />
        </Field>
        <Feedback state={state} />
        <Submit label="Mettre à jour" />
      </form>
    </Card>
  );
}
