"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Liste" },
  { href: "/activities/new", label: "Nouvelle activité" },
  { href: "/profile", label: "Profil" },
] as const;

export function TabBar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  // Sans droits admin, l'onglet de création n'a pas lieu d'être.
  const tabs = TABS.filter((tab) => isAdmin || tab.href !== "/activities/new");

  return (
    <nav className="border-line bg-paper-raised fixed inset-x-0 bottom-0 z-10 flex gap-0.5 border-t px-[max(1rem,calc(50%-19rem))] pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {tabs.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-1 rounded-lg px-1 pt-2 pb-1.5 text-[11px] font-medium transition-colors ${
              active ? "text-ink" : "text-ink-soft"
            }`}
          >
            <span
              aria-hidden
              className={`size-[5px] rounded-full ${active ? "bg-ink" : "bg-transparent"}`}
            />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
