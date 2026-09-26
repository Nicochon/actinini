"use client";

import { useState, useTransition } from "react";

import { Avatar } from "@/components/avatar";
import { AddButton, Chip } from "@/components/ui";
import type { Profile } from "@/lib/database.types";
import { displayName } from "@/lib/format";

import {
  addParticipant,
  confirmDate,
  remindAwaiting,
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
  disabled,
}: {
  activityId: string;
  dateOptionId: string;
  voted: boolean;
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
        className={`min-h-[44px] rounded-full border-2 px-4 text-sm font-bold transition-colors disabled:opacity-60 ${
          voted
            ? "bg-brick border-brick text-white"
            : "border-line text-ink enabled:hover:border-ink-soft bg-transparent"
        }`}
      >
        {voted ? "Dispo ✓" : "Je suis dispo"}
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
    "min-h-[52px] rounded-full border-2 px-4 text-[15px] font-bold transition-colors disabled:opacity-60";

  return (
    <div>
      <div className={`grid gap-2.5 ${attendanceDateId ? "grid-cols-2" : "grid-cols-1"}`}>
        {attendanceDateId && (
          <button
            type="button"
            disabled={pending}
            aria-pressed={attending}
            onClick={() => run(() => toggleVote(activityId, attendanceDateId))}
            className={`${base} ${
              attending
                ? "bg-sage border-sage text-white"
                : "border-line text-ink enabled:hover:border-ink-soft bg-transparent"
            }`}
          >
            {attending ? "Je viens ✓" : "Je viens"}
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
              : "border-line text-ink enabled:hover:border-ink-soft bg-transparent"
          }`}
        >
          {declined ? "Je ne viens pas ✓" : "Je ne viens pas"}
        </button>
      </div>

      {!attending && !declined && (
        <p className="text-ink-soft mt-2.5 text-[13px]">
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
        className="text-brick hover:text-brick-deep min-h-[44px] text-sm font-bold transition-colors disabled:opacity-60"
      >
        Retenir cette date
      </button>
      <ErrorLine>{error}</ErrorLine>
    </div>
  );
}

/**
 * Relancer d'une notification ceux dont on attend encore la réponse. Les
 * heures arrivent déjà formatées du serveur, à l'heure française : les
 * calculer ici ferait différer le rendu serveur et le rendu navigateur.
 */
export function RemindButton({
  activityId,
  count,
  lastReminder,
  nextReminder,
}: {
  activityId: string;
  count: number;
  lastReminder: string | null;
  nextReminder: string | null;
}) {
  const { pending, error, run } = useAction();
  const disabled = pending || count === 0 || nextReminder !== null;

  return (
    <div className="mt-6">
      <button
        type="button"
        disabled={disabled}
        onClick={() => run(() => remindAwaiting(activityId))}
        className="bg-ink text-paper enabled:hover:bg-ink-hover disabled:bg-paper-sunk disabled:text-ink-soft min-h-[52px] w-full rounded-full px-4 text-[15px] font-bold transition-colors"
      >
        {count === 0
          ? "Tout le monde a répondu"
          : `Relancer ${count === 1 ? "la personne" : `les ${count} personnes`} sans réponse`}
      </button>
      {count > 0 && (
        <p className="text-ink-soft mt-2 text-center text-[13px]">
          {nextReminder
            ? `Relancé ${lastReminder}. Nouvelle relance possible à partir de ${nextReminder}.`
            : lastReminder
              ? `Dernière relance : ${lastReminder}.`
              : "Une notification leur sera envoyée. Ceux qui ont répondu ne sont pas dérangés."}
        </p>
      )}
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
      {/* Posé sur la carte sombre du budget : textes clairs. */}
      <label
        className={`flex min-h-[40px] items-center gap-2.5 text-sm ${
          canEdit ? "cursor-pointer" : "cursor-default"
        } ${paid ? "text-paper" : "text-[#cdbba8]"}`}
      >
        <input
          type="checkbox"
          checked={paid}
          disabled={!canEdit || pending}
          onChange={(event) => run(() => setPaymentPaid(activityId, paymentId, event.target.checked))}
          className="accent-amber size-[18px] min-h-0 w-auto"
        />
        <span>{name}</span>
        {paid && <span className="text-[12px] font-semibold text-[#c6d8b8]">remboursé</span>}
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
          <Chip key={person.id} className={muted ? "opacity-60" : ""}>
            <Avatar person={person} size={32} />
            {displayName(person)}
            {isAdmin && (
              <button
                type="button"
                disabled={pending}
                aria-label={`Retirer ${displayName(person)}`}
                onClick={() => run(() => removeParticipant(activityId, person.id))}
                className="text-ink-soft hover:text-brick -my-1 -mr-2 flex size-8 items-center justify-center rounded-full leading-none disabled:opacity-60"
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
                  className="border-line hover:border-ink-soft inline-flex min-h-[44px] items-center gap-2 rounded-full border-[1.5px] border-dashed bg-transparent py-1 pr-3.5 pl-1 text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  <Avatar person={person} size={32} />+ {displayName(person)}
                </button>
              ))}
            </div>
          ) : (
            <AddButton onClick={() => setAdding(true)}>+ Inviter quelqu&apos;un</AddButton>
          )}
        </div>
      )}
      <ErrorLine>{error}</ErrorLine>
    </div>
  );
}
