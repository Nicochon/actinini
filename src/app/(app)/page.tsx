import Link from "next/link";

import { Stamp } from "@/components/ui";
import type { ActivityStatus, DateOption } from "@/lib/database.types";
import { formatDateRange, plural } from "@/lib/format";
import { requireProfile } from "@/lib/session";

type ActivityRow = {
  id: string;
  title: string;
  status: ActivityStatus;
  created_at: string;
  confirmed_date_option_id: string | null;
  confirmed_date: Pick<DateOption, "start_date" | "end_date"> | null;
  activity_participants: { count: number }[];
  date_options: { id: string }[];
  votes: { date_option_id: string }[];
};

/**
 * Combien de personnes ont dit oui — ou `null` tant que la question ne se pose
 * pas.
 *
 * Même règle que la page de détail : la présence se joue sur la date retenue,
 * ou sur l'unique créneau proposé quand il n'y en a qu'un. Tant que plusieurs
 * dates sont en lice et qu'aucune n'est tranchée, un vote dit « je suis dispo
 * ce jour-là », pas « je viens » : personne n'a encore répondu à la question,
 * et la carte s'en tient au nombre d'invités.
 */
function attendeeCount(activity: ActivityRow): number | null {
  const attendanceDateId =
    activity.confirmed_date_option_id ??
    (activity.date_options.length === 1 ? activity.date_options[0].id : null);

  if (!attendanceDateId) return null;

  return activity.votes.filter((vote) => vote.date_option_id === attendanceDateId).length;
}

/** Une activité est « passée » si elle est close, ou si sa date confirmée est écoulée. */
function isPast(activity: ActivityRow) {
  if (activity.status === "completed" || activity.status === "cancelled") return true;

  const confirmed = activity.confirmed_date;
  if (!confirmed) return false;

  const lastDay = confirmed.end_date ?? confirmed.start_date;
  const today = new Date().toISOString().slice(0, 10);
  return lastDay < today;
}

function ActivityCard({ activity }: { activity: ActivityRow }) {
  const attendees = attendeeCount(activity);
  const invited = activity.activity_participants[0]?.count ?? 0;

  const people =
    attendees === null
      ? plural(invited, "invité")
      : attendees === 0
        ? "Aucun participant"
        : plural(attendees, "participant");

  const meta = [people, activity.confirmed_date && formatDateRange(activity.confirmed_date)].filter(
    Boolean,
  );

  return (
    <Link
      href={`/activities/${activity.id}`}
      className="border-line bg-paper-raised hover:border-ink-soft mb-3.5 flex items-start justify-between gap-3 rounded-[4px] border p-5 transition-colors"
    >
      <div className="min-w-0">
        <div className="font-display mb-1 text-[17px] font-medium">{activity.title}</div>
        <div className="text-ink-soft text-[13px]">{meta.join(" · ")}</div>
      </div>
      <Stamp status={activity.status} />
    </Link>
  );
}

export default async function ActivitiesPage() {
  const { supabase, profile } = await requireProfile();

  // La RLS restreint déjà aux activités où l'on est invité (ou créateur).
  const { data, error } = await supabase
    .from("activities")
    .select(
      `id, title, status, created_at, confirmed_date_option_id,
       confirmed_date:date_options!activities_confirmed_date_option_fkey(start_date, end_date),
       activity_participants(count),
       date_options!date_options_activity_id_fkey(id),
       votes(date_option_id)`,
    )
    .order("created_at", { ascending: false })
    .overrideTypes<ActivityRow[]>();

  if (error) {
    return (
      <>
        <Header />
        <p className="text-brick-deep bg-brick-pale rounded-md px-3 py-2 text-[13px]">
          Impossible de charger les activités : {error.message}
        </p>
      </>
    );
  }

  const activities = data ?? [];
  const upcoming = activities.filter((a) => !isPast(a));
  const past = activities.filter(isPast);

  return (
    <>
      <Header />

      {activities.length === 0 && (
        <p className="text-ink-soft mt-5 text-center text-[13px]">
          {profile.is_admin
            ? "Aucune activité pour l'instant — crée la première depuis l'onglet « Nouvelle activité »."
            : "Aucune activité pour l'instant. L'admin t'invitera dès qu'il en crée une."}
        </p>
      )}

      {upcoming.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} />
      ))}

      {past.length > 0 && (
        <>
          <h2 className="text-ink-soft mt-8 mb-3 text-xs font-semibold tracking-[0.04em] uppercase">
            Passées
          </h2>
          {past.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </>
      )}
    </>
  );
}

function Header() {
  return (
    <header className="border-line mb-7 border-b pb-4">
      <h1 className="font-display text-2xl font-medium tracking-[-0.01em]">Nos activités</h1>
    </header>
  );
}
