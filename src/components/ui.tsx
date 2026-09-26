import type { ComponentProps, ReactNode } from "react";

import type { ActivityStatus } from "@/lib/database.types";
import { STATUS_LABELS } from "@/lib/format";

/** Badge de statut, en forme de pilule pleine. */
export function Stamp({ status }: { status: ActivityStatus }) {
  const tone: Record<ActivityStatus, string> = {
    voting: "text-amber-deep bg-amber-pale",
    confirmed: "text-sage-deep bg-sage-pale",
    completed: "text-ink-soft bg-line-soft",
    cancelled: "text-brick-deep bg-brick-pale",
  };

  return (
    <span
      className={`inline-block shrink-0 rounded-full px-3 py-1 text-[13px] font-bold whitespace-nowrap ${tone[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Intitulé de section, dans la police de titre. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="font-display mb-3 text-[20px] leading-tight font-semibold">{children}</h2>;
}

/** Carte crème aux coins ronds, l'unité de base du layout. */
export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`bg-paper-raised rounded-[22px] p-5 shadow-[0_1px_0_var(--color-line)] ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Séparateur de section. `bleed` le fait déborder du padding d'une Card pour
 * qu'il aille d'un bord à l'autre.
 */
export function Perforation({ bleed = false }: { bleed?: boolean }) {
  return <div className={`perforation ${bleed ? "-mx-5" : ""}`} />;
}

/**
 * Bouton d'action principal, pleine largeur. La marge haute est portée ici
 * (les 24px du prototype) : c'est l'action terminale d'un formulaire, elle ne
 * doit jamais toucher le champ qui la précède.
 */
export function PrimaryButton({
  className = "",
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={`bg-brick hover:bg-brick-deep mt-6 min-h-[52px] w-full rounded-full px-5 py-3 text-base font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}

/** Bouton discret bordé de pointillés, pour « + Ajouter … ». */
export function AddButton({
  className = "",
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className={`border-line text-ink hover:border-ink-soft min-h-[48px] w-full rounded-full border-[1.5px] border-dashed py-2.5 text-[15px] font-semibold transition-colors ${className}`}
    />
  );
}

/** Message d'erreur d'un formulaire. */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="text-brick-deep bg-brick-pale mt-4 rounded-2xl px-4 py-3 text-sm"
    >
      {children}
    </p>
  );
}

/** Libellé de champ. */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="mt-[18px] block first:mt-0">
      <span className="mb-1.5 block text-sm font-semibold">
        {label}
      </span>
      {children}
    </label>
  );
}

/** Petit jeton arrondi (participants, sélections). */
export function Chip({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`bg-paper-raised inline-flex items-center gap-2 rounded-full py-1 pr-3.5 pl-1 text-sm font-semibold ${className}`}
    >
      {children}
    </span>
  );
}
