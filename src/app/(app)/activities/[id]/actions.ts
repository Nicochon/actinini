"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import type { Database } from "@/lib/database.types";
import { displayName, formatWhen } from "@/lib/format";
import { notifyActivityParticipants, notifyParticipant } from "@/lib/push";
import { awaitingIds, formatReminderTime, nextReminderAt } from "@/lib/reminders";
import { requireProfile } from "@/lib/session";

export type ActionResult = { error?: string };

/**
 * Toutes ces actions s'appuient sur la RLS pour l'autorisation : une tentative
 * non autorisée ne renvoie aucune ligne (ou une erreur Postgres), jamais une
 * écriture silencieuse. On se contente donc d'exiger une session valide.
 */

/** Vote togglable : un clic ajoute le vote, un second le retire. */
export async function toggleVote(activityId: string, dateOptionId: string): Promise<ActionResult> {
  const { supabase, profile } = await requireProfile();

  const { data: existing } = await supabase
    .from("votes")
    .select("date_option_id")
    .eq("date_option_id", dateOptionId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("votes")
        .delete()
        .eq("date_option_id", dateOptionId)
        .eq("profile_id", profile.id)
    : await supabase
        .from("votes")
        .insert({ activity_id: activityId, date_option_id: dateOptionId, profile_id: profile.id });

  if (error) return { error: "Ton vote n'a pas pu être enregistré." };

  // Voter, c'est se manifester : un refus antérieur n'a plus lieu d'être. Le
  // filtre sur `declined` évite de réécrire la ligne à chaque vote.
  if (!existing) {
    await supabase
      .from("activity_participants")
      .update({ declined: false })
      .eq("activity_id", activityId)
      .eq("profile_id", profile.id)
      .eq("declined", true);
  }

  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/");
  return {};
}

/**
 * Répondre « je ne viens pas », ou revenir sur ce refus.
 *
 * Le « oui » se lit dans `votes` ; le « non », lui, n'a pas d'autre trace
 * possible — sans cette colonne, il serait indistinguable d'une absence de
 * réponse. Décliner efface les votes de la personne sur l'activité : ses
 * disponibilités ne veulent plus rien dire, et la laisser apparaître sous un
 * créneau tromperait tout le monde.
 */
export async function setAttendance(
  activityId: string,
  coming: boolean,
): Promise<ActionResult> {
  const { supabase, profile } = await requireProfile();

  if (!coming) {
    await supabase
      .from("votes")
      .delete()
      .eq("activity_id", activityId)
      .eq("profile_id", profile.id);
  }

  const { error } = await supabase
    .from("activity_participants")
    .update({ declined: !coming })
    .eq("activity_id", activityId)
    .eq("profile_id", profile.id);

  if (error) return { error: "Ta réponse n'a pas pu être enregistrée." };

  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/");
  return {};
}

/**
 * L'admin retient un créneau. La date gagnante n'est jamais déduite des votes :
 * c'est toujours ce choix manuel qui fait foi.
 */
export async function confirmDate(activityId: string, dateOptionId: string): Promise<ActionResult> {
  const { supabase } = await requireProfile();

  const { data: before } = await supabase
    .from("activities")
    .select("title, start_time, confirmed_date_option_id")
    .eq("id", activityId)
    .maybeSingle();

  const { error } = await supabase
    .from("activities")
    .update({ confirmed_date_option_id: dateOptionId, status: "confirmed" })
    .eq("id", activityId);

  if (error) return { error: "La date n'a pas pu être confirmée." };

  // Reconfirmer le même créneau ne prévient personne une seconde fois.
  if (before && before.confirmed_date_option_id !== dateOptionId) {
    after(async () => {
      const date = await dateLabel(supabase, dateOptionId, before.start_time);
      if (!date) return;
      await notifyActivityParticipants(supabase, activityId, {
        title: "Date fixée",
        body: `${before.title} — ${date}`,
        url: `/activities/${activityId}`,
      });
    });
  }

  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/");
  return {};
}

/** L'admin constate (ou annule) un remboursement. `paid_at` suit via trigger. */
export async function setPaymentPaid(
  activityId: string,
  paymentId: string,
  paid: boolean,
): Promise<ActionResult> {
  const { supabase } = await requireProfile();

  const { error } = await supabase.from("payments").update({ paid }).eq("id", paymentId);

  if (error) return { error: "Le paiement n'a pas pu être mis à jour." };

  revalidatePath(`/activities/${activityId}`);
  return {};
}

/** Inviter quelqu'un. Le trigger lui crée ses lignes de remboursement manquantes. */
export async function addParticipant(activityId: string, profileId: string): Promise<ActionResult> {
  const { supabase, profile } = await requireProfile();

  const { error } = await supabase
    .from("activity_participants")
    .insert({ activity_id: activityId, profile_id: profileId });

  if (error) return { error: "Ce participant n'a pas pu être ajouté." };

  // Les autres invités ont été prévenus à la création : seul l'arrivant l'est
  // ici. La date figure dans le message si elle est déjà fixée.
  after(async () => {
    const { data: activity } = await supabase
      .from("activities")
      .select("title, start_time, confirmed_date_option_id")
      .eq("id", activityId)
      .maybeSingle();
    if (!activity) return;

    const date = activity.confirmed_date_option_id
      ? await dateLabel(supabase, activity.confirmed_date_option_id, activity.start_time)
      : null;

    await notifyParticipant(supabase, activityId, profileId, {
      title: "Nouvelle activité",
      body: `${displayName(profile)} t'invite : ${activity.title}${date ? ` — ${date}` : ""}`,
      url: `/activities/${activityId}`,
    });
  });

  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/");
  return {};
}

/**
 * L'organisateur relance ceux dont il attend encore une réponse, et eux seuls.
 *
 * La liste est recalculée ici plutôt que reçue du navigateur : c'est le serveur
 * qui décide qui reçoit une notification. Même chose pour le délai entre deux
 * relances, que la page se contente d'afficher.
 */
export async function remindAwaiting(activityId: string): Promise<ActionResult> {
  const { supabase, profile } = await requireProfile();

  const { data: activity } = await supabase
    .from("activities")
    .select("title, start_time, status, confirmed_date_option_id, created_by, reminded_at")
    .eq("id", activityId)
    .maybeSingle();

  if (!activity || activity.created_by !== profile.id) {
    return { error: "Seul l'organisateur peut relancer les invités." };
  }
  if (activity.status !== "voting" && activity.status !== "confirmed") {
    return { error: "Cette activité est passée ou annulée." };
  }
  const next = nextReminderAt(activity.reminded_at);
  if (next) {
    return { error: `Déjà relancé récemment. Prochaine relance possible à partir de ${formatReminderTime(next)}.` };
  }

  const [{ data: participants }, { data: votes }] = await Promise.all([
    supabase.from("activity_participants").select("profile_id, declined").eq("activity_id", activityId),
    supabase.from("votes").select("date_option_id, profile_id").eq("activity_id", activityId),
  ]);
  const targets = awaitingIds(participants ?? [], votes ?? [], activity.confirmed_date_option_id);
  if (targets.length === 0) return { error: "Tout le monde a déjà répondu." };

  // Noté avant l'envoi : un second clic pendant qu'il part est refusé.
  const { error } = await supabase
    .from("activities")
    .update({ reminded_at: new Date().toISOString() })
    .eq("id", activityId);
  if (error) return { error: "La relance n'a pas pu être enregistrée." };

  after(async () => {
    const date = activity.confirmed_date_option_id
      ? await dateLabel(supabase, activity.confirmed_date_option_id, activity.start_time)
      : null;
    const body = date
      ? `${activity.title} — ${date}. Tu viens ?`
      : `${activity.title} — quelles dates te vont ?`;

    await Promise.all(
      targets.map((id) =>
        notifyParticipant(supabase, activityId, id, {
          title: `${displayName(profile)} attend ta réponse`,
          body,
          url: `/activities/${activityId}`,
        }),
      ),
    );
  });

  revalidatePath(`/activities/${activityId}`);
  return {};
}

/** Retirer quelqu'un. Le trigger efface ses paiements et ses votes sur l'activité. */
export async function removeParticipant(
  activityId: string,
  profileId: string,
): Promise<ActionResult> {
  const { supabase } = await requireProfile();

  const { error } = await supabase
    .from("activity_participants")
    .delete()
    .eq("activity_id", activityId)
    .eq("profile_id", profileId);

  if (error) return { error: "Ce participant n'a pas pu être retiré." };

  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/");
  return {};
}

/** « mar. 29 septembre à 20h » pour un créneau, ou null s'il a disparu entre-temps. */
async function dateLabel(
  supabase: SupabaseClient<Database>,
  dateOptionId: string,
  time: string | null,
): Promise<string | null> {
  const { data } = await supabase
    .from("date_options")
    .select("start_date, end_date")
    .eq("id", dateOptionId)
    .maybeSingle();
  return data ? formatWhen(data, time) : null;
}
