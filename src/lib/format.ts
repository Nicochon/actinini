import type { ActivityStatus, DateOption } from "@/lib/database.types";

/**
 * Les dates sont stockées en `date` nue (`YYYY-MM-DD`). On les lit en UTC
 * pour éviter qu'un fuseau négatif ne fasse reculer le jour affiché.
 */
function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

const dayMonth = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const dayOnly = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  timeZone: "UTC",
});
const withYear = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * « sam. 14 septembre » pour une journée,
 * « ven. 16 au dim. 18 octobre » pour une plage dans le même mois,
 * « ven. 30 octobre au dim. 2 novembre » sinon.
 * L'année n'apparaît que si le créneau ne tombe pas dans l'année courante.
 */
export function formatDateRange({ start_date, end_date }: Pick<DateOption, "start_date" | "end_date">) {
  const start = parseDay(start_date);
  const showYear = start.getUTCFullYear() !== new Date().getFullYear();

  if (!end_date || end_date === start_date) {
    return (showYear ? withYear : dayMonth).format(start);
  }

  const end = parseDay(end_date);
  const sameMonth =
    start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();

  const left = sameMonth ? dayOnly.format(start) : dayMonth.format(start);
  const right = (showYear ? withYear : dayMonth).format(end);
  return `${left} au ${right}`;
}

const euros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

export function formatEuros(amount: number) {
  // Les montants ronds s'affichent « 95 € » plutôt que « 95,00 € ».
  return euros.format(amount).replace(/,00\s/, " ");
}

/** Accord au pluriel : `plural(1, "vote")` → "1 vote". */
export function plural(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count > 1 ? plural : singular}`;
}

/** Énumération à la française : « Marie, Léo et Nina ». */
export function joinNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

export const STATUS_LABELS: Record<ActivityStatus, string> = {
  voting: "Vote en cours",
  confirmed: "Date fixée",
  completed: "Passée",
  cancelled: "Annulée",
};
