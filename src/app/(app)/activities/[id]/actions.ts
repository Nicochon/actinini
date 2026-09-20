"use server";

import { revalidatePath } from "next/cache";

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

  const { error } = await supabase
    .from("activities")
    .update({ confirmed_date_option_id: dateOptionId, status: "confirmed" })
    .eq("id", activityId);

  if (error) return { error: "La date n'a pas pu être confirmée." };

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
  const { supabase } = await requireProfile();

  const { error } = await supabase
    .from("activity_participants")
    .insert({ activity_id: activityId, profile_id: profileId });

  if (error) return { error: "Ce participant n'a pas pu être ajouté." };

  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/");
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
