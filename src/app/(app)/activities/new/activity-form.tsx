"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  BudgetFieldset,
  DateFieldset,
  emptyDate,
  type BudgetDraft,
  type DateDraft,
} from "@/components/activity-fields";
import { Card, Field, FormError, PrimaryButton, SectionLabel } from "@/components/ui";
import type { Profile } from "@/lib/database.types";

import { createActivity } from "./actions";

export function ActivityForm({ people }: { people: Pick<Profile, "id" | "full_name" | "pseudo">[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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
        title,
        description,
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
      <SectionLabel>Créer une activité</SectionLabel>

      <Card>
        <Field label="Titre">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Weekend à Lisbonne"
            required
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explique l'idée, ce qui est prévu…"
          />
        </Field>

        <DateFieldset dates={dates} setDates={setDates} />
        <BudgetFieldset budget={budget} setBudget={setBudget} />

        <fieldset className="mt-[18px]">
          <legend className="text-ink-soft mb-1.5 text-[13px] font-medium">Participants</legend>
          <div className="flex flex-wrap gap-2">
            {people.map((person) => {
              const selected = participantIds.includes(person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleParticipant(person.id)}
                  className={`rounded-[20px] border px-3 py-1.5 text-[13px] transition-colors ${
                    selected
                      ? "bg-sage border-sage-deep text-white"
                      : "border-line bg-paper text-ink-soft border-dashed"
                  }`}
                >
                  {person.full_name}
                </button>
              );
            })}
          </div>
          {people.length === 0 && (
            <p className="text-ink-soft text-[13px]">
              Aucun autre compte pour l&apos;instant — crée-les depuis le dashboard Supabase.
            </p>
          )}
        </fieldset>

        <FormError>{error}</FormError>

        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer l'activité"}
        </PrimaryButton>
      </Card>
    </form>
  );
}
