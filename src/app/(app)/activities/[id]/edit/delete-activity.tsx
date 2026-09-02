"use client";

import { useState, useTransition } from "react";

import { plural } from "@/lib/format";

import { deleteActivity } from "./actions";

/**
 * Suppression en deux temps : le premier clic ne fait qu'énoncer ce qui va
 * disparaître. Pas de `confirm()` natif — il bloque la page et se prête mal à
 * l'énumération des conséquences.
 */
export function DeleteActivity({
  activityId,
  title,
  counts,
}: {
  activityId: string;
  title: string;
  counts: { participants: number; dates: number; votes: number; budget: number; paid: number };
}) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const losses = [
    counts.participants > 0 && plural(counts.participants, "participant invité", "participants invités"),
    counts.dates > 0 && plural(counts.dates, "créneau proposé", "créneaux proposés"),
    counts.votes > 0 && plural(counts.votes, "vote"),
    counts.budget > 0 && plural(counts.budget, "ligne de budget", "lignes de budget"),
    counts.paid > 0 && plural(counts.paid, "remboursement constaté", "remboursements constatés"),
  ].filter((x): x is string => Boolean(x));

  const remove = () => {
    setError(undefined);
    startTransition(async () => {
      // En cas de succès l'action redirige : seul un échec revient ici.
      const result = await deleteActivity(activityId);
      if (result?.error) {
        setError(result.error);
        setArmed(false);
      }
    });
  };

  return (
    <section className="border-line mt-8 border-t pt-6">
      <h2 className="text-brick-deep mb-3 text-xs font-semibold tracking-[0.04em] uppercase">
        Zone dangereuse
      </h2>

      {armed ? (
        <div className="border-brick bg-brick-pale rounded-[4px] border p-4">
          <p className="text-brick-deep text-sm font-medium">
            Supprimer « {title} » définitivement ?
          </p>
          <p className="text-brick-deep mt-1 text-[13px]">
            {losses.length > 0
              ? `Cette activité et tout ce qu'elle contient seront perdus : ${losses.join(", ")}. Rien ne permet de revenir en arrière.`
              : "Rien ne permet de revenir en arrière."}
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
              onClick={() => setArmed(false)}
              className="border-line bg-paper-raised text-ink-soft hover:border-ink-soft rounded-md border px-4 py-2.5 text-[13px] font-medium transition-colors disabled:opacity-60"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="border-brick text-brick-deep hover:bg-brick-pale rounded-md border px-4 py-2.5 text-[13px] font-medium transition-colors"
        >
          Supprimer l&apos;activité
        </button>
      )}

      {error && (
        <p role="alert" className="text-brick-deep mt-3 text-[13px]">
          {error}
        </p>
      )}
    </section>
  );
}
