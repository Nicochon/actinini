"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

import { ActivityIcon } from "@/components/activity-icon";
import { AddButton } from "@/components/ui";
import { ACTIVITY_ICONS } from "@/lib/activity-icons";
import type { PaymentMode } from "@/lib/database.types";

/**
 * Champs de créneaux et de budget, partagés par la création et l'édition.
 *
 * `id` n'est renseigné que sur les lignes déjà en base : c'est ce qui permet
 * au formulaire d'édition de distinguer un ajout d'une modification, et de
 * retenir ce qui a été supprimé.
 */
export type DateDraft = { key: number; id?: string; start: string; end: string };
export type BudgetDraft = {
  key: number;
  id?: string;
  label: string;
  amount: string;
  mode: PaymentMode;
  /** Remboursements déjà constatés, pour avertir avant de les perdre. */
  paidCount?: number;
};

let nextKey = 0;
export const newKey = () => nextKey++;

export const emptyDate = (): DateDraft => ({ key: newKey(), start: "", end: "" });
export const emptyBudget = (): BudgetDraft => ({
  key: newKey(),
  label: "",
  amount: "",
  mode: "advance",
});

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="bg-brick-pale text-brick hover:bg-brick hover:text-white flex size-11 shrink-0 items-center justify-center self-center rounded-full font-bold transition-colors"
    >
      ✕
    </button>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return <p className="text-amber-deep mt-1.5 text-[13px]">{children}</p>;
}

export function DateFieldset({
  dates,
  setDates,
  onRemove,
  confirmedDateOptionId,
}: {
  dates: DateDraft[];
  setDates: Dispatch<SetStateAction<DateDraft[]>>;
  onRemove?: (date: DateDraft) => void;
  confirmedDateOptionId?: string | null;
}) {
  const patch = (key: number, changes: Partial<DateDraft>) =>
    setDates((current) => current.map((d) => (d.key === key ? { ...d, ...changes } : d)));

  const remove = (date: DateDraft) => {
    setDates((current) => current.filter((d) => d.key !== date.key));
    onRemove?.(date);
  };

  return (
    <fieldset className="mt-[18px] first:mt-0">
      <legend className="mb-1.5 text-sm font-semibold">
        Dates proposées{" "}
        <span className="text-ink-soft font-normal">· fin facultative, une seule date = date fixée</span>
      </legend>

      {dates.map((date, index) => (
        <div key={date.key} className="mb-2">
          {/* `min-w-0` sur les deux champs : sans lui, un champ de date refuse
              de descendre sous la largeur de son contenu natif, et la ligne
              déborde de l'écran sur un iPhone de 375 px — ce qui fait défiler
              toute l'app de gauche à droite. */}
          <div className="flex gap-2">
            <input
              type="date"
              className="min-w-0"
              value={date.start}
              aria-label={`Début du créneau ${index + 1}`}
              onChange={(e) => patch(date.key, { start: e.target.value })}
            />
            <input
              type="date"
              className="min-w-0"
              value={date.end}
              min={date.start || undefined}
              aria-label={`Fin du créneau ${index + 1}`}
              onChange={(e) => patch(date.key, { end: e.target.value })}
            />
            <RemoveButton
              label={`Supprimer le créneau ${index + 1}`}
              onClick={() => remove(date)}
            />
          </div>
          {date.id && date.id === confirmedDateOptionId && (
            <Warning>
              Créneau retenu — le supprimer remettra l&apos;activité en vote et effacera les votes
              déjà exprimés dessus.
            </Warning>
          )}
        </div>
      ))}

      <AddButton onClick={() => setDates((current) => [...current, emptyDate()])}>
        + Proposer une autre date
      </AddButton>
    </fieldset>
  );
}

