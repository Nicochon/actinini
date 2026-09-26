import { displayName } from "@/lib/format";

type Person = { id: string; pseudo?: string; full_name?: string };

/**
 * Teintes des pastilles, fond et texte. Toutes passent le contraste AA avec
 * leur texte ; la moutarde, trop claire pour du blanc, prend l'encre.
 */
const TONES: [string, string][] = [
  ["#e2a93b", "#2b1d14"],
  ["#5e7a52", "#ffffff"],
  ["#b8472a", "#ffffff"],
  ["#7a5c8e", "#ffffff"],
  ["#3d6e8c", "#ffffff"],
  ["#2b1d14", "#f7efe3"],
  ["#9a3350", "#ffffff"],
  ["#4a6b3a", "#ffffff"],
];

/**
 * La couleur se déduit de l'identifiant : chacun garde la sienne sur tous les
 * écrans et tous les appareils, sans rien stocker ni rien choisir.
 */
function toneOf(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
}

/** « Camille Bernard » → CB ; un pseudo seul, « marie » → MA. */
function initialsOf(person: Person) {
  const words = (person.full_name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return displayName(person).replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase() || "?";
}

/**
 * Pastille ronde aux initiales. `ring` l'entoure de la couleur du fond pour
 * qu'elle se détache quand plusieurs se chevauchent (voir `AvatarStack`).
 */
export function Avatar({
  person,
  size = 44,
  ring,
  className = "",
}: {
  person: Person;
  size?: number;
  ring?: string;
  className?: string;
}) {
  const [background, color] = toneOf(person.id);
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${className}`}
      style={{
        width: size,
        height: size,
        background,
        color,
        fontSize: Math.max(10, Math.round(size / 3)),
        boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
      }}
    >
      {initialsOf(person)}
    </span>
  );
}

/** Pastilles qui se chevauchent : « qui vient » d'un coup d'œil. */
export function AvatarStack({
  people,
  size = 28,
  ring = "var(--color-paper-raised)",
  max = 5,
}: {
  people: Person[];
  size?: number;
  ring?: string;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="inline-flex items-center" aria-hidden>
      {shown.map((person, index) => (
        <Avatar
          key={person.id}
          person={person}
          size={size}
          ring={ring}
          className={index > 0 ? "-ml-2" : ""}
        />
      ))}
      {rest > 0 && (
        <span
          className="bg-line-soft text-ink -ml-2 inline-flex items-center justify-center rounded-full font-bold"
          style={{ width: size, height: size, fontSize: Math.round(size / 3), boxShadow: `0 0 0 2px ${ring}` }}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}
