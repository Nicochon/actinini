"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Field, FormError, PrimaryButton } from "@/components/ui";

import { signIn, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? "Connexion…" : "Se connecter"}
    </PrimaryButton>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={next} />
      <Field label="Email">
        <input type="email" name="email" autoComplete="email" required autoFocus />
      </Field>
      <Field label="Mot de passe">
        <input type="password" name="password" autoComplete="current-password" required />
      </Field>
      <FormError>{state.error}</FormError>
      <SubmitButton />
    </form>
  );
}