export function BudgetFieldset({
  budget,
  setBudget,
  onRemove,
}: {
  budget: BudgetDraft[];
  setBudget: Dispatch<SetStateAction<BudgetDraft[]>>;
  onRemove?: (line: BudgetDraft) => void;
}) {
  const patch = (key: number, changes: Partial<BudgetDraft>) =>
    setBudget((current) => current.map((b) => (b.key === key ? { ...b, ...changes } : b)));

  const remove = (line: BudgetDraft) => {
    setBudget((current) => current.filter((b) => b.key !== line.key));
    onRemove?.(line);
  };

  return (
    <fieldset className="mt-[18px] first:mt-0">
      <legend className="text-ink-soft mb-3 text-sm">
        Facultatif : ce que chacun paiera, avancé par toi ou réglé sur place.
      </legend>

      {budget.map((line, index) => {
        const losesPayments = Boolean(line.paidCount) && line.mode !== "advance";

        return (
          <div key={line.key} className="border-line-soft mb-3 border-b pb-3 last:border-b-0">
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-[2]"
                value={line.label}
                aria-label={`Libellé de la ligne ${index + 1}`}
                placeholder="Vol"
                onChange={(e) => patch(line.key, { label: e.target.value })}
              />
              <input
                type="number"
                className="flex-1"
                min="0"
                step="0.01"
                value={line.amount}
                aria-label={`Montant de la ligne ${index + 1}`}
                placeholder="95"
                onChange={(e) => patch(line.key, { amount: e.target.value })}
              />
              <RemoveButton
                label={`Supprimer la ligne ${index + 1}`}
                onClick={() => remove(line)}
              />
            </div>

            <select
              className="mt-2"
              value={line.mode}
              aria-label={`Mode de paiement de la ligne ${index + 1}`}
              onChange={(e) => patch(line.key, { mode: e.target.value as PaymentMode })}
            >
              <option value="advance">J&apos;avance, ils remboursent</option>
              <option value="on_site">Chacun paie sur place</option>
            </select>

            {losesPayments && (
              <Warning>
                {line.paidCount === 1
                  ? "1 remboursement déjà constaté sera effacé"
                  : `${line.paidCount} remboursements déjà constatés seront effacés`}{" "}
                en passant cette ligne au paiement sur place.
              </Warning>
            )}
          </div>
        );
      })}

      <AddButton onClick={() => setBudget((current) => [...current, emptyBudget()])}>
        + Ajouter une ligne de budget
      </AddButton>
    </fieldset>
  );
}

/** Les icônes montrées d'emblée ; les autres attendent un « Plus ». */
const FIRST_ROW = 11;

/**
 * Le choix de l'icône : une grille de tuiles, la choisie cerclée de
 * terracotta. Les moins courantes sont repliées derrière un bouton, sauf si
 * l'activité en porte déjà une — elle doit rester visible pour qu'on la voie
 * sélectionnée.
 */
export function IconPicker({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const selectedIndex = ACTIVITY_ICONS.findIndex((icon) => icon.key === value);
  const [expanded, setExpanded] = useState(selectedIndex >= FIRST_ROW);
  const shown = expanded ? ACTIVITY_ICONS : ACTIVITY_ICONS.slice(0, FIRST_ROW);

  return (
    <fieldset>
      <legend className="sr-only">Icône de l&apos;activité</legend>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-y-3">
        {shown.map((icon) => {
          const selected = icon.key === value;
          return (
            <button
              key={icon.key}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(icon.key)}
              className="flex flex-col items-center gap-1 text-[11px] font-semibold"
            >
              <ActivityIcon
                name={icon.key}
                size={48}
                className={
                  selected
                    ? "ring-brick ring-offset-paper-raised ring-2 ring-offset-2"
                    : "opacity-90 hover:opacity-100"
                }
              />
              <span className={selected ? "text-ink" : "text-ink-soft"}>{icon.label}</span>
            </button>
          );
        })}
        {!expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-ink-soft flex flex-col items-center gap-1 text-[11px] font-semibold"
          >
            <span className="border-line flex size-12 items-center justify-center rounded-[14px] border-[1.5px] border-dashed text-[13px] font-bold">
              +{ACTIVITY_ICONS.length - FIRST_ROW}
            </span>
            Plus
          </button>
        )}
      </div>
    </fieldset>
  );
}

/** Un bloc de formulaire : une carte et son titre. */
export function FormSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="bg-paper-raised mb-4 rounded-[22px] p-5 shadow-[0_1px_0_var(--color-line)]">
      {title && <h2 className="font-display mb-4 text-[20px] leading-tight font-semibold">{title}</h2>}
      {children}
    </section>
  );
}
