import { Avatar } from "@/components/avatar";
import { SectionLabel } from "@/components/ui";
import { displayName } from "@/lib/format";
import { requireProfile } from "@/lib/session";

import { signOut } from "./actions";
import { CredentialsForm, IdentityForm } from "./profile-forms";
import { PushNotifications } from "./push-notifications";

export const metadata = { title: "Profil" };

export default async function ProfilePage() {
  const { user, profile } = await requireProfile();

  return (
    <>
      <header className="mb-7 flex items-center gap-4">
        <Avatar person={profile} size={72} />
        <div className="min-w-0">
          <h1 className="font-display text-[28px] leading-tight font-semibold">
            {profile.full_name || displayName(profile)}
          </h1>
          <p className="text-ink-soft text-[15px]">
            @{displayName(profile)}
            {profile.is_admin ? " · admin du groupe" : ""}
          </p>
        </div>
      </header>

      <SectionLabel>Toi</SectionLabel>
      <IdentityForm profile={profile} />

      <div className="mt-7">
        <SectionLabel>Notifications</SectionLabel>
        <PushNotifications />
      </div>

      <div className="mt-7">
        <SectionLabel>Connexion</SectionLabel>
        <CredentialsForm email={user.email ?? ""} />
      </div>

      <form action={signOut} className="mt-7 text-center">
        <button
          type="submit"
          className="text-brick-deep min-h-[44px] px-4 text-[15px] font-semibold underline"
        >
          Se déconnecter
        </button>
      </form>
    </>
  );
}
