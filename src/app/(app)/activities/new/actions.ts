"use server";

import { revalidatePath } from "next/cache";

import type { PaymentMode } from "@/lib/database.types";
import { requireProfile } from "@/lib/session";

export type NewActivityInput = {
  title: string;
  description: string;
  /** `end` vide = journée unique. */
  dates: { start: string; end: string }[];
  budget: { label: string; amount: string; mode: PaymentMode }[];
  participantIds: string[];
};

export type CreateResult = { error?: string; activityId?: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function createActivity(input: NewActivityInput): Promise<CreateResult> {
  const { supabase, profile } = await requireProfile();

  const title = input.title.trim();
  if (!title) return { error: "Donne un titre à l'activité." };

  const dates = input.dates
    .map((d) => ({ start: d.start.trim(), end: d.end.trim() }))
    .filter((d) => d.start);
  if (dates.some((d) => !ISO_DAY.test(d.start) || (d.end && !ISO_DAY.test(d.end)))) {
    return { error: "Une des dates proposées est invalide." };
  }
  if (dates.some((d) => d.end && d.end < d.start)) {
    return { error: "Une date de fin précède sa date de début." };
  }

  const budget = input.budget
    .map((b) => ({ label: b.label.trim(), amount: Number(b.amount), mode: b.mode }))
    .filter((b) => b.label || b.amount);
  if (budget.some((b) => !b.label)) {
    return { error: "Chaque ligne de budget a besoin d'un libellé." };
  }
  if (budget.some((b) => !Number.isFinite(b.amount) || b.amount < 0)) {
    return { error: "Chaque ligne de budget a besoin d'un montant positif." };
  }

  // Créer l'activité. La RLS refuse ici si l'utilisateur n'est pas l'admin du groupe.
  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .insert({ title, description: input.description.trim() || null, created_by: profile.id })
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
  if (input.participantIds.length > 0) {
    const { error } = await supabase
      .from("activity_participants")
      .insert(input.participantIds.map((id) => ({ activity_id: activity.id, profile_id: id })));
    if (error) return rollback("Les participants n'ont pas pu être invités.");
  }

  if (dates.length > 0) {
    const { error } = await supabase.from("date_options").insert(
      dates.map((d) => ({
        activity_id: activity.id,
        start_date: d.start,
        end_date: d.end || null,
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

  revalidatePath("/");
  return { activityId: activity.id };
}
