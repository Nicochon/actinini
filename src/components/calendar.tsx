"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
};

const WEEKDAYS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

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

/**
 * Les segments à tracer sur une semaine.
 *
 * Un séjour à cheval sur deux semaines donne un segment dans chacune, coupé au
 * bord : c'est ce découpage qui permet de tracer une barre continue par ligne
 * plutôt qu'une pastille par jour.
 */
function segmentsOf(week: Date[], events: CalendarEvent[]) {
  const from = iso(week[0]);
  const to = iso(week[6]);

  return events
    .filter((event) => event.start <= to && event.end >= from)
    .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title))
    .map((event) => {
      const startIndex = event.start <= from ? 0 : week.findIndex((day) => iso(day) === event.start);
      const endIndex = event.end >= to ? 6 : week.findIndex((day) => iso(day) === event.end);

      return {
        event,
        column: startIndex + 1,
        span: endIndex - startIndex + 1,
        /** Une barre coupée par le bord de la semaine ne s'arrondit pas de ce côté. */
        openLeft: event.start < from,
        openRight: event.end > to,
      };
    });
}

export function Calendar({ events }: { events: CalendarEvent[] }) {
  const today = iso(new Date());
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  });

  const weeks = useMemo(() => weeksOf(cursor.year, cursor.month), [cursor]);
  const weekSegments = useMemo(
    () => weeks.map((week) => segmentsOf(week, events)),
    [weeks, events],
  );

  /**
   * Toutes les semaines réservent la même hauteur, celle de la plus chargée du
   * mois. Sans cette réserve, une semaine qui reçoit une sortie pousse ses
   * voisines vers le bas et la grille se déforme d'un mois à l'autre. Une ligne
   * au minimum, même sur un mois sans rien : l'espacement doit être le même
   * partout.
   */
  const lines = Math.max(1, ...weekSegments.map((segments) => segments.length));

  const shown = new Date(Date.UTC(cursor.year, cursor.month, 1));
  const onCurrentMonth =
    cursor.year === new Date().getUTCFullYear() && cursor.month === new Date().getUTCMonth();

  const shift = (months: number) =>
    setCursor(({ year, month }) => {
      const moved = new Date(Date.UTC(year, month + months, 1));
      return { year: moved.getUTCFullYear(), month: moved.getUTCMonth() };
    });

  return (
    <section className="border-line bg-paper-raised mb-7 rounded-[4px] border p-4 sm:p-5">
      <header className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-[17px] font-medium first-letter:uppercase">
          {monthLabel.format(shown)}
        </h2>
        <div className="flex items-center gap-1.5">
          {!onCurrentMonth && (
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setCursor({ year: now.getUTCFullYear(), month: now.getUTCMonth() });
              }}
              className="text-ink-soft hover:text-ink mr-1 text-[12px] underline transition-colors"
            >
              Aujourd&apos;hui
            </button>
          )}
          <NavButton label="Mois précédent" onClick={() => shift(-1)}>
            ‹
          </NavButton>
          <NavButton label="Mois suivant" onClick={() => shift(1)}>
            ›
          </NavButton>
        </div>
      </header>

      <div className="text-ink-soft grid grid-cols-7 text-center text-[11px] font-medium tracking-[0.04em] uppercase">
        {WEEKDAYS.map((day, index) => (
          <span key={index}>{day}</span>
        ))}
      </div>

      {weeks.map((week, weekIndex) => (
        <div
          key={iso(week[0])}
          className={`pt-2 pb-1.5 ${weekIndex > 0 ? "border-line-soft border-t" : ""}`}
        >
          <div className="grid grid-cols-7 text-center">
            {week.map((day) => {
              const inMonth = day.getUTCMonth() === cursor.month;
              const isToday = iso(day) === today;

              return (
                <span
                  key={iso(day)}
                  className={`text-[13px] ${inMonth ? "text-ink" : "text-line"} ${
                    isToday ? "font-semibold" : ""
                  }`}
                >
                  <span
                    className={
                      isToday
                        ? "bg-ink text-paper inline-block size-[22px] rounded-full leading-[22px]"
                        : "inline-block leading-[22px]"
                    }
                  >
                    {day.getUTCDate()}
                  </span>
                </span>
              );
            })}
          </div>

          {/* Autant de lignes de barres que la semaine la plus chargée, les
              vides comprises : c'est ce qui donne à toutes les semaines la
              même hauteur. */}
          <div className="mt-1.5 space-y-[3px]">
            {Array.from({ length: lines }, (_, line) => {
              const segment = weekSegments[weekIndex][line];

              return (
                <div key={line} className="grid h-[20px] grid-cols-7">
                  {segment && (
                    <Link
                      href={`/activities/${segment.event.activityId}`}
                      style={{ gridColumn: `${segment.column} / span ${segment.span}` }}
                      title={segment.event.title}
                      className={`block h-full truncate px-1.5 text-[11px] leading-[18px] font-medium transition-opacity hover:opacity-80 ${
                        segment.event.confirmed
                          ? "bg-sage-pale text-sage-deep border-sage border"
                          : "border-line text-ink-soft bg-paper border border-dashed"
                      } ${segment.openLeft ? "rounded-l-none" : "rounded-l-[3px]"} ${
                        segment.openRight ? "rounded-r-none" : "rounded-r-[3px]"
                      }`}
                    >
                      {segment.event.title}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-ink-soft border-line-soft mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="bg-sage-pale border-sage inline-block h-2.5 w-4 rounded-[2px] border" />
          date fixée
        </span>
        <span className="flex items-center gap-1.5">
          <span className="border-line bg-paper inline-block h-2.5 w-4 rounded-[2px] border border-dashed" />
          en cours de vote
        </span>
      </p>
    </section>
  );
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="border-line text-ink-soft hover:border-ink-soft flex size-7 items-center justify-center rounded-md border text-[15px] transition-colors"
    >
      {children}
    </button>
  );
}
