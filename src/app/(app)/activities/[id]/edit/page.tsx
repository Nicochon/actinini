import { notFound, redirect } from "next/navigation";

import { requireProfile } from "@/lib/session";

import { DeleteActivity } from "./delete-activity";
import { EditForm, type EditableActivity } from "./edit-form";

export const metadata = { title: "Modifier l'activité" };

type PaymentRow = { budget_item_id: string; paid: boolean };

export default async function EditActivityPage({
  params,
}: PageProps<"/activities/[id]/edit">) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();

  const [
    activityRes,
    dateOptionsRes,
    budgetRes,
    paymentsRes,
    participantsRes,
    votesRes,
  ] = await Promise.all([
    supabase
      .from("activities")
      .select(
        "id, title, description, status, confirmed_date_option_id, created_by",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("date_options")
      .select("id, start_date, end_date")
      .eq("activity_id", id)
      .order("start_date"),
    supabase
      .from("budget_items")
      .select("id, label, amount_per_person, payment_mode")
      .eq("activity_id", id)
      .order("created_at"),
    supabase
      .from("payments")
      .select("budget_item_id, paid, budget_items!inner(activity_id)")
      .eq("budget_items.activity_id", id)
      .eq("paid", true)
      .overrideTypes<PaymentRow[]>(),
    supabase
      .from("activity_participants")
      .select("profile_id", { count: "exact", head: true })
      .eq("activity_id", id),
    supabase
      .from("votes")
      .select("profile_id", { count: "exact", head: true })
      .eq("activity_id", id),
  ]);

  const activity = activityRes.data;
  if (!activity) notFound();

  // La RLS refuserait les écritures ; autant ne pas afficher un formulaire mort.
  if (activity.created_by !== profile.id) redirect(`/activities/${id}`);

  const paidByItem = new Map<string, number>();
  for (const payment of paymentsRes.data ?? []) {
    paidByItem.set(
      payment.budget_item_id,
      (paidByItem.get(payment.budget_item_id) ?? 0) + 1,
    );
  }

  const editable: EditableActivity = {
    id: activity.id,
    title: activity.title,
    description: activity.description,
    status: activity.status,
    confirmed_date_option_id: activity.confirmed_date_option_id,
    dates: dateOptionsRes.data ?? [],
    budget: (budgetRes.data ?? []).map((item) => ({
      id: item.id,
      label: item.label,
      amount_per_person: Number(item.amount_per_person),
      payment_mode: item.payment_mode,
      paidCount: paidByItem.get(item.id) ?? 0,
    })),
  };

  return (
    <>
      <EditForm activity={editable} />
      <DeleteActivity
        activityId={activity.id}
        title={activity.title}
        counts={{
          participants: participantsRes.count ?? 0,
          dates: editable.dates.length,
          votes: votesRes.count ?? 0,
          budget: editable.budget.length,
          paid: paymentsRes.data?.length ?? 0,
        }}
      />
    </>
  );
}
