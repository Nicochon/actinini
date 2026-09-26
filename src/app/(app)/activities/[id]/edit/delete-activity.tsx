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
    <section className="mt-8 flex flex-col gap-3 rounded-[22px] border-[1.5px] border-[#e9b8a6] p-5">
      <h2 className="text-brick-deep text-base font-bold">Zone sensible</h2>

      {armed ? (
        <div className="bg-brick-pale rounded-2xl p-4">
          <p className="text-brick-deep text-[15px] font-bold">
            Supprimer « {title} » définitivement ?
          </p>
          <p className="text-brick-deep mt-1 text-sm">
            {losses.length > 0
              ? `Cette activité et tout ce qu'elle contient seront perdus : ${losses.join(", ")}. Rien ne permet de revenir en arrière.`
              : "Rien ne permet de revenir en arrière."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className="bg-brick-deep min-h-[48px] rounded-full px-5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Suppression…" : "Oui, supprimer définitivement"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setArmed(false)}
              className="border-line text-ink hover:border-ink-soft min-h-[48px] rounded-full border-[1.5px] bg-white px-5 text-sm font-semibold transition-colors disabled:opacity-60"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <>
        <p className="text-ink-soft text-sm">
          Supprimer l&apos;activité efface aussi les votes, le budget et les remboursements.
        </p>
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="border-brick text-brick-deep hover:bg-brick-pale min-h-[48px] rounded-full border-[1.5px] px-5 text-[15px] font-bold transition-colors"
        >
          Supprimer l&apos;activité
        </button>
        </>
      )}

      {error && (
        <p role="alert" className="text-brick-deep mt-3 text-[13px]">
          {error}
        </p>
      )}
    </section>
  );
}
