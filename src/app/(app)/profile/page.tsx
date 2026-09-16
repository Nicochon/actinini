import { SectionLabel } from "@/components/ui";
import { requireProfile } from "@/lib/session";

import { signOut } from "./actions";
import { CredentialsForm, IdentityForm } from "./profile-forms";
import { PushNotifications } from "./push-notifications";

export const metadata = { title: "Profil" };

export default async function ProfilePage() {
  const { user, profile } = await requireProfile();

  return (
    <>
      <SectionLabel>Ton profil</SectionLabel>
      <IdentityForm profile={profile} />

      <div className="perforation" />
      <SectionLabel>Notifications</SectionLabel>
      <PushNotifications />

      <div className="perforation" />
      <SectionLabel>Identifiants de connexion</SectionLabel>
      <CredentialsForm email={user.email ?? ""} />

      <form action={signOut} className="mt-6">
        <button type="submit" className="text-brick-deep text-[13px] font-medium underline">
          Se déconnecter
        </button>
      </form>
    </>
  );
}
