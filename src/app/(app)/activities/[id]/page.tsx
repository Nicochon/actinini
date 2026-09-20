import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, Perforation, SectionLabel, Stamp } from "@/components/ui";
import type {
  BudgetItem,
  DateOption,
  Payment,
  Profile,
  Vote,
} from "@/lib/database.types";
import {
  displayName,
  formatDateRange,
  formatEuros,
  joinNames,
  plural,
} from "@/lib/format";
import { requireProfile } from "@/lib/session";

import {
  AttendanceAnswer,
  ConfirmDateButton,
  ParticipantsEditor,
  PaymentToggle,
  VoteButton,
} from "./controls";

type PaymentRow = Pick<
  Payment,
  "id" | "budget_item_id" | "profile_id" | "paid"
>;

export default async function ActivityDetailPage({
  params,
}: PageProps<"/activities/[id]">) {
  const { id } = await params;
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
        "id, title, description, status, confirmed_date_option_id, created_by",
      )
      .eq("id", id)
      .maybeSingle(),
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
   * Le créneau sur lequel se joue la présence : la date retenue, ou l'unique
   * créneau quand il n'y en a qu'un.
   *
   * Tant qu'il vaut null — plusieurs dates, aucune tranchée — la question
   * posée reste « quand es-tu dispo ? » et personne n'a encore dit s'il
   * venait : inutile alors de distinguer invités et participants.
   */
  const attendanceDateId =
    activity.confirmed_date_option_id ??
    (dateOptions.length === 1 ? dateOptions[0].id : null);

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

  const datesLabel = !attendanceDateId
    ? "Dates proposées"
    : dateOptions.length === 1
      ? "Date"
      : "Date retenue";

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

  return (
    <>
      <Link
        href="/"
        className="text-ink-soft mb-4 inline-flex items-center gap-1.5 text-[13px]"
      >
        ← Retour à la liste
      </Link>

      <Card>
        <h1 className="font-display mb-1.5 text-[22px] font-medium">
          {activity.title}
        </h1>
        {activity.description && (
          <p className="text-ink-soft mb-3 text-sm whitespace-pre-line">
            {activity.description}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <Stamp status={activity.status} />
          {isOwner && (
            <Link
              href={`/activities/${activity.id}/edit`}
              className="border-line text-ink-soft hover:border-ink-soft rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors"
            >
              Modifier
            </Link>
          )}
        </div>

        {/* ---------- Dates proposées ---------- */}
        <Perforation bleed />
        <SectionLabel>{datesLabel}</SectionLabel>

        {dateOptions.length === 0 ? (
          <p className="text-ink-soft text-[13px]">
            Aucun créneau proposé pour l&apos;instant.
          </p>
        ) : (
          dateOptions.map((option) => {
            const optionVotes = votes.filter(
              (v) => v.date_option_id === option.id,
            );
            const voterNames = optionVotes
              .map((v) => nameOf.get(v.profile_id))
              .filter((name): name is string => Boolean(name));
            const isConfirmed = activity.confirmed_date_option_id === option.id;
            // Les créneaux écartés restent lisibles, mais la phase de vote est
            // close : plus de bouton, juste le décompte, en retrait.
            const isAttendanceDate = option.id === attendanceDateId;
            const settled = Boolean(attendanceDateId) && !isAttendanceDate;
            const wording = isAttendanceDate
              ? {
                  empty: "Personne n'a encore répondu",
                  verb: voterNames.length > 1 ? "participent" : "participe",
                }
              : {
                  empty: "Personne n'a encore voté",
                  verb: voterNames.length > 1 ? "ont voté" : "a voté",
                };

            return (
              <div
                key={option.id}
                className={`border-line-soft border-b py-3 last:border-b-0 ${
                  settled ? "opacity-55" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {formatDateRange(option)}
                      {isConfirmed && (
                        <span className="text-sage-deep ml-2 text-[12px] font-semibold">
                          · date retenue
                        </span>
                      )}
                    </div>
                    <div className="text-ink-soft mt-0.5 text-xs">
                      {voterNames.length > 0
                        ? `${joinNames(voterNames)} ${wording.verb}`
                        : wording.empty}
                    </div>
                  </div>
                  {settled ? (
                    <span className="text-ink-soft shrink-0 text-[13px]">
                      {plural(optionVotes.length, "vote")}
                    </span>
                  ) : (
                    <VoteButton
                      activityId={activity.id}
                      dateOptionId={option.id}
                      voted={optionVotes.some(
                        (v) => v.profile_id === profile.id,
                      )}
                      count={optionVotes.length}
                      attendance={isAttendanceDate}
                      // Voter suppose d'être invité : la RLS refuserait le vote sinon.
                      disabled={!isParticipant}
                    />
                  )}
                </div>

                {isOwner && !isConfirmed && (
                  <div className="mt-2.5 flex justify-end">
                    <ConfirmDateButton
                      activityId={activity.id}
                      dateOptionId={option.id}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Répondre non ne vise aucune date en particulier : sa place est sous
            la liste, pas sur une ligne de créneau. Réservé aux invités — la
            RLS refuserait la réponse de quelqu'un d'autre. */}
        {isParticipant && (
          <AttendanceAnswer
            activityId={activity.id}
            declined={declinedIds.has(profile.id)}
          />
        )}

        {/* ---------- Budget ---------- */}
        {/* Aucune ligne de budget : la section entière disparaît. « Pas de
            budget renseigné » suivi d'un total à zéro n'apprend rien, et une
            sortie gratuite n'a pas à parler d'argent. */}
        {budgetItems.length > 0 && (
          <>
            <Perforation bleed />
            <SectionLabel>Budget par personne</SectionLabel>

            {budgetItems.map((item) => {
              const itemPayments = payments.filter(
                (p) => p.budget_item_id === item.id,
              );
              const reimbursed = itemPayments.filter((p) => p.paid).length;

              return (
                <div
                  key={item.id}
                  className="border-line-soft border-b py-3 last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-ink-soft mt-0.5 text-xs">
                        {item.payment_mode === "advance"
                          ? `Avancé${isOwner ? " par toi" : ""} · ${reimbursed} sur ${itemPayments.length} ont remboursé`
                          : "Paiement sur place"}
                      </div>
                    </div>
                    <div className="font-display shrink-0 text-base font-medium">
                      {formatEuros(Number(item.amount_per_person))}
                    </div>
                  </div>

                  {/* Suivi nominatif : visible par tous, modifiable par le créateur seul. */}
                  {item.payment_mode === "advance" &&
                    itemPayments.length > 0 && (
                      <div className="border-line-soft mt-2 ml-0.5 border-l pt-1 pl-3">
                        {itemPayments.map((payment) => (
                          <PaymentToggle
                            key={payment.id}
                            activityId={activity.id}
                            paymentId={payment.id}
                            paid={payment.paid}
                            name={
                              nameOf.get(payment.profile_id) ??
                              "Participant retiré"
                            }
                            canEdit={isOwner}
                          />
                        ))}
                      </div>
                    )}
                </div>
              );
            })}

            <div className="border-line mt-3 flex items-center justify-between border-t pt-3">
              <span className="text-ink-soft text-[13px] font-medium">
                Total par personne
              </span>
              <span className="font-display text-base font-medium">
                {formatEuros(totalPerPerson)}
              </span>
            </div>
          </>
        )}

        {/* ---------- Invités et participants ---------- */}
        <Perforation bleed />

        {attendanceDateId ? (
          <>
            <SectionLabel>
              Participants · {attendees.length} sur {stillInvited.length}
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

            {declined.length > 0 && (
              <div className="mt-6">
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

            <div className="mt-6">
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
          <>
            <SectionLabel>{plural(stillInvited.length, "invité")}</SectionLabel>
            <ParticipantsEditor
              activityId={activity.id}
              participants={stillInvited}
              candidates={candidates}
              isAdmin={isOwner}
            />

            {/* Un refus se lit dès la phase de vote : inutile d'attendre
                qu'une date soit tranchée pour savoir qui ne viendra pas. */}
            {declined.length > 0 && (
              <div className="mt-6">
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
          </>
        )}
      </Card>
    </>
  );
}
