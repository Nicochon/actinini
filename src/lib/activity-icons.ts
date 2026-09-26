/**
 * La bibliothèque d'icônes d'activité : la clé est ce qu'on stocke en base
 * (`activities.icon`), le reste sert à l'affichage. L'ordre est celui du
 * sélecteur, les plus courantes en tête.
 *
 * Les dessins vivent dans `components/activity-icon.tsx` ; ce fichier-ci reste
 * sans JSX pour pouvoir valider une clé côté serveur.
 */
export const ACTIVITY_ICONS = [
  { key: "voyage", label: "Voyage", bg: "#fbe3a8", fg: "#6e4708" },
  { key: "rando", label: "Rando", bg: "#dfe7d6", fg: "#34502b" },
  { key: "soiree", label: "Soirée", bg: "#eadcf0", fg: "#5d3f73" },
  { key: "jeux", label: "Jeux", bg: "#d6e6f0", fg: "#2f5a75" },
  { key: "resto", label: "Resto", bg: "#f8d5c8", fg: "#8f3620" },
  { key: "concert", label: "Concert", bg: "#f7d9de", fg: "#8a2d47" },
  { key: "cine", label: "Ciné", bg: "#e5e1da", fg: "#4a4038" },
  { key: "sport", label: "Sport", bg: "#dfe7d6", fg: "#34502b" },
  { key: "plage", label: "Plage", bg: "#fbe3a8", fg: "#6e4708" },
  { key: "anniv", label: "Anniv", bg: "#f7d9de", fg: "#8a2d47" },
  { key: "cafe", label: "Café", bg: "#f8d5c8", fg: "#8f3620" },
  { key: "velo", label: "Vélo", bg: "#d6e6f0", fg: "#2f5a75" },
  { key: "ski", label: "Ski", bg: "#d6e6f0", fg: "#2f5a75" },
  { key: "camping", label: "Camping", bg: "#dfe7d6", fg: "#34502b" },
  { key: "bateau", label: "Bateau", bg: "#d6e6f0", fg: "#2f5a75" },
  { key: "fete", label: "Fête", bg: "#eadcf0", fg: "#5d3f73" },
  { key: "expo", label: "Expo", bg: "#e5e1da", fg: "#4a4038" },
  { key: "roadtrip", label: "Road trip", bg: "#fbe3a8", fg: "#6e4708" },
  { key: "piquenique", label: "Pique-nique", bg: "#f8d5c8", fg: "#8f3620" },
  { key: "maison", label: "Chez quelqu'un", bg: "#eadcf0", fg: "#5d3f73" },
  { key: "autre", label: "Autre", bg: "#e5e1da", fg: "#4a4038" },
] as const;

export type ActivityIconKey = (typeof ACTIVITY_ICONS)[number]["key"];

export const DEFAULT_ICON: ActivityIconKey = "autre";

const BY_KEY = new Map<string, (typeof ACTIVITY_ICONS)[number]>(
  ACTIVITY_ICONS.map((icon) => [icon.key, icon]),
);

/** Une clé inconnue — valeur future, base modifiée à la main — retombe sur « Autre ». */
export function iconOf(key: string | null | undefined) {
  return BY_KEY.get(key ?? "") ?? BY_KEY.get(DEFAULT_ICON)!;
}

export function isIconKey(key: unknown): key is ActivityIconKey {
  return typeof key === "string" && BY_KEY.has(key);
}
