"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { todayInParis } from "@/lib/format";

/**
 * Un créneau posé sur le calendrier. Une activité en cours de vote en fournit
 * autant qu'elle propose de dates ; une fois la date tranchée, il n'en reste
 * qu'un — les créneaux écartés n'ont plus rien à faire là.
 */
export type CalendarEvent = {
  activityId: string;
  title: string;
  /** Date ISO `YYYY-MM-DD`. */
  start: string;
  /** Même valeur que `start` pour une journée unique. */
  end: string;
  confirmed: boolean;
  /** « 20h », si l'activité a une heure. */
  time?: string | null;
};

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

const monthLabel = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Tout se calcule en UTC, comme dans `format.ts` : les dates sont stockées en
 * `date` nue, et un fuseau négatif ferait reculer le jour affiché d'un cran.
 */
function iso(day: Date) {
  return day.toISOString().slice(0, 10);
}

function addDays(day: Date, count: number) {
  const copy = new Date(day);
  copy.setUTCDate(copy.getUTCDate() + count);
  return copy;
}

/** Le lundi de la semaine contenant ce jour. */
function startOfWeek(day: Date) {
  return addDays(day, -((day.getUTCDay() + 6) % 7));
}

/** Les semaines à afficher pour ce mois, lundi en tête, débords compris. */
function weeksOf(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));

  const weeks: Date[][] = [];
  for (let cursor = startOfWeek(first); cursor <= last; cursor = addDays(cursor, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(cursor, index)));
  }
  return weeks;
}

const dayLabel = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  timeZone: "UTC",
});
const dayMonthLabel = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** « mar. 29 » pour un jour, « 16 → 18 oct. » pour un séjour. */
function spanLabel(event: CalendarEvent) {
  const start = new Date(`${event.start}T00:00:00Z`);
  if (event.start === event.end) return dayLabel.format(start);
  const end = new Date(`${event.end}T00:00:00Z`);
  return `${start.getUTCDate()} → ${dayMonthLabel.format(end)}`;
}

/** Le mois en cours, à l'heure française. */
function currentMonth() {
  const [year, month] = todayInParis().split("-").map(Number);
  return { year, month: month - 1 };
}

export function Calendar({ events }: { events: CalendarEvent[] }) {
  const today = todayInParis();
  const [cursor, setCursor] = useState(currentMonth);

  const weeks = useMemo(() => weeksOf(cursor.year, cursor.month), [cursor]);

  const shown = new Date(Date.UTC(cursor.year, cursor.month, 1));
  const monthStart = iso(shown);
  const monthEnd = iso(new Date(Date.UTC(cursor.year, cursor.month + 1, 0)));
  const now = currentMonth();
  const onCurrentMonth = cursor.year === now.year && cursor.month === now.month;

  /** Les sorties qui touchent le mois affiché, dans l'ordre. */
  const monthEvents = events
    .filter((event) => event.start <= monthEnd && event.end >= monthStart)
    .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));

  /**
   * L'état d'un jour : fixé l'emporte sur « en vote ». Un jour couvert par une
   * sortie confirmée et par un créneau encore en lice se lit comme pris.
   */
  const stateOf = (day: string) => {
    const covering = monthEvents.filter((event) => event.start <= day && event.end >= day);
    if (covering.some((event) => event.confirmed)) return "confirmed";
    if (covering.length > 0) return "voting";
    return null;
  };

  const shift = (months: number) =>
    setCursor(({ year, month }) => {
      const moved = new Date(Date.UTC(year, month + months, 1));
      return { year: moved.getUTCFullYear(), month: moved.getUTCMonth() };
    });

  return (
    <section className="bg-paper-raised mb-7 rounded-[24px] px-3.5 pt-4 pb-3.5 shadow-[0_1px_0_var(--color-line)]">
      <header className="mb-2 flex items-center justify-between gap-2 px-1">
        <h2 className="font-display text-[20px] font-semibold first-letter:uppercase">
          {monthLabel.format(shown)}
        </h2>
        <div className="flex items-center gap-1.5">
          {!onCurrentMonth && (
            <button
              type="button"
              onClick={() => setCursor(currentMonth())}
              className="text-brick hover:text-brick-deep mr-1 text-[13px] font-semibold"
            >
              Aujourd&apos;hui
            </button>
          )}
          <NavButton label="Mois précédent" onClick={() => shift(-1)} path="M15 5l-7 7 7 7" />
          <NavButton label="Mois suivant" onClick={() => shift(1)} path="M9 5l7 7-7 7" />
        </div>
      </header>

      <div className="text-ink-soft grid grid-cols-7 pt-1 text-center text-[12px] font-bold">
        {WEEKDAYS.map((day, index) => (
          <span key={index}>{day}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5 pt-1">
        {weeks.flat().map((day) => {
          const key = iso(day);
          const inMonth = day.getUTCMonth() === cursor.month;
          const state = inMonth ? stateOf(key) : null;
          const isToday = key === today;

          const tone =
            state === "confirmed"
              ? "bg-brick text-white font-bold"
              : state === "voting"
                ? "border-brick text-brick-deep border-2 border-dashed font-bold"
                : isToday
                  ? "border-ink border-2 font-bold"
                  : "";

          return (
            <span key={key} className="flex h-10 items-center justify-center">
              <span
                className={`flex size-[34px] items-center justify-center rounded-full text-sm ${
                  inMonth ? "text-ink" : "text-line"
                } ${tone} ${isToday && state ? "ring-ink ring-2 ring-offset-2 ring-offset-[var(--color-paper-raised)]" : ""}`}
              >
                {day.getUTCDate()}
              </span>
            </span>
          );
        })}
      </div>

      <div className="border-line-soft mt-1 flex flex-col gap-1 border-t px-1 pt-3">
        {monthEvents.length === 0 && (
          <p className="text-ink-soft py-1 text-sm">Rien de prévu ce mois-ci.</p>
        )}
        {monthEvents.map((event) => (
          <Link
            key={`${event.activityId}-${event.start}`}
            href={`/activities/${event.activityId}`}
            className="hover:bg-paper -mx-1 flex min-h-[40px] items-center gap-2.5 rounded-xl px-1 text-sm transition-colors"
          >
            <span
              aria-hidden
              className={`size-2.5 shrink-0 rounded-full ${
                event.confirmed ? "bg-brick" : "border-brick border-2 border-dashed"
              }`}
            />
            <span className="min-w-0">
              <strong className="font-bold">{spanLabel(event)}</strong> · {event.title}
              {event.time ? `, ${event.time}` : ""}
            </span>
          </Link>
        ))}
        <p className="text-ink-soft flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 pb-0.5 text-[12px]">
          <span className="flex items-center gap-1.5">
            <span className="bg-brick inline-block size-2.5 rounded-full" />
            date fixée
          </span>
          <span className="flex items-center gap-1.5">
            <span className="border-brick inline-block size-2.5 rounded-full border-2 border-dashed" />
            en vote
          </span>
        </p>
      </div>
    </section>
  );
}

function NavButton({ label, onClick, path }: { label: string; onClick: () => void; path: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="bg-paper hover:bg-line-soft text-ink flex size-11 items-center justify-center rounded-full transition-colors"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        width={18}
        height={18}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
      >
        <path d={path} />
      </svg>
    </button>
  );
}
