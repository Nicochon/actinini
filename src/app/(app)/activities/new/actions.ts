"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { parseBudget, parseDates } from "@/lib/activity-input";
import type { PaymentMode } from "@/lib/database.types";
import { displayName } from "@/lib/format";
import { notifyActivityParticipants } from "@/lib/push";
import { requireProfile } from "@/lib/session";

export type NewActivityInput = {
  title: string;
  description: string;
  location: string;
  /** `end` vide = journée unique. */
  dates: { start: string; end: string }[];
  budget: { label: string; amount: string; mode: PaymentMode }[];
  participantIds: string[];
};

export type CreateResult = { error?: string; activityId?: string };

export async function createActivity(input: NewActivityInput): Promise<CreateResult> {
  const { supabase, profile } = await requireProfile();

  const title = String(input.title ?? "").trim();
  if (!title) return { error: "Donne un titre à l'activité." };

  const parsedDates = parseDates(input.dates);
  if (!parsedDates.ok) return { error: parsedDates.error };
  const dates = parsedDates.value;

  const parsedBudget = parseBudget(input.budget);
  if (!parsedBudget.ok) return { error: parsedBudget.error };
  const budget = parsedBudget.value;

  const participantIds = Array.isArray(input.participantIds)
    ? input.participantIds.filter((x): x is string => typeof x === "string" && x !== "")
    : [];

  // Créer l'activité. La RLS refuse ici si l'utilisateur n'est pas l'admin du groupe.
  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .insert({
      title,
      description: String(input.description ?? "").trim() || null,
      location: String(input.location ?? "").trim() || null,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (activityError || !activity) {
    return { error: "L'activité n'a pas pu être créée (droits insuffisants ?)." };
  }

  /** Une étape suivante qui échoue laisserait une activité à moitié créée : on annule. */
  const rollback = async (message: string): Promise<CreateResult> => {
    await supabase.from("activities").delete().eq("id", activity.id);
    return { error: message };
  };

  // Les participants d'abord : le trigger des paiements se déclenche sur les
  // budget_items et ne voit que les participants déjà invités.
  if (participantIds.length > 0) {
    const { error } = await supabase
      .from("activity_participants")
      .insert(participantIds.map((id) => ({ activity_id: activity.id, profile_id: id })));
    if (error) return rollback("Les participants n'ont pas pu être invités.");
  }

  if (dates.length > 0) {
    const { error } = await supabase.from("date_options").insert(
      dates.map((d) => ({
        activity_id: activity.id,
        start_date: d.start,
        end_date: d.end,
      })),
    );
    if (error) return rollback("Les dates proposées n'ont pas pu être enregistrées.");
  }

  if (budget.length > 0) {
    const { error } = await supabase.from("budget_items").insert(
      budget.map((b) => ({
        activity_id: activity.id,
        label: b.label,
        amount_per_person: b.amount,
        payment_mode: b.mode,
      })),
    );
    if (error) return rollback("Le budget n'a pas pu être enregistré.");
  }

  // Prévenir les invités, mais pas au prix d'un écran d'attente : `after`
  // laisse la réponse partir et n'envoie les notifications qu'ensuite. Un
  // téléphone d'invité injoignable ne doit pas faire patienter l'organisateur
  // devant son formulaire.
  after(async () => {
    await notifyActivityParticipants(supabase, activity.id, {
      title: "Nouvelle activité",
      body: `${displayName(profile)} propose : ${title}`,
      url: `/activities/${activity.id}`,
    });
  });

  revalidatePath("/");
  return { activityId: activity.id };
}
