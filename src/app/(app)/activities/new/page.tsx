import { redirect } from "next/navigation";

import type { Profile } from "@/lib/database.types";
import { requireProfile } from "@/lib/session";

import { ActivityForm } from "./activity-form";

export const metadata = { title: "Nouvelle activité" };

export default async function NewActivityPage() {
  const { supabase, profile } = await requireProfile();

  // La RLS refuserait l'insertion de toute façon ; autant ne pas afficher le formulaire.
  if (!profile.is_admin) redirect("/");

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, pseudo")
    .order("full_name")
    .overrideTypes<Pick<Profile, "id" | "full_name" | "pseudo">[]>();

  return <ActivityForm people={data ?? []} />;
}
