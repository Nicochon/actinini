"use client";

import { useState, useTransition } from "react";

import { AddButton, Chip } from "@/components/ui";
import type { Profile } from "@/lib/database.types";
import { displayName, plural } from "@/lib/format";

import {
  addParticipant,
  confirmDate,
  removeParticipant,
  setAttendance,
  setPaymentPaid,
  toggleVote,
  type ActionResult,
} from "./actions";

/** Enveloppe commune : état « en cours » + remontée du message d'erreur. */
function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const run = (action: () => Promise<ActionResult>) => {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  };

  return { pending, error, run };
}

function ErrorLine({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-brick-deep mt-2 text-[12px]">
      {children}
    </p>
  );
}

/**
 * Le vote de disponibilité sur un créneau. La question de la présence, elle,
 * se pose une fois pour toutes dans « Ta réponse » : elle ne vise pas une date
 * en particulier.
 */
export function VoteButton({
  activityId,
  dateOptionId,
  voted,
  count,
  disabled,
}: {
  activityId: string;
  dateOptionId: string;
  voted: boolean;
  count: number;
  disabled: boolean;
}) {
  const { pending, error, run } = useAction();

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        disabled={disabled || pending}
        aria-pressed={voted}
        onClick={() => run(() => toggleVote(activityId, dateOptionId))}
        className={`min-w-[66px] rounded-[20px] border px-3.5 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-60 ${
          voted
            ? "bg-sage border-sage-deep text-white"
            : "bg-paper border-line text-ink-soft enabled:hover:border-ink-soft"
        }`}
      >
        {plural(count, "vote")}
      </button>
      <ErrorLine>{error}</ErrorLine>
    </div>
  );
}

/**
 * Les deux réponses possibles à une invitation, côte à côte.
 *
 * Elles ne vivent pas au même endroit en base — le oui est un vote sur le
 * créneau retenu, le non une colonne de `activity_participants` — mais pour
 * qui répond c'est une seule question, et elle mérite sa section.
 *
 * Chaque bouton est un interrupteur : recliquer sur sa propre réponse
 * l'annule et renvoie à « pas encore répondu ». Tant qu'aucune date n'est
 * tranchée, seul le « non » est proposé : « je participe » ne voudrait rien
 * dire tant qu'on ignore quel jour.
 */
export function AttendanceAnswer({
  activityId,
  attendanceDateId,
  attending,
  declined,
}: {
  activityId: string;
  attendanceDateId: string | null;
  attending: boolean;
  declined: boolean;
}) {
  const { pending, error, run } = useAction();

  const base =
    "rounded-[20px] border px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-60";

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {attendanceDateId && (
          <button
            type="button"
            disabled={pending}
            aria-pressed={attending}
            onClick={() => run(() => toggleVote(activityId, attendanceDateId))}
            className={`${base} ${
              attending
                ? "bg-sage border-sage-deep text-white"
                : "bg-paper border-line text-ink-soft enabled:hover:border-ink-soft"
            }`}
          >
            {attending ? "✓ Je participe" : "Je participe"}
          </button>
        )}

        <button
          type="button"
          disabled={pending}
          aria-pressed={declined}
          onClick={() => run(() => setAttendance(activityId, declined))}
          className={`${base} ${
            declined
              ? "bg-brick-pale border-brick text-brick-deep"
              : "bg-paper border-line text-ink-soft enabled:hover:border-ink-soft"
          }`}
        >
          {declined ? "✓ Je ne viens pas" : "Je ne viens pas"}
        </button>
      </div>

      {!attending && !declined && (
        <p className="text-ink-soft mt-2 text-[13px]">
          {attendanceDateId
            ? "Tu n'as pas encore répondu."
            : "Tu peux déjà dire non, sans attendre que la date soit fixée."}
        </p>
      )}

      <ErrorLine>{error}</ErrorLine>
    </div>
  );
}

export function ConfirmDateButton({
  activityId,
  dateOptionId,
}: {
  activityId: string;
  dateOptionId: string;
}) {
  const { pending, error, run } = useAction();

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => confirmDate(activityId, dateOptionId))}
        className="border-sage-deep text-sage-deep hover:bg-sage-pale rounded-md border px-3.5 py-2 text-[13px] font-medium transition-colors disabled:opacity-60"
      >
        Confirmer cette date
      </button>
      <ErrorLine>{error}</ErrorLine>
    </div>
  );
}

export function PaymentToggle({
  activityId,
  paymentId,
  paid,
  name,
  canEdit,
}: {
  activityId: string;
  paymentId: string;
  paid: boolean;
  name: string;
  canEdit: boolean;
}) {
  const { pending, error, run } = useAction();

  return (
    <div>
      <label
        className={`flex items-center gap-2 py-1 text-[13px] ${
          canEdit ? "cursor-pointer" : "cursor-default"
        } ${paid ? "text-ink" : "text-ink-soft"}`}
      >
        <input
          type="checkbox"
          checked={paid}
          disabled={!canEdit || pending}
          onChange={(event) => run(() => setPaymentPaid(activityId, paymentId, event.target.checked))}
          className="accent-sage size-4 w-auto"
        />
        <span className={paid ? "" : "opacity-80"}>{name}</span>
        {paid && <span className="text-sage-deep text-[12px]">remboursé</span>}
      </label>
      <ErrorLine>{error}</ErrorLine>
    </div>
  );
}

export function ParticipantsEditor({
  activityId,
  participants,
  candidates,
  isAdmin,
  emptyLabel = "Personne n'est encore invité.",
  muted = false,
}: {
  activityId: string;
  participants: Pick<Profile, "id" | "full_name" | "pseudo">[];
  candidates: Pick<Profile, "id" | "full_name" | "pseudo">[];
  isAdmin: boolean;
  emptyLabel?: string;
  muted?: boolean;
}) {
  const { pending, error, run } = useAction();
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {participants.map((person) => (
          <Chip key={person.id} className={muted ? "border-dashed" : ""}>
            {displayName(person)}
            {isAdmin && (
              <button
                type="button"
                disabled={pending}
                aria-label={`Retirer ${displayName(person)}`}
                onClick={() => run(() => removeParticipant(activityId, person.id))}
                className="text-brick hover:text-brick-deep -mr-1 px-1 leading-none disabled:opacity-60"
              >
                ✕
              </button>
            )}
          </Chip>
        ))}
        {participants.length === 0 && (
          <p className="text-ink-soft text-[13px]">{emptyLabel}</p>
        )}
      </div>

      {isAdmin && candidates.length > 0 && (
        <div className="mt-3">
          {adding ? (
            <div className="flex flex-wrap gap-2">
              {candidates.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => addParticipant(activityId, person.id))}
                  className="border-line bg-paper hover:border-ink-soft rounded-[20px] border border-dashed px-3 py-1.5 text-[13px] transition-colors disabled:opacity-60"
                >
                  + {displayName(person)}
                </button>
              ))}
            </div>
          ) : (
            <AddButton onClick={() => setAdding(true)}>+ Ajouter un participant</AddButton>
          )}
        </div>
      )}
      <ErrorLine>{error}</ErrorLine>
    </div>
  );
}
