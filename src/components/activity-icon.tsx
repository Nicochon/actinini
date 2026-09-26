import type { ReactNode } from "react";

import { iconOf, type ActivityIconKey } from "@/lib/activity-icons";

/**
 * Les dessins, au trait, sur une grille de 24. Faits main comme ceux de la
 * barre d'onglets : une vingtaine de tracés ne justifient pas une dépendance.
 */
const DRAWINGS: Record<ActivityIconKey, ReactNode> = {
  voyage: (
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  ),
  rando: <path d="m8 3 4 8 5-5 5 15H2L8 3z" />,
  soiree: <path d="M8 22h8M12 11v11M3 3h18l-9 8z" />,
  jeux: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" />
    </>
  ),
  resto: <path d="M4 3v7a2 2 0 0 0 4 0V3M6 12v9M18 3c-2.2 1.2-3.5 3.6-3.5 7v3H18M18 3v18" />,
  concert: (
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
  cine: (
    <>
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M2 10h20M7 6l2 4M12 6l2 4M17 6l2 4" />
    </>
  ),
  sport: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6c3.5 3.5 3.5 9.3 0 12.8M18.4 5.6c-3.5 3.5-3.5 9.3 0 12.8" />
    </>
  ),
  plage: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  anniv: (
    <>
      <path d="M4 21h16M5 21v-8h14v8M5 16.5c2.3 1.4 4.7 1.4 7 0s4.7-1.4 7 0M12 13V9" />
      <path d="M12 3.5c1 1.2 1 2.3 0 3-1-.7-1-1.8 0-3z" />
    </>
  ),
  cafe: <path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 2.5v2.5M12 2.5v2.5" />,
  velo: (
    <>
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M5.5 17.5 9 10h6l3.5 7.5M9 10l3.5 7.5M13 6h3l-1 4" />
    </>
  ),
  ski: <path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 2 3-2M9 20l3-2 3 2" />,
  camping: <path d="M2 20h20M12 4 3.5 20M12 4l8.5 16M12 13l-3 7M12 13l3 7" />,
  bateau: <path d="M3 17h18l-2.5 4h-13zM12 3v11M12 3l7 11h-7M12 6.5 7 14h5" />,
  fete: <path d="M12 3a6 6 0 0 1 6 6c0 4-3 7-6 7s-6-3-6-7a6 6 0 0 1 6-6zM11 16h2l-1 2zM12 18c0 2-2 2-2 4" />,
  expo: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m3 16 5-5 4 4 3-3 6 6" />
      <circle cx="16" cy="9" r="1.5" />
    </>
  ),
  roadtrip: (
    <>
      <path d="M5 16h14v-3l-2-5H7l-2 5zM3.5 13h17" />
      <circle cx="7.5" cy="17.5" r="1.8" />
      <circle cx="16.5" cy="17.5" r="1.8" />
    </>
  ),
  piquenique: <path d="M3 10h18l-2 10H5zM7 10l5-6 5 6M8.5 13.5v3.5M12 13.5v3.5M15.5 13.5v3.5" />,
  maison: <path d="M3 10.5 12 3l9 7.5V21H3zM9.5 21v-6h5v6" />,
  autre: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z" />,
};

/** Le dessin seul, à la couleur du texte. */
export function IconDrawing({ name, size = 24 }: { name: string | null | undefined; size?: number }) {
  const icon = iconOf(name);
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {DRAWINGS[icon.key]}
    </svg>
  );
}

/** La tuile colorée d'une activité : l'icône sur son fond. */
export function ActivityIcon({
  name,
  size = 52,
  className = "",
}: {
  name: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const icon = iconOf(name);
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: icon.bg,
        color: icon.fg,
      }}
    >
      <IconDrawing name={icon.key} size={Math.round(size / 2)} />
    </span>
  );
}
