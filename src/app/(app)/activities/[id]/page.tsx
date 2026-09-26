import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityIcon } from "@/components/activity-icon";
import { AvatarStack } from "@/components/avatar";
import { Card, SectionLabel, Stamp } from "@/components/ui";
import type {
  Activity,
  BudgetItem,
  DateOption,
  Payment,
  Profile,
  Vote,
} from "@/lib/database.types";
import { displayName, formatEuros, formatTime, formatWhen, plural } from "@/lib/format";
import { awaitingIds, formatReminderTime, nextReminderAt } from "@/lib/reminders";
import { requireProfile } from "@/lib/session";

import {
  AttendanceAnswer,
  ConfirmDateButton,
  ParticipantsEditor,
  PaymentToggle,
  RemindButton,
  VoteButton,
} from "./controls";

type PaymentRow = Pick<
  Payment,
  "id" | "budget_item_id" | "profile_id" | "paid"
>;

/** L'activité, avec l'organisateur qu'il faudra rembourser. */
type ActivityDetail = Pick<
  Activity,
  | "id"
  | "title"
  | "description"
  | "location"
  | "icon"
  | "start_time"
  | "status"
  | "confirmed_date_option_id"
  | "created_by"
  | "reminded_at"
> & {
  organiser: Pick<Profile, "pseudo" | "full_name" | "payment_info"> | null;
};

/**
 * Messages rapportés par l'édition (voir `EditNotice`) : ce que la base a
 * décidé au-delà de ce qui était demandé. Ils arrivent par `?info=`, posé au
 * moment de la redirection.
 */
const NOTICES: Record<string, string> = {
  "lone-date": "Il ne reste qu'un créneau : il est retenu d'office.",
  "vote-reopened": "Un deuxième créneau est proposé : l'activité repasse au vote.",
  "confirmed-date-lost": "Le créneau retenu a été supprimé : l'activité est repassée en vote.",
};

