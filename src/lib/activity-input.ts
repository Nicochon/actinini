import type { PaymentMode } from "@/lib/database.types";

/**
 * Lecture des créneaux et des lignes de budget envoyés par les formulaires.
 *
 * Les server actions sont des points d'entrée réseau : la charge utile arrive
 * telle quelle depuis le client et peut être malformée ou hostile. On ne fait
 * donc confiance ni aux types, ni à la présence des champs — d'où les
 * coercitions plutôt que des accès directs.
 */

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const PAYMENT_MODES: PaymentMode[] = ["advance", "on_site"];

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const id = (value: unknown) => (typeof value === "string" && value ? value : undefined);

export type ParsedDate = { id?: string; start: string; end: string | null };
export type ParsedBudget = { id?: string; label: string; amount: number; mode: PaymentMode };

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/** L'heure, facultative : vide donne null. Le navigateur envoie « 20:00 ». */
export function parseTime(raw: unknown): Parsed<string | null> {
  const value = text(raw);
  if (!value) return { ok: true, value: null };
  if (!TIME.test(value)) return { ok: false, error: "L'heure est invalide." };
  return { ok: true, value: value.slice(0, 5) };
}

/** Ignore les lignes laissées vides : un créneau sans date de début n'existe pas. */
export function parseDates(raw: unknown): Parsed<ParsedDate[]> {
  if (!Array.isArray(raw)) return { ok: false, error: "Dates proposées illisibles." };

  const dates = raw
    .map((entry) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      const end = text(row.end);
      return { id: id(row.id), start: text(row.start), end: end || null };
    })
    .filter((d) => d.start);

  if (dates.some((d) => !ISO_DAY.test(d.start) || (d.end && !ISO_DAY.test(d.end)))) {
    return { ok: false, error: "Une des dates proposées est invalide." };
  }
  if (dates.some((d) => d.end && d.end < d.start)) {
    return { ok: false, error: "Une date de fin précède sa date de début." };
  }
  return { ok: true, value: dates };
}

/** Une ligne entièrement vide est ignorée ; une ligne à moitié remplie est une erreur. */
export function parseBudget(raw: unknown): Parsed<ParsedBudget[]> {
  if (!Array.isArray(raw)) return { ok: false, error: "Budget illisible." };

  const rows = raw
    .map((entry) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      const rawAmount = text(row.amount);
      return {
        id: id(row.id),
        label: text(row.label),
        amount: rawAmount === "" ? Number.NaN : Number(rawAmount),
        mode: row.mode,
      };
    })
    .filter((b) => b.label || !Number.isNaN(b.amount));

  if (rows.some((b) => !b.label)) {
    return { ok: false, error: "Chaque ligne de budget a besoin d'un libellé." };
  }
  if (rows.some((b) => !Number.isFinite(b.amount) || b.amount < 0)) {
    return { ok: false, error: "Chaque ligne de budget a besoin d'un montant positif." };
  }
  if (rows.some((b) => !PAYMENT_MODES.includes(b.mode as PaymentMode))) {
    return { ok: false, error: "Mode de paiement inconnu." };
  }

  return { ok: true, value: rows.map((b) => ({ ...b, mode: b.mode as PaymentMode })) };
}

/** Identifiants de lignes à supprimer, filtrés de tout ce qui n'est pas exploitable. */
export function parseIds(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string" && x !== "") : [];
}
