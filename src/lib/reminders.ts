/**
 * Relancer les invités qui n'ont pas répondu.
 *
 * Partagé entre la page (qui affiche le bouton) et l'action (qui envoie) : les
 * deux doivent désigner les mêmes personnes et appliquer le même délai.
 */

/** Une relance toutes les 12 h au plus : assez pour relancer le soir un oubli du matin. */
export const REMINDER_COOLDOWN_MS = 12 * 3600 * 1000;

/**
 * Qui n'a pas répondu. Un refus est une réponse, et l'organisateur, invité de
 * sa propre sortie, ne se relance pas lui-même.
 *
 * Date fixée : n'a pas voté pour elle — ceux de « En attente de réponse ».
 * Vote en cours : n'a voté pour aucun créneau.
 */
export function awaitingIds(
  participants: { profile_id: string; declined: boolean }[],
  votes: { date_option_id: string; profile_id: string }[],
  confirmedDateId: string | null,
  organiserId: string,
): string[] {
  const answered = new Set(
    votes
      .filter((v) => !confirmedDateId || v.date_option_id === confirmedDateId)
      .map((v) => v.profile_id),
  );
  return participants
    .filter((p) => p.profile_id !== organiserId && !p.declined && !answered.has(p.profile_id))
    .map((p) => p.profile_id);
}

/** L'heure à partir de laquelle une nouvelle relance est permise, ou null si elle l'est déjà. */
export function nextReminderAt(remindedAt: string | null, now = Date.now()): Date | null {
  if (!remindedAt) return null;
  const next = new Date(remindedAt).getTime() + REMINDER_COOLDOWN_MS;
  return next > now ? new Date(next) : null;
}

const parisTime = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  // Le serveur tourne en UTC : sans fuseau explicite, 14 h s'afficherait 12 h.
  timeZone: "Europe/Paris",
});

/** « lun. 14:32 », à l'heure française. */
export function formatReminderTime(date: string | Date) {
  return parisTime.format(new Date(date));
}