export default async function ActivityDetailPage({
  params,
  searchParams,
}: PageProps<"/activities/[id]">) {
  const { id } = await params;
  const { info } = await searchParams;
  const notice = typeof info === "string" ? NOTICES[info] : undefined;
  const { supabase, profile } = await requireProfile();

  const [
    activityRes,
    participantsRes,
    dateOptionsRes,
    votesRes,
    budgetRes,
    paymentsRes,
  ] = await Promise.all([
    supabase
      .from("activities")
      .select(
        `id, title, icon, description, location, start_time, status, confirmed_date_option_id, created_by, reminded_at,
         organiser:profiles!activities_created_by_fkey(pseudo, full_name, payment_info)`,
      )
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<ActivityDetail>(),
    supabase
      .from("activity_participants")
      .select("declined, profile:profiles(id, full_name, pseudo)")
      .eq("activity_id", id)
      .overrideTypes<
        { declined: boolean; profile: Pick<Profile, "id" | "full_name" | "pseudo"> }[]
      >(),
    supabase
      .from("date_options")
      .select("id, start_date, end_date")
      .eq("activity_id", id)
      .order("start_date"),
    supabase
      .from("votes")
      .select("date_option_id, profile_id")
      .eq("activity_id", id),
    supabase
      .from("budget_items")
      .select("id, label, amount_per_person, payment_mode")
      .eq("activity_id", id)
      .order("created_at"),
    // Jointure interne : PostgREST filtre les paiements par l'activité de leur ligne de budget.
    supabase
      .from("payments")
      .select(
        "id, budget_item_id, profile_id, paid, budget_items!inner(activity_id)",
      )
      .eq("budget_items.activity_id", id)
      .overrideTypes<PaymentRow[]>(),
  ]);

  const activity = activityRes.data;
  // La RLS renvoie 0 ligne si l'on n'est ni invité ni créateur : même issue qu'un id inconnu.
  if (!activity) notFound();

  const isOwner = activity.created_by === profile.id;
  const participantRows = participantsRes.data ?? [];
  const participants = participantRows.map((row) => row.profile);
  const declinedIds = new Set(
    participantRows.filter((row) => row.declined).map((row) => row.profile.id),
  );
  const dateOptions: Pick<DateOption, "id" | "start_date" | "end_date">[] =
    dateOptionsRes.data ?? [];
  const votes: Pick<Vote, "date_option_id" | "profile_id">[] =
    votesRes.data ?? [];
  const budgetItems: Pick<
    BudgetItem,
    "id" | "label" | "amount_per_person" | "payment_mode"
  >[] = budgetRes.data ?? [];
  const payments = paymentsRes.data ?? [];

  const nameOf = new Map(participants.map((p) => [p.id, displayName(p)]));
  const isParticipant = nameOf.has(profile.id);

  /**
   * Le créneau sur lequel se joue la présence : la date retenue.
   *
   * Un créneau unique est retenu d'office, par trigger (voir
   * `confirm_lone_date_option` dans schema.sql) : pas besoin d'un cas
   * particulier ici.
   *
   * Tant qu'il vaut null — plusieurs dates, aucune tranchée — la question
   * posée reste « quand es-tu dispo ? » et personne n'a encore dit s'il
   * venait : inutile alors de distinguer invités et participants.
   */
  const attendanceDateId = activity.confirmed_date_option_id;

  // Une fois la date tranchée, un vote sur ce créneau vaut « je viens ». Rien
  // n'est figé pour autant : qui avait voté ailleurs peut encore se joindre,
  // qui avait voté là peut se retirer — c'est le même bouton.
  const attendeeIds = new Set(
    votes
      .filter((v) => v.date_option_id === attendanceDateId)
      .map((v) => v.profile_id),
  );
  // Décliner efface les votes (voir `setAttendance`) : les deux ensembles sont
  // disjoints. Le filtre reste, pour que l'affichage ne dépende pas d'un
  // invariant tenu ailleurs.
  const attendees = participants.filter(
    (p) => attendeeIds.has(p.id) && !declinedIds.has(p.id),
  );
  const declined = participants.filter((p) => declinedIds.has(p.id));
  /** Les invités dont on attend encore quelque chose : un refus n'en est plus un. */
  const stillInvited = participants.filter((p) => !declinedIds.has(p.id));
  const awaiting = participants.filter(
    (p) => !attendeeIds.has(p.id) && !declinedIds.has(p.id),
  );

  // La relance vise les mêmes personnes que `remindAwaiting`, qui recalcule
  // de son côté : ce compte ne sert qu'à l'affichage.
  const canRemind =
    isOwner && (activity.status === "voting" || activity.status === "confirmed");
  const remindCount = awaitingIds(
    participantRows.map((row) => ({ profile_id: row.profile.id, declined: row.declined })),
    votes,
    attendanceDateId,
    activity.created_by,
  ).length;
  const nextReminder = nextReminderAt(activity.reminded_at);

  // Comptes disponibles pour une invitation (admin seulement).
  const candidates = isOwner
    ? (
        (
          await supabase
            .from("profiles")
            .select("id, full_name, pseudo")
            .order("pseudo")
            .overrideTypes<Pick<Profile, "id" | "full_name" | "pseudo">[]>()
        ).data ?? []
      ).filter((p) => !nameOf.has(p.id))
    : [];

  const totalPerPerson = budgetItems.reduce(
    (sum, item) => sum + Number(item.amount_per_person),
    0,
  );

  /** Ce que je dois encore à l'organisateur, sur cette activité. */
  const myDue = payments
    .filter((p) => p.profile_id === profile.id && !p.paid)
    .reduce((sum, p) => {
      const item = budgetItems.find((b) => b.id === p.budget_item_id);
      return sum + Number(item?.amount_per_person ?? 0);
    }, 0);

  const hasAdvance = budgetItems.some((item) => item.payment_mode === "advance");
  const organiserName = activity.organiser
    ? displayName(activity.organiser)
    : "l'organisateur";

  const personOf = new Map(participants.map((p) => [p.id, p]));
  const confirmedOption = dateOptions.find((o) => o.id === attendanceDateId);

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link
          href="/"
          aria-label="Retour à l'accueil"
          className="bg-paper-raised hover:bg-paper-sunk flex size-11 items-center justify-center rounded-full transition-colors"
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
        {isOwner && (
          <Link
            href={`/activities/${activity.id}/edit`}
            className="bg-paper-raised hover:bg-paper-sunk flex min-h-[44px] items-center rounded-full px-4 text-sm font-semibold transition-colors"
          >
            Modifier
          </Link>
        )}
      </div>

      {notice && (
        <p role="status" className="text-amber-deep bg-amber-pale mb-5 rounded-2xl px-4 py-3 text-sm">
          {notice}
        </p>
      )}

      <header className="mb-7 flex flex-col items-start gap-2.5">
        <ActivityIcon name={activity.icon} size={60} />
        <h1 className="font-display text-[30px] leading-tight font-semibold">{activity.title}</h1>
        <p className="text-ink-soft text-[15px]">
          {isOwner ? "proposé par " : "organisé par "}
          <strong className="text-ink">{isOwner ? "toi" : organiserName}</strong>
        </p>
        {activity.location && (
          <p className="text-ink-soft flex flex-wrap items-baseline gap-x-2 text-[15px]">
            <span>{activity.location}</span>
            {/* Lien explicite plutôt que lieu cliquable : ouvrir une carte, c'est
                envoyer l'adresse à un tiers — autant que ce soit un geste voulu. */}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location)}`}
              target="_blank"
              rel="noreferrer noopener"
              className="text-brick text-sm font-semibold underline"
            >
              voir sur une carte
            </a>
          </p>
        )}
        {activity.description && (
          <p className="text-[15px] whitespace-pre-line">{activity.description}</p>
        )}
        <Stamp status={activity.status} />
      </header>

      {/* ---------- La date ---------- */}
      {confirmedOption ? (
        <section className="mb-7">
          <DateHero option={confirmedOption} time={activity.start_time} />

          {/* Les autres créneaux ne servent plus qu'à l'organisateur, s'il
              change d'avis : repliés, pour ne pas brouiller la date retenue. */}
          {isOwner && dateOptions.length > 1 && (
            <details className="group mt-3">
              <summary className="text-ink-soft hover:text-ink flex min-h-[44px] cursor-pointer list-none items-center gap-1 px-1 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                Changer la date retenue
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4 transition-transform group-open:rotate-180"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <div className="flex flex-col gap-2">
                {dateOptions
                  .filter((option) => option.id !== confirmedOption.id)
                  .map((option) => (
                    <Card key={option.id} className="flex items-center justify-between gap-3 !py-3">
                      <span className="min-w-0">
                        <span className="block text-[15px] font-bold">
                          {formatWhen(option, activity.start_time)}
                        </span>
                        <span className="text-ink-soft text-[13px]">
                          {plural(votes.filter((v) => v.date_option_id === option.id).length, "vote")}
                        </span>
                      </span>
                      <ConfirmDateButton activityId={activity.id} dateOptionId={option.id} />
                    </Card>
                  ))}
              </div>
            </details>
          )}
        </section>
      ) : (
        <section className="mb-7">
          <SectionLabel>Quand ça t&apos;arrange ?</SectionLabel>
          {dateOptions.length === 0 ? (
            <Card>
              <p className="text-ink-soft text-sm">Aucun créneau proposé pour l&apos;instant.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2.5">
              {dateOptions.map((option) => {
                const voters = votes
                  .filter((v) => v.date_option_id === option.id)
                  .map((v) => personOf.get(v.profile_id))
                  .filter((person) => person !== undefined);
                const mine = votes.some(
                  (v) => v.date_option_id === option.id && v.profile_id === profile.id,
                );
                const most = Math.max(
                  ...dateOptions.map((o) => votes.filter((v) => v.date_option_id === o.id).length),
                );
                const favourite = voters.length > 0 && voters.length === most;
                const share =
                  stillInvited.length > 0 ? Math.round((100 * voters.length) / stillInvited.length) : 0;

                return (
                  <div
                    key={option.id}
                    className={`bg-paper-raised flex flex-col gap-2.5 rounded-[20px] p-4 ${
                      mine ? "border-brick border-2" : "shadow-[0_1px_0_var(--color-line)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 text-base font-bold">
                        {formatWhen(option, activity.start_time)}
                      </span>
                      <VoteButton
                        activityId={activity.id}
                        dateOptionId={option.id}
                        voted={mine}
                        // Voter suppose d'être invité : la RLS refuserait le vote sinon.
                        disabled={!isParticipant}
                      />
                    </div>
                    <span className="bg-line-soft h-2 rounded-full">
                      <span
                        className={`block h-2 rounded-full ${favourite ? "bg-brick" : "bg-amber"}`}
                        style={{ width: `${share}%` }}
                      />
                    </span>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold">
                        {voters.length > 0 ? (
                          <>
                            <AvatarStack people={voters} size={26} />
                            {plural(voters.length, "dispo")}
                            {favourite && dateOptions.length > 1 ? " · la favorite" : ""}
                          </>
                        ) : (
                          <span className="text-ink-soft font-normal">Personne pour l&apos;instant</span>
                        )}
                      </span>
                      {isOwner && (
                        <ConfirmDateButton activityId={activity.id} dateOptionId={option.id} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ---------- Ta réponse ---------- */}
      {/* Réservé aux invités : la RLS refuserait la réponse de quelqu'un
          d'autre, et le créateur non invité n'a rien à répondre. */}
      {isParticipant && (
        <Card className="mb-7">
          <SectionLabel>{attendanceDateId ? "Tu viens ?" : "Ta réponse"}</SectionLabel>
          <AttendanceAnswer
            activityId={activity.id}
            attendanceDateId={attendanceDateId}
            attending={attendeeIds.has(profile.id) && !declinedIds.has(profile.id)}
            declined={declinedIds.has(profile.id)}
          />
        </Card>
      )}

      {/* ---------- Budget ---------- */}
      {/* Aucune ligne de budget : la section entière disparaît. « Pas de
          budget renseigné » suivi d'un total à zéro n'apprend rien, et une
          sortie gratuite n'a pas à parler d'argent. */}
      {budgetItems.length > 0 && (
        <section className="bg-ink text-paper mb-7 flex flex-col gap-3 rounded-[22px] p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-[#cdbba8]">Budget par personne</h2>
            {/* Le « € » reste petit et hors Fraunces : dessiné en grand, ce seul
                glyphe a figé le rendu de Chrome au point que la page cessait de
                se peindre (constaté le 27/09, en Fraunces comme en Figtree). */}
            <span className="shrink-0 leading-none">
              <span className="font-display text-[30px] font-semibold">
                {formatEuros(totalPerPerson).replace(/\s*€$/, "")}
              </span>
              <span className="text-lg font-bold">&#8239;€</span>
            </span>
          </div>

          {budgetItems.map((item) => {
            const itemPayments = payments.filter((p) => p.budget_item_id === item.id);
            const reimbursed = itemPayments.filter((p) => p.paid).length;
            const detailed = item.payment_mode === "advance" && itemPayments.length > 0;
            const summary = detailed
              ? `Avancé par ${isOwner ? "toi" : organiserName} · ${reimbursed} sur ${itemPayments.length} ont remboursé`
              : item.payment_mode === "advance"
                ? `Avancé par ${isOwner ? "toi" : organiserName}`
                : "Paiement sur place";

            return (
              <div key={item.id} className="border-t border-white/10 pt-3">
                <div className="flex items-center justify-between gap-3 text-[15px]">
                  <span className="min-w-0 font-semibold">{item.label}</span>
                  <span className="shrink-0 font-semibold">
                    {formatEuros(Number(item.amount_per_person))}
                  </span>
                </div>

                {/* Le suivi nominatif est replié : on lit d'abord un montant
                    et un décompte, et on déroule pour savoir qui doit encore.
                    Un <details> plutôt qu'un état React — il fonctionne avant
                    même que la page soit hydratée. */}
                {detailed ? (
                  <details className="group mt-0.5">
                    <summary className="flex min-h-[32px] cursor-pointer list-none items-center gap-1 text-[13px] text-[#cdbba8] transition-colors hover:text-white [&::-webkit-details-marker]:hidden">
                      {summary}
                      <svg
                        aria-hidden
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-3.5 transition-transform group-open:rotate-180"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </summary>

                    {/* Visible par tous, modifiable par le créateur seul. */}
                    <div className="mt-1 ml-0.5 border-l border-white/15 pl-3">
                      {itemPayments.map((payment) => (
                        <PaymentToggle
                          key={payment.id}
                          activityId={activity.id}
                          paymentId={payment.id}
                          paid={payment.paid}
                          name={nameOf.get(payment.profile_id) ?? "Participant retiré"}
                          canEdit={isOwner}
                        />
                      ))}
                    </div>
                  </details>
                ) : (
                  <div className="mt-0.5 text-[13px] text-[#cdbba8]">{summary}</div>
                )}
              </div>
            );
          })}

          {/* La question « comment je te rembourse ? » se pose ici, et nulle
              part ailleurs : on y répond ici plutôt que dans WhatsApp.
              Jamais à l'organisateur : c'est lui qui a avancé, sa propre
              ligne n'est là que pour sa part du partage. */}
          {myDue > 0 && !isOwner && (
            <div className="flex flex-col gap-1 rounded-2xl bg-[#3d2a1e] px-4 py-3">
              <p className="text-[15px] font-bold">
                Tu dois encore {formatEuros(myDue)} à {organiserName}
              </p>
              <p className="text-sm whitespace-pre-line text-[#e8d7c4]">
                {activity.organiser?.payment_info ??
                  "Aucune information de remboursement renseignée — demande-lui."}
              </p>
            </div>
          )}
        </section>
      )}

      {isOwner && budgetItems.length > 0 && !activity.organiser?.payment_info && hasAdvance && (
        <p className="text-amber-deep bg-amber-pale -mt-4 mb-7 rounded-2xl px-4 py-3 text-sm">
          Dis dans ton profil comment on te rembourse : ceux qui te doivent de l&apos;argent le
          verront ici.
        </p>
      )}

      {/* ---------- Invités et participants ---------- */}
      <section className="flex flex-col gap-6">
        {attendanceDateId ? (
          <>
            <div>
              <SectionLabel>
                Qui vient · {attendees.length} sur {stillInvited.length}
              </SectionLabel>
              <ParticipantsEditor
                activityId={activity.id}
                participants={attendees}
                // Pas de bouton d'invitation ici : on n'invite pas quelqu'un
                // directement dans la liste de ceux qui ont déjà confirmé.
                candidates={[]}
                isAdmin={isOwner}
                emptyLabel="Personne n'a encore confirmé sa présence."
              />
            </div>

            <div>
              <SectionLabel>En attente de réponse · {awaiting.length}</SectionLabel>
              <ParticipantsEditor
                activityId={activity.id}
                participants={awaiting}
                candidates={candidates}
                isAdmin={isOwner}
                emptyLabel="Tout le monde a répondu."
                muted
              />
            </div>
          </>
        ) : (
          <div>
            <SectionLabel>La bande · {stillInvited.length}</SectionLabel>
            <ParticipantsEditor
              activityId={activity.id}
              participants={stillInvited}
              candidates={candidates}
              isAdmin={isOwner}
            />
          </div>
        )}

        {/* Un refus se lit dès la phase de vote : inutile d'attendre qu'une
            date soit tranchée pour savoir qui ne viendra pas. */}
        {declined.length > 0 && (
          <div>
            <SectionLabel>Ne viennent pas · {declined.length}</SectionLabel>
            <ParticipantsEditor
              activityId={activity.id}
              participants={declined}
              candidates={[]}
              isAdmin={isOwner}
              muted
            />
          </div>
        )}
      </section>

      {canRemind && (
        <RemindButton
          activityId={activity.id}
          count={remindCount}
          lastReminder={activity.reminded_at ? formatReminderTime(activity.reminded_at) : null}
          nextReminder={nextReminder ? formatReminderTime(nextReminder) : null}
        />
      )}
    </>
  );
}

const heroWeekday = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" });
const heroMonth = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });

/** La date retenue, en grand, sur fond terracotta. */
function DateHero({
  option,
  time,
}: {
  option: Pick<DateOption, "start_date" | "end_date">;
  time: string | null;
}) {
  const start = new Date(`${option.start_date}T00:00:00Z`);
  return (
    <div className="bg-brick flex items-center gap-4 rounded-[22px] p-5 text-white">
      <span className="text-brick flex w-16 shrink-0 flex-col items-center rounded-2xl bg-white py-2 leading-none">
        <span className="text-[11px] font-bold tracking-[0.08em] uppercase">
          {heroWeekday.format(start).replace(".", "")}
        </span>
        <span className="font-display my-1 text-[28px] font-semibold">{start.getUTCDate()}</span>
        <span className="text-[11px] font-bold tracking-[0.08em] uppercase">
          {heroMonth.format(start).replace(".", "")}
        </span>
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-display text-[20px] leading-tight font-semibold">
          {formatWhen(option, null)}
        </span>
        {time && <span className="text-sm text-[#ffe6da]">à {formatTime(time)}</span>}
      </span>
    </div>
  );
}
