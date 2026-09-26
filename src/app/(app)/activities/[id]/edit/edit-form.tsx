"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  BudgetFieldset,
  DateFieldset,
  FormSection,
  IconPicker,
  newKey,
  type BudgetDraft,
  type DateDraft,
} from "@/components/activity-fields";
import { ActivityIcon } from "@/components/activity-icon";
import { Field, FormError, PrimaryButton } from "@/components/ui";
import type { ActivityStatus } from "@/lib/database.types";
import { STATUS_LABELS } from "@/lib/format";

import { updateActivity } from "./actions";

export type EditableActivity = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  icon: string;
  start_time: string | null;
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

  const [icon, setIcon] = useState(activity.icon);
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description ?? "");
  const [location, setLocation] = useState(activity.location ?? "");
  // Postgres rend « 20:00:00 », le champ attend « 20:00 ».
  const [time, setTime] = useState(activity.start_time?.slice(0, 5) ?? "");
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
        icon,
        title,
        description,
        location,
        time,
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
        aria-label="Retour à l'activité"
        className="bg-paper-raised hover:bg-paper-sunk mb-5 flex size-11 items-center justify-center rounded-full transition-colors"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          width={20}
          height={20}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>

      <div className="mb-5 flex items-center gap-3.5">
        <ActivityIcon name={icon} size={52} />
        <h1 className="font-display text-[28px] leading-tight font-semibold">
          Modifier l&apos;activité
        </h1>
      </div>

      <FormSection title="L'icône">
        <IconPicker value={icon} onChange={setIcon} />
      </FormSection>

      <FormSection>
        <Field label="Titre">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </FormSection>

      <FormSection title="Statut">
        <div role="radiogroup" aria-label="Statut" className="flex flex-wrap gap-2">
          {STATUS_ORDER.map((value) => {
            const disabled = value === "confirmed" && !confirmedStillThere;
            const selected = status === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => setStatus(value)}
                className={`min-h-[44px] rounded-full border-2 px-4 text-sm font-semibold transition-colors disabled:opacity-40 ${
                  selected
                    ? "border-brick bg-brick-pale"
                    : "border-line enabled:hover:border-ink-soft bg-transparent"
                }`}
              >
                {STATUS_LABELS[value]}
              </button>
            );
          })}
        </div>
        {!confirmedStillThere && (
          <p className="text-ink-soft mt-3 text-[13px]">
            « Date fixée » demande un créneau retenu — choisis-le depuis la page de
            l&apos;activité.
          </p>
        )}
      </FormSection>

      <FormSection title="Quand ?">
        <DateFieldset
          dates={dates}
          setDates={setDates}
          confirmedDateOptionId={activity.confirmed_date_option_id}
          onRemove={(date) => date.id && setDeletedDateIds((ids) => [...ids, date.id!])}
        />

        <Field label="Heure (facultatif)">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <span className="text-ink-soft mt-1.5 block text-[13px]">
            Vaut pour toutes les dates proposées.
          </span>
        </Field>
      </FormSection>

      <FormSection title="Budget par personne">
        <BudgetFieldset
          budget={budget}
          setBudget={setBudget}
          onRemove={(line) => line.id && setDeletedBudgetIds((ids) => [...ids, line.id!])}
        />
      </FormSection>

      <FormError>{error}</FormError>

      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer les modifications"}
      </PrimaryButton>

      <p className="text-ink-soft mt-4 text-center text-[13px]">
        Les invités se gèrent depuis la page de l&apos;activité.
      </p>
    </form>
  );
}
