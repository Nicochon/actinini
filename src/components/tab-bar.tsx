"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Accueil", icon: "home" },
  // « Créer » et non « Nouvelle activité » : à quatre onglets, le libellé long
  // passait sur deux lignes sur un écran de 375 px et désalignait la barre.
  { href: "/activities/new", label: "Créer", icon: "plus", adminOnly: true },
  { href: "/accounts", label: "Comptes", icon: "users", adminOnly: true },
  { href: "/profile", label: "Profil", icon: "user" },
] as const;

type IconName = (typeof TABS)[number]["icon"];

/**
 * Icônes dessinées à la main plutôt qu'importées : quatre traits,
 * c'est moins de code qu'une dépendance, et le trait reste accordé au reste
 * (extrémités arrondies, aucune surface pleine).
 */
function TabIcon({ name }: { name: IconName }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[21px]"
    >
      {name === "home" && <path d="M3.5 10.5 12 3.5l8.5 7V20.5h-17z" />}
      {name === "plus" && <path d="M12 5.5v13M5.5 12h13" />}
      {name === "users" && (
        <>
          <circle cx="9.5" cy="8.5" r="3.2" />
          <path d="M3.5 19v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" />
          <path d="M16.2 5.7a3.2 3.2 0 0 1 0 5.6" />
          <path d="M17.5 14.2a4 4 0 0 1 3 3.8v1" />
        </>
      )}
      {name === "user" && (
        <>
          <circle cx="12" cy="8.2" r="3.4" />
          <path d="M5.5 19.5v-1a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5v1" />
        </>
      )}
    </svg>
  );
}

export function TabBar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  // Créer une activité et gérer les comptes n'ont de sens que pour l'admin :
  // la RLS refuserait l'un comme l'autre à quelqu'un d'autre.
  const tabs = TABS.filter((tab) => isAdmin || !("adminOnly" in tab));

  return (
    // Barre flottante, détachée du bord : elle se pose au-dessus de l'indicateur
    // d'accueil de l'iPhone plutôt que de s'étendre dessous.
    <nav className="bg-ink fixed inset-x-4 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 mx-auto flex max-w-[600px] rounded-full px-2 py-1.5 shadow-[0_10px_30px_-12px_rgba(43,29,20,0.6)]">
      {tabs.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-center text-[11px] leading-[1.25] font-semibold transition-colors ${
              active ? "text-[#ffb89e]" : "text-[#cdbba8] hover:text-white"
            }`}
          >
            <TabIcon name={tab.icon} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
