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
import { formatDateRange, formatEuros, joinNames, plural } from "@/lib/format";
import { requireProfile } from "@/lib/session";

import {
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
      .select("profile:profiles(id, full_name, pseudo)")
      .eq("activity_id", id)
      .overrideTypes<
        { profile: Pick<Profile, "id" | "full_name" | "pseudo"> }[]
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
  const participants = (participantsRes.data ?? []).map((row) => row.profile);
  const dateOptions: Pick<DateOption, "id" | "start_date" | "end_date">[] =
    dateOptionsRes.data ?? [];
  const votes: Pick<Vote, "date_option_id" | "profile_id">[] =
    votesRes.data ?? [];
  const budgetItems: Pick<
    BudgetItem,
    "id" | "label" | "amount_per_person" | "payment_mode"
  >[] = budgetRes.data ?? [];
  const payments = paymentsRes.data ?? [];

  const nameOf = new Map(participants.map((p) => [p.id, p.full_name]));
  const isParticipant = nameOf.has(profile.id);

  // Comptes disponibles pour une invitation (admin seulement).
  const candidates = isOwner
    ? (
        (
          await supabase
            .from("profiles")
            .select("id, full_name, pseudo")
            .order("full_name")
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
        <SectionLabel>Dates proposées</SectionLabel>

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

            return (
              <div
                key={option.id}
                className="border-line-soft border-b py-3 last:border-b-0"
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
                        ? `${joinNames(voterNames)} ${voterNames.length > 1 ? "ont" : "a"} voté`
                        : "Personne n'a encore voté"}
                    </div>
                  </div>
                  <VoteButton
                    activityId={activity.id}
                    dateOptionId={option.id}
                    voted={optionVotes.some((v) => v.profile_id === profile.id)}
                    count={optionVotes.length}
                    // Voter suppose d'être invité : la RLS refuserait le vote sinon.
                    disabled={!isParticipant}
                  />
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

        {/* ---------- Budget ---------- */}
        <Perforation bleed />
        <SectionLabel>Budget par personne</SectionLabel>

        {budgetItems.length === 0 ? (
          <p className="text-ink-soft text-[13px]">Pas de budget renseigné.</p>
        ) : (
          <>
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

        {/* ---------- Participants ---------- */}
        <Perforation bleed />
        <SectionLabel>
          {plural(participants.length, "participant")}
        </SectionLabel>

        <ParticipantsEditor
          activityId={activity.id}
          participants={participants}
          candidates={candidates}
          isAdmin={isOwner}
        />
      </Card>
    </>
  );
}
