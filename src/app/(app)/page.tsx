import Link from "next/link";

import { ActivityIcon } from "@/components/activity-icon";
import { Avatar, AvatarStack } from "@/components/avatar";
import { Calendar, type CalendarEvent } from "@/components/calendar";
import { SectionLabel, Stamp } from "@/components/ui";
import type { ActivityStatus, DateOption, Profile } from "@/lib/database.types";
import { formatTime, formatWhen, plural, todayInParis } from "@/lib/format";
import { requireProfile } from "@/lib/session";

type Person = Pick<Profile, "id" | "full_name" | "pseudo">;

type ActivityRow = {
  id: string;
  title: string;
  icon: string;
  location: string | null;
  status: ActivityStatus;
  created_at: string;
  start_time: string | null;
  confirmed_date_option_id: string | null;
  confirmed_date: Pick<DateOption, "start_date" | "end_date"> | null;
  activity_participants: { profile_id: string; declined: boolean; profile: Person }[];
  date_options: { id: string; start_date: string; end_date: string | null }[];
  votes: { date_option_id: string; profile_id: string }[];
};

/**
 * Qui a dit oui — ou `null` tant que la question ne se pose pas.
 *
 * Même règle que la page de détail : la présence se joue sur la date retenue —
 * un créneau unique l'étant d'office, par trigger. Tant que plusieurs dates
 * sont en lice et qu'aucune n'est tranchée, un vote dit « je suis dispo ce
 * jour-là », pas « je viens » : personne n'a encore répondu à la question.
 */
function attendeesOf(activity: ActivityRow): Person[] | null {
  const attendanceDateId = activity.confirmed_date_option_id;
  if (!attendanceDateId) return null;

  const declined = new Set(
    activity.activity_participants.filter((p) => p.declined).map((p) => p.profile_id),
  );
  const coming = new Set(
    activity.votes
      .filter((vote) => vote.date_option_id === attendanceDateId && !declined.has(vote.profile_id))
      .map((vote) => vote.profile_id),
  );
  return activity.activity_participants
    .filter((p) => coming.has(p.profile_id))
    .map((p) => p.profile);
}


/** Une activité est « passée » si elle est close, ou si sa date confirmée est écoulée. */
function isPast(activity: ActivityRow) {
  if (activity.status === "completed" || activity.status === "cancelled") return true;

  const confirmed = activity.confirmed_date;
  if (!confirmed) return false;

  return (confirmed.end_date ?? confirmed.start_date) < todayInParis();
}

const longDay = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});
const blockWeekday = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" });
const blockMonth = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });

/** « dans 2 jours », « demain », « aujourd'hui » — pour la prochaine sortie. */
function countdown(startDate: string) {
  const days = Math.round(
    (Date.parse(`${startDate}T00:00:00Z`) - Date.parse(`${todayInParis()}T00:00:00Z`)) / 86_400_000,
  );
  if (days <= 0) return "c'est aujourd'hui";
  if (days === 1) return "c'est demain";
  return `dans ${days} jours`;
}

/** Le prénom, pour saluer : le premier mot du nom complet, à défaut le pseudo. */
function firstName(profile: Person) {
  return profile.full_name?.trim().split(/\s+/)[0] || profile.pseudo || "";
}

