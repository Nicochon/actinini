import { TabBar } from "@/components/tab-bar";
import { requireProfile } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { profile } = await requireProfile();

  return (
    <>
      <main className="mx-auto w-full max-w-[640px] px-5 pt-8 pb-24">{children}</main>
      <TabBar isAdmin={profile.is_admin} />
    </>
  );
}
