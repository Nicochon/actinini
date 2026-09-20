"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Liste", icon: "list" },
  // « Créer » et non « Nouvelle activité » : à quatre onglets, le libellé long
  // passait sur deux lignes sur un écran de 375 px et désalignait la barre.
  { href: "/activities/new", label: "Créer", icon: "plus", adminOnly: true },
  { href: "/accounts", label: "Comptes", icon: "users", adminOnly: true },
  { href: "/profile", label: "Profil", icon: "user" },
] as const;

type IconName = (typeof TABS)[number]["icon"];

/**
 * Icônes dessinées à la main plutôt qu'importées : quatre traits au trait fin,
 * c'est moins de code qu'une dépendance, et le trait reste accordé au reste
 * (épaisseur 1.6, extrémités arrondies, aucune surface pleine).
 */
function TabIcon({ name }: { name: IconName }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[21px]"
    >
      {name === "list" && (
        <>
          <path d="M9 7h11M9 12h11M9 17h7" />
          <path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" />
        </>
      )}
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
    <nav className="border-line bg-paper-raised fixed inset-x-0 bottom-0 z-10 flex gap-0.5 border-t px-[max(1rem,calc(50%-19rem))] pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {tabs.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 pt-1 pb-1 text-center text-[11px] leading-[1.25] font-medium transition-colors ${
              active ? "text-ink" : "text-ink-soft"
            }`}
          >
            {/* La pastille remplace le point indicateur d'origine : avec une
                icône au-dessus du libellé, un troisième élément empilé aurait
                épaissi la barre sans rien dire de plus. */}
            <span
              className={`rounded-[20px] px-3.5 py-0.5 transition-colors ${
                active ? "bg-line-soft" : "bg-transparent"
              }`}
            >
              <TabIcon name={tab.icon} />
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