export default async function ActivitiesPage() {
  const { supabase, profile } = await requireProfile();

  // La RLS restreint déjà aux activités où l'on est invité (ou créateur).
  const { data, error } = await supabase
    .from("activities")
    .select(
      `id, title, icon, location, status, created_at, start_time, confirmed_date_option_id,
       confirmed_date:date_options!activities_confirmed_date_option_fkey(start_date, end_date),
       activity_participants(profile_id, declined, profile:profiles(id, full_name, pseudo)),
       date_options!date_options_activity_id_fkey(id, start_date, end_date),
       votes(date_option_id, profile_id)`,
    )
    .order("created_at", { ascending: false })
    .overrideTypes<ActivityRow[]>();

  if (error) {
    return (
      <>
        <Header profile={profile} />
        <p className="text-brick-deep bg-brick-pale rounded-2xl px-4 py-3 text-sm">
          Impossible de charger les activités : {error.message}
        </p>
      </>
    );
  }

  const activities = data ?? [];
  const declinedByMe = (activity: ActivityRow) =>
    activity.activity_participants.some(
      (person) => person.profile_id === profile.id && person.declined,
    );

  const upcoming = activities.filter((a) => !isPast(a));
  const past = activities.filter(isPast);

  const toDecide = upcoming.filter((a) => !a.confirmed_date_option_id);
  const planned = upcoming
    .filter((a) => a.confirmed_date)
    .sort((a, b) => a.confirmed_date!.start_date.localeCompare(b.confirmed_date!.start_date));

  // La prochaine sortie mise en avant : la plus proche parmi celles où l'on
  // n'a pas dit non. Les autres sorties datées suivent, plus bas.
  const next = planned.find((a) => !declinedByMe(a));
  const later = planned.filter((a) => a !== next);

  /**
   * Ce que le calendrier affiche : chaque créneau encore en lice. Une fois la
   * date tranchée, les créneaux écartés disparaissent — les garder donnerait
   * trois week-ends à Lisbonne pour un seul voyage.
   *
   * N'y figurent ni les activités annulées, ni celles qu'on a déclinées : le
   * calendrier est le sien, pas celui du groupe.
   */
  const events: CalendarEvent[] = activities
    .filter((activity) => activity.status !== "cancelled" && !declinedByMe(activity))
    .flatMap((activity) => {
      const options = activity.confirmed_date_option_id
        ? activity.date_options.filter((o) => o.id === activity.confirmed_date_option_id)
        : activity.date_options;

      return options.map((option) => ({
        activityId: activity.id,
        title: activity.title,
        start: option.start_date,
        end: option.end_date ?? option.start_date,
        confirmed: option.id === activity.confirmed_date_option_id,
        time: activity.start_time ? formatTime(activity.start_time) : null,
      }));
    });

  return (
    <>
      <Header profile={profile} />

      {next && <NextOuting activity={next} meId={profile.id} />}

      <Calendar events={events} />

      {activities.length === 0 && (
        <p className="text-ink-soft mt-5 text-center text-sm">
          {profile.is_admin
            ? "Aucune activité pour l'instant — crée la première depuis l'onglet « Créer »."
            : "Aucune activité pour l'instant. L'admin t'invitera dès qu'il en crée une."}
        </p>
      )}

      {toDecide.length > 0 && (
        <section className="mb-7">
          <SectionLabel>À décider</SectionLabel>
          <div className="flex flex-col gap-3">
            {toDecide.map((activity) => (
              <VotingCard key={activity.id} activity={activity} />
            ))}
          </div>
        </section>
      )}

      {later.length > 0 && (
        <section className="mb-7">
          <SectionLabel>À venir</SectionLabel>
          <div className="flex flex-col gap-3">
            {later.map((activity) => (
              <PlannedCard key={activity.id} activity={activity} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="mb-7">
          <SectionLabel>Souvenirs</SectionLabel>
          <div className="flex flex-col gap-3">
            {past.map((activity) => (
              <PastCard key={activity.id} activity={activity} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Header({ profile }: { profile: Person }) {
  const today = longDay.format(new Date());
  return (
    <header className="mb-6 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-ink-soft text-[13px] font-medium first-letter:uppercase">{today}</p>
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-[-0.01em]">
          Salut {firstName(profile)}
        </h1>
      </div>
      <Link href="/profile" aria-label="Ton profil" className="shrink-0">
        <Avatar person={profile} size={44} />
      </Link>
    </header>
  );
}

/** La carte terracotta de la sortie la plus proche. */
function NextOuting({ activity, meId }: { activity: ActivityRow; meId: string }) {
  const date = activity.confirmed_date!;
  const start = new Date(`${date.start_date}T00:00:00Z`);
  const attendees = attendeesOf(activity) ?? [];
  const imIn = attendees.some((person) => person.id === meId);
  const details = [activity.start_time && formatTime(activity.start_time), activity.location]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/activities/${activity.id}`}
      className="bg-brick hover:bg-brick-deep mb-7 flex flex-col gap-4 rounded-[24px] p-5 text-white transition-colors"
    >
      <p className="text-[12px] font-bold tracking-[0.08em] text-[#ffd9c7] uppercase">
        Prochaine sortie · {countdown(date.start_date)}
      </p>
      <div className="flex items-center gap-4">
        <span className="text-brick flex w-16 shrink-0 flex-col items-center rounded-2xl bg-white py-2 leading-none">
          <span className="text-[11px] font-bold tracking-[0.08em] uppercase">
            {blockWeekday.format(start).replace(".", "")}
          </span>
          <span className="font-display my-1 text-[28px] font-semibold">{start.getUTCDate()}</span>
          <span className="text-[11px] font-bold tracking-[0.08em] uppercase">
            {blockMonth.format(start).replace(".", "")}
          </span>
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="font-display text-[22px] leading-tight font-semibold">{activity.title}</span>
          {details && <span className="text-sm text-[#ffe6da]">{details}</span>}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          {attendees.length > 0 && (
            <AvatarStack people={attendees} size={30} ring="var(--color-brick)" />
          )}
          <span className="text-sm font-semibold">
            {attendees.length === 0
              ? "Personne n'a encore confirmé"
              : `${attendees.length} ${attendees.length > 1 ? "viennent" : "vient"}`}
          </span>
        </span>
        <span className="text-brick shrink-0 rounded-full bg-white px-4 py-2.5 text-[15px] font-bold">
          {imIn ? "Tu viens ✓" : "Répondre"}
        </span>
      </div>
    </Link>
  );
}

/** Une activité dont la date reste à choisir : où en est le vote. */
function VotingCard({ activity }: { activity: ActivityRow }) {
  const invited = activity.activity_participants.filter((p) => !p.declined);
  const voters = new Set(activity.votes.map((vote) => vote.profile_id));
  const voted = invited.filter((p) => voters.has(p.profile_id)).length;
  const share = invited.length > 0 ? Math.round((100 * voted) / invited.length) : 0;
  const options = activity.date_options.length;

  return (
    <Link
      href={`/activities/${activity.id}`}
      className="bg-paper-raised hover:bg-paper-sunk flex items-center gap-3.5 rounded-[20px] p-4 shadow-[0_1px_0_var(--color-line)] transition-colors"
    >
      <ActivityIcon name={activity.icon} size={52} />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-base font-bold">{activity.title}</span>
        <span className="bg-line-soft h-1.5 rounded-full">
          <span className="bg-amber block h-1.5 rounded-full" style={{ width: `${share}%` }} />
        </span>
        <span className="text-ink-soft text-[13px]">
          {voted} sur {invited.length} ont voté
          {options > 0 ? ` · ${plural(options, "date")} en lice` : " · aucune date proposée"}
        </span>
      </span>
    </Link>
  );
}

/** Une autre sortie datée, après la prochaine. */
function PlannedCard({ activity }: { activity: ActivityRow }) {
  const attendees = attendeesOf(activity) ?? [];
  return (
    <Link
      href={`/activities/${activity.id}`}
      className="bg-paper-raised hover:bg-paper-sunk flex items-center gap-3.5 rounded-[20px] p-4 shadow-[0_1px_0_var(--color-line)] transition-colors"
    >
      <ActivityIcon name={activity.icon} size={52} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-base font-bold">{activity.title}</span>
        <span className="text-ink-soft text-[13px]">
          {formatWhen(activity.confirmed_date!, activity.start_time)}
        </span>
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          {attendees.length > 0 && <AvatarStack people={attendees} size={24} />}
          {attendees.length === 0 ? "Personne n'a encore confirmé" : plural(attendees.length, "participant")}
        </span>
      </span>
    </Link>
  );
}

/** Une sortie passée ou annulée, en retrait. */
function PastCard({ activity }: { activity: ActivityRow }) {
  const attendees = attendeesOf(activity);
  const meta = [
    activity.confirmed_date && formatWhen(activity.confirmed_date, null),
    attendees && attendees.length > 0
      ? `${attendees.length} ${attendees.length > 1 ? "étaient là" : "était là"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/activities/${activity.id}`}
      className="bg-paper-sunk hover:bg-line-soft flex items-center gap-3.5 rounded-[20px] px-4 py-3.5 transition-colors"
    >
      <ActivityIcon name={activity.icon} size={44} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold">{activity.title}</span>
        {meta && <span className="text-ink-soft text-[13px]">{meta}</span>}
      </span>
      {activity.status === "cancelled" && <Stamp status="cancelled" />}
    </Link>
  );
}
