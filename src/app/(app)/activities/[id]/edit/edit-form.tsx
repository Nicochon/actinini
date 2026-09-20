"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  BudgetFieldset,
  DateFieldset,
  newKey,
  type BudgetDraft,
  type DateDraft,
} from "@/components/activity-fields";
import { Card, Field, FormError, PrimaryButton, SectionLabel } from "@/components/ui";
import type { ActivityStatus } from "@/lib/database.types";
import { STATUS_LABELS } from "@/lib/format";

import { updateActivity } from "./actions";

export type EditableActivity = {
  id: string;
  title: string;
  description: string | null;
  status: ActivityStatus;
  confirmed_date_option_id: string | null;
  dates: { id: string; start_date: string; end_date: string | null }[];
  budget: {
    id: string;
    label: string;
    amount_per_person: number;
    payment_mode: BudgetDraft["mode"];
    paidCount: number;
  }[];
};

const STATUS_ORDER: ActivityStatus[] = ["voting", "confirmed", "completed", "cancelled"];

export function EditForm({ activity }: { activity: EditableActivity }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description ?? "");
  const [status, setStatus] = useState<ActivityStatus>(activity.status);

  const [dates, setDates] = useState<DateDraft[]>(() =>
    activity.dates.map((d) => ({
      key: newKey(),
      id: d.id,
      start: d.start_date,
      end: d.end_date ?? "",
    })),
  );
  const [budget, setBudget] = useState<BudgetDraft[]>(() =>
    activity.budget.map((b) => ({
      key: newKey(),
      id: b.id,
      label: b.label,
      amount: String(b.amount_per_person),
      mode: b.payment_mode,
      paidCount: b.paidCount,
    })),
  );

  // Les suppressions ne partent qu'à l'enregistrement : retirer une ligne de
  // l'écran ne doit rien casser tant que l'admin n'a pas validé.
  const [deletedDateIds, setDeletedDateIds] = useState<string[]>([]);
  const [deletedBudgetIds, setDeletedBudgetIds] = useState<string[]>([]);

  const submit = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await updateActivity({
        activityId: activity.id,
        title,
        description,
        status,
        dates: dates.map(({ id, start, end }) => ({ id, start, end })),
        budget: budget.map(({ id, label, amount, mode }) => ({ id, label, amount, mode })),
        deletedDateIds,
        deletedBudgetIds,
      });

      if (result.error) {
        setError(result.error);
        return;
      }
      // Le message voyage par l'URL : la redirection quitte ce formulaire, et
      // c'est sur la page de détail qu'on veut lire ce qui a changé.
      router.push(
        `/activities/${activity.id}${result.notice ? `?info=${result.notice}` : ""}`,
      );
    });
  };

  // « Confirmé » suppose un créneau retenu, choisi depuis la page de l'activité.
  const confirmedStillThere =
    activity.confirmed_date_option_id !== null &&
    !deletedDateIds.includes(activity.confirmed_date_option_id);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Link
        href={`/activities/${activity.id}`}
        className="text-ink-soft mb-4 inline-flex items-center gap-1.5 text-[13px]"
      >
        ← Retour à l&apos;activité
      </Link>

      <SectionLabel>Modifier l&apos;activité</SectionLabel>

      <Card>
        <Field label="Titre">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </Field>

        <Field label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <Field label="Statut">
          <select value={status} onChange={(e) => setStatus(e.target.value as ActivityStatus)}>
            {STATUS_ORDER.map((value) => (
              <option key={value} value={value} disabled={value === "confirmed" && !confirmedStillThere}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
          {!confirmedStillThere && (
            <p className="text-ink-soft mt-1 text-[12px]">
              « Date fixée » demande un créneau retenu — confirme-le depuis la page de
              l&apos;activité.
            </p>
          )}
        </Field>

        <DateFieldset
          dates={dates}
          setDates={setDates}
          confirmedDateOptionId={activity.confirmed_date_option_id}
          onRemove={(date) => date.id && setDeletedDateIds((ids) => [...ids, date.id!])}
        />

        <BudgetFieldset
          budget={budget}
          setBudget={setBudget}
          onRemove={(line) => line.id && setDeletedBudgetIds((ids) => [...ids, line.id!])}
        />

        <FormError>{error}</FormError>

        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer les modifications"}
        </PrimaryButton>
      </Card>

      <p className="text-ink-soft mt-4 text-[12px]">
        Les participants se gèrent depuis la page de l&apos;activité.
      </p>
    </form>
  );
}
