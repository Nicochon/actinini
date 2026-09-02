"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseBudget, parseDates, parseIds } from "@/lib/activity-input";
import type { ActivityStatus, PaymentMode } from "@/lib/database.types";
import { requireProfile } from "@/lib/session";

export type EditActivityInput = {
  activityId: string;
  title: string;
  description: string;
  status: ActivityStatus;
  /** `id` absent = nouveau créneau. */
  dates: { id?: string; start: string; end: string }[];
  budget: { id?: string; label: string; amount: string; mode: PaymentMode }[];
  deletedDateIds: string[];
  deletedBudgetIds: string[];
};

export type EditResult = { error?: string; notice?: string };

const STATUSES: ActivityStatus[] = ["voting", "confirmed", "completed", "cancelled"];

export async function updateActivity(input: EditActivityInput): Promise<EditResult> {
  const { supabase } = await requireProfile();

  const title = String(input.title ?? "").trim();
  if (!title) return { error: "Le titre ne peut pas être vide." };
  if (!STATUSES.includes(input.status)) return { error: "Statut inconnu." };

  const parsedDates = parseDates(input.dates);
  if (!parsedDates.ok) return { error: parsedDates.error };
  const dates = parsedDates.value;

  const parsedBudget = parseBudget(input.budget);
  if (!parsedBudget.ok) return { error: parsedBudget.error };
  const budget = parsedBudget.value;

  const deletedDateIds = parseIds(input.deletedDateIds);
  const deletedBudgetIds = parseIds(input.deletedBudgetIds);

  // L'état courant sert à savoir si le créneau retenu disparaît, et à n'écrire
  // que ce qui a réellement changé.
  const { data: activity } = await supabase
    .from("activities")
    .select("confirmed_date_option_id")
    .eq("id", input.activityId)
    .maybeSingle();
  if (!activity) return { error: "Activité introuvable." };

  const confirmedId = activity.confirmed_date_option_id;
  const losesConfirmedDate = Boolean(confirmedId && deletedDateIds.includes(confirmedId));

  // Supprimer le créneau retenu passe `confirmed_date_option_id` à null (clé
  // étrangère `on delete set null`) : garder le statut « confirmé » laisserait
  // une activité confirmée sans date. On la remet au vote.
  const status = losesConfirmedDate && input.status === "confirmed" ? "voting" : input.status;
  if (status === "confirmed" && !confirmedId) {
    return {
      error:
        "Aucun créneau n'est retenu : confirme d'abord une date depuis la page de l'activité.",
    };
  }

  // --- Suppressions d'abord : les triggers effacent votes et paiements liés. ---
  if (deletedDateIds.length > 0) {
    const { error } = await supabase
      .from("date_options")
      .delete()
      .in("id", deletedDateIds)
      .eq("activity_id", input.activityId);
    if (error) return { error: "Un créneau n'a pas pu être supprimé." };
  }

  if (deletedBudgetIds.length > 0) {
    const { error } = await supabase
      .from("budget_items")
      .delete()
      .in("id", deletedBudgetIds)
      .eq("activity_id", input.activityId);
    if (error) return { error: "Une ligne de budget n'a pas pu être supprimée." };
  }

  // --- En-tête ---
  const { error: headerError } = await supabase
    .from("activities")
    .update({ title, description: String(input.description ?? "").trim() || null, status })
    .eq("id", input.activityId);
  if (headerError) {
    return { error: "L'activité n'a pas pu être modifiée (droits insuffisants ?)." };
  }

  // --- Créneaux existants ---
  for (const date of dates.filter((d) => d.id)) {
    const { error } = await supabase
      .from("date_options")
      .update({ start_date: date.start, end_date: date.end })
      .eq("id", date.id!)
      .eq("activity_id", input.activityId);
    if (error) return { error: "Un créneau n'a pas pu être modifié." };
  }

  const newDates = dates.filter((d) => !d.id);
  if (newDates.length > 0) {
    const { error } = await supabase.from("date_options").insert(
      newDates.map((d) => ({
        activity_id: input.activityId,
        start_date: d.start,
        end_date: d.end,
      })),
    );
    if (error) return { error: "Les nouveaux créneaux n'ont pas pu être ajoutés." };
  }

  // --- Lignes de budget existantes ---
  // Un changement de `payment_mode` déclenche la création ou la suppression des
  // lignes `payments` correspondantes, côté base.
  for (const line of budget.filter((b) => b.id)) {
    const { error } = await supabase
      .from("budget_items")
      .update({ label: line.label, amount_per_person: line.amount, payment_mode: line.mode })
      .eq("id", line.id!)
      .eq("activity_id", input.activityId);
    if (error) return { error: "Une ligne de budget n'a pas pu être modifiée." };
  }

  const newBudget = budget.filter((b) => !b.id);
  if (newBudget.length > 0) {
    const { error } = await supabase.from("budget_items").insert(
      newBudget.map((b) => ({
        activity_id: input.activityId,
        label: b.label,
        amount_per_person: b.amount,
        payment_mode: b.mode,
      })),
    );
    if (error) return { error: "Les nouvelles lignes de budget n'ont pas pu être ajoutées." };
  }

  revalidatePath(`/activities/${input.activityId}`);
  revalidatePath(`/activities/${input.activityId}/edit`);
  revalidatePath("/");

  return losesConfirmedDate
    ? { notice: "Le créneau retenu a été supprimé : l'activité est repassée en vote." }
    : {};
}

/**
 * Suppression définitive. Les cascades emportent participants, créneaux, votes,
 * lignes de budget et paiements.
 *
 * `count` est indispensable : une suppression refusée par la RLS ne remonte
 * aucune erreur, elle ne touche simplement aucune ligne. Sans ce contrôle, on
 * redirigerait vers l'accueil en laissant croire que c'est fait.
 */
export async function deleteActivity(activityId: string): Promise<EditResult> {
  const { supabase } = await requireProfile();

  const { error, count } = await supabase
    .from("activities")
    .delete({ count: "exact" })
    .eq("id", activityId);

  if (error) return { error: "L'activité n'a pas pu être supprimée." };
  if (!count) {
    return { error: "Suppression refusée : seul le créateur peut supprimer cette activité." };
  }

  revalidatePath("/");
  redirect("/");
}
