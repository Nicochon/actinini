import type { ComponentProps, ReactNode } from "react";

import type { ActivityStatus } from "@/lib/database.types";
import { STATUS_LABELS } from "@/lib/format";

/** Badge de statut, en forme de pilule tamponnée. */
export function Stamp({ status }: { status: ActivityStatus }) {
  const tone: Record<ActivityStatus, string> = {
    voting: "text-amber-deep bg-amber-pale border-current",
    confirmed: "text-sage-deep bg-sage-pale border-current",
    completed: "text-ink-soft bg-line-soft border-line",
    cancelled: "text-brick-deep bg-brick-pale border-current",
  };

  return (
    <span
      className={`inline-block shrink-0 rounded-[20px] border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${tone[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Intitulé de section en petites capitales espacées. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-ink-soft mb-3 text-xs font-semibold tracking-[0.04em] uppercase">
      {children}
    </h2>
  );
}

/** Carte blanche à coins nets, l'unité de base du layout. */
export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`border-line bg-paper-raised rounded-[4px] border p-5 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Séparateur de section. `bleed` la fait déborder du padding d'une Card pour
 * qu'elle aille d'un bord à l'autre, comme la perforation d'un vrai ticket.
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
      className={`bg-ink text-paper hover:bg-ink-hover mt-6 w-full rounded-md px-5 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
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
      className={`border-line text-ink-soft hover:border-ink-soft w-full rounded-md border border-dashed py-2.5 text-[13px] transition-colors ${className}`}
    />
  );
}

/** Message d'erreur d'un formulaire. */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="text-brick-deep bg-brick-pale mt-4 rounded-md px-3 py-2 text-[13px]"
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
      <span className="text-ink-soft mb-1.5 block text-[13px] font-medium">
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
      className={`border-line bg-paper inline-flex items-center gap-1.5 rounded-[20px] border px-3 py-1.5 text-[13px] ${className}`}
    >
      {children}
    </span>
  );
}
