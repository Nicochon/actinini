"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AddButton, Card, Field, FormError, PrimaryButton, SectionLabel } from "@/components/ui";
import type { PaymentMode, Profile } from "@/lib/database.types";

import { createActivity } from "./actions";

type DateDraft = { key: number; start: string; end: string };
type BudgetDraft = { key: number; label: string; amount: string; mode: PaymentMode };

let nextKey = 0;
const newKey = () => nextKey++;

const emptyDate = (): DateDraft => ({ key: newKey(), start: "", end: "" });
const emptyBudget = (): BudgetDraft => ({ key: newKey(), label: "", amount: "", mode: "advance" });

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="border-line text-brick hover:border-brick w-[38px] shrink-0 rounded-md border transition-colors"
    >
      ✕
    </button>
  );
}

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

        <fieldset className="mt-[18px]">
          <legend className="text-ink-soft mb-1.5 text-[13px] font-medium">
            Dates proposées <span className="font-normal">(fin facultative)</span>
          </legend>
          {dates.map((date, index) => (
            <div key={date.key} className="mb-2 flex gap-2">
              <input
                type="date"
                value={date.start}
                aria-label={`Début du créneau ${index + 1}`}
                onChange={(e) =>
                  setDates((current) =>
                    current.map((d) => (d.key === date.key ? { ...d, start: e.target.value } : d)),
                  )
                }
              />
              <input
                type="date"
                value={date.end}
                min={date.start || undefined}
                aria-label={`Fin du créneau ${index + 1}`}
                onChange={(e) =>
                  setDates((current) =>
                    current.map((d) => (d.key === date.key ? { ...d, end: e.target.value } : d)),
                  )
                }
              />
              <RemoveButton
                label={`Supprimer le créneau ${index + 1}`}
                onClick={() => setDates((current) => current.filter((d) => d.key !== date.key))}
              />
            </div>
          ))}
          <AddButton onClick={() => setDates((current) => [...current, emptyDate()])}>
            + Ajouter une date
          </AddButton>
        </fieldset>

        <fieldset className="mt-[18px]">
          <legend className="text-ink-soft mb-1.5 text-[13px] font-medium">
            Budget par personne <span className="font-normal">(facultatif)</span>
          </legend>
          {budget.map((line, index) => (
            <div key={line.key} className="border-line-soft mb-2 border-b pb-2 last:border-b-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-[2]"
                  value={line.label}
                  aria-label={`Libellé de la ligne ${index + 1}`}
                  placeholder="Vol"
                  onChange={(e) =>
                    setBudget((current) =>
                      current.map((b) => (b.key === line.key ? { ...b, label: e.target.value } : b)),
                    )
                  }
                />
                <input
                  type="number"
                  className="flex-1"
                  min="0"
                  step="0.01"
                  value={line.amount}
                  aria-label={`Montant de la ligne ${index + 1}`}
                  placeholder="95"
                  onChange={(e) =>
                    setBudget((current) =>
                      current.map((b) => (b.key === line.key ? { ...b, amount: e.target.value } : b)),
                    )
                  }
                />
                <RemoveButton
                  label={`Supprimer la ligne ${index + 1}`}
                  onClick={() => setBudget((current) => current.filter((b) => b.key !== line.key))}
                />
              </div>
              <select
                className="mt-2"
                value={line.mode}
                aria-label={`Mode de paiement de la ligne ${index + 1}`}
                onChange={(e) =>
                  setBudget((current) =>
                    current.map((b) =>
                      b.key === line.key ? { ...b, mode: e.target.value as PaymentMode } : b,
                    ),
                  )
                }
              >
                <option value="advance">J&apos;avance, ils remboursent</option>
                <option value="on_site">Chacun paie sur place</option>
              </select>
            </div>
          ))}
          <AddButton onClick={() => setBudget((current) => [...current, emptyBudget()])}>
            + Ajouter une ligne de budget
          </AddButton>
        </fieldset>

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
