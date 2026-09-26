"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  BudgetFieldset,
  DateFieldset,
  emptyDate,
  FormSection,
  IconPicker,
  type BudgetDraft,
  type DateDraft,
} from "@/components/activity-fields";
import { Avatar } from "@/components/avatar";
import { Field, FormError, PrimaryButton } from "@/components/ui";
import { DEFAULT_ICON } from "@/lib/activity-icons";
import type { Profile } from "@/lib/database.types";
import { displayName } from "@/lib/format";

import { createActivity } from "./actions";

export function ActivityForm({ people }: { people: Pick<Profile, "id" | "full_name" | "pseudo">[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const [icon, setIcon] = useState<string>(DEFAULT_ICON);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [time, setTime] = useState("");
  const [dates, setDates] = useState<DateDraft[]>([emptyDate()]);
  const [budget, setBudget] = useState<BudgetDraft[]>([]);
  const [participantIds, setParticipantIds] = useState<string[]>([]);

  const toggleParticipant = (id: string) =>
    setParticipantIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const submit = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await createActivity({
        icon,
        title,
        description,
        location,
        time,
        dates: dates.map(({ start, end }) => ({ start, end })),
        budget: budget.map(({ label, amount, mode }) => ({ label, amount, mode })),
        participantIds,
      });

      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/activities/${result.activityId}`);
    });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <h1 className="font-display mb-5 text-[32px] leading-tight font-semibold">
        Nouvelle activité
      </h1>

      <FormSection title="L'icône">
        <IconPicker value={icon} onChange={setIcon} />
      </FormSection>

      <FormSection>
        <Field label="Titre">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Weekend à Lisbonne"
            required
          />
        </Field>

        <Field label="Lieu">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Chez Sam, 12 rue des Lilas"
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explique l'idée, ce qui est prévu…"
          />
        </Field>
      </FormSection>

      <FormSection title="Quand ?">
        <DateFieldset dates={dates} setDates={setDates} />

        <Field label="Heure (facultatif)">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <span className="text-ink-soft mt-1.5 block text-[13px]">
            Vaut pour toutes les dates proposées.
          </span>
        </Field>
      </FormSection>

      <FormSection title="Budget par personne">
        <BudgetFieldset budget={budget} setBudget={setBudget} />
      </FormSection>

      <FormSection title="Qui tu invites ?">
        <div className="flex flex-wrap gap-2">
          {people.map((person) => {
            const selected = participantIds.includes(person.id);
            return (
              <button
                key={person.id}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleParticipant(person.id)}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 py-1 pr-3.5 pl-1 text-sm font-semibold transition-colors ${
                  selected
                    ? "border-brick bg-brick-pale text-ink"
                    : "border-line text-ink bg-white hover:border-ink-soft"
                }`}
              >
                <Avatar person={person} size={32} />
                {displayName(person)}
                {selected && " ✓"}
              </button>
            );
          })}
        </div>
        {people.length === 0 && (
          <p className="text-ink-soft text-sm">
            Aucun autre compte pour l&apos;instant — crée-les depuis l&apos;onglet « Comptes ».
          </p>
        )}
      </FormSection>

      <FormError>{error}</FormError>

      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Création…" : "Créer l'activité"}
      </PrimaryButton>
    </form>
  );
}
