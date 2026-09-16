import webpush, { WebPushError } from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/**
 * Envoi des notifications push (Web Push, protocole VAPID).
 *
 * Pas de service tiers ni de compte Firebase : le serveur signe lui-même ses
 * messages avec une paire de clés VAPID et les dépose chez Apple ou Google,
 * dont l'URL est l'`endpoint` enregistré par chaque appareil.
 *
 * Principe qui gouverne tout ce fichier : **une notification qui ne part pas
 * ne doit jamais faire échouer l'action de l'utilisateur**. Créer une activité
 * reste l'opération importante ; prévenir les invités est un bonus. Toutes les
 * erreurs sont donc avalées et journalisées, jamais propagées.
 */

/** Ce qu'un appareil expose au serveur pour recevoir un message chiffré. */
export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** Ce que le service worker reçoit et affiche. Voir `public/sw.js`. */
export type PushPayload = {
  title: string;
  body: string;
  /** Chemin ouvert au clic sur la notification, relatif à la racine. */
  url: string;
};

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

/**
 * Identité du serveur, transmise à Apple et Google pour qu'ils puissent nous
 * contacter en cas d'abus. Une URL https ou un `mailto:` ; on prend l'URL du
 * site par défaut, pour ne pas publier d'adresse personnelle.
 */
const SUBJECT = process.env.VAPID_SUBJECT ?? "https://actinini.vercel.app";

let configured = false;

/**
 * Renseigne les clés au premier envoi — pas à l'import.
 *
 * Sans clés, l'app tourne normalement, seules les notifications sont muettes :
 * c'est l'état d'une installation qui n'a pas encore fait l'étape VAPID, et ça
 * ne doit pas empêcher de créer une activité.
 */
function ready(): boolean {
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
  if (!configured) {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
    configured = true;
  }
  return true;
}

/**
 * Envoie à une liste d'appareils. Rend les endpoints morts, à effacer.
 *
 * 404 et 410 sont les réponses d'Apple et de Google pour « cet appareil ne
 * répond plus » : app désinstallée, abonnement expiré, téléphone remplacé.
 * Sans ce nettoyage, la table enfle d'appareils fantômes qu'on réessaie à
 * chaque activité.
 */
export async function sendPush(
  targets: PushTarget[],
  payload: PushPayload,
): Promise<string[]> {
  if (!ready() || targets.length === 0) return [];

  const body = JSON.stringify(payload);
  const dead: string[] = [];

  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification(
          { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
          body,
          // Une semaine : une invitation reste utile même si le téléphone est
          // resté éteint le week-end.
          { TTL: 7 * 24 * 3600 },
        );
      } catch (error) {
        if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
          dead.push(t.endpoint);
          return;
        }
        console.error("Notification non envoyée :", error);
      }
    }),
  );

  return dead;
}

/**
 * Prévient les invités d'une activité, l'organisateur excepté.
 *
 * La lecture des destinataires passe par `push_targets_for_activity`, une
 * fonction `security definer` : sous RLS, l'organisateur ne peut pas lire les
 * abonnements des autres — et c'est bien ainsi. C'est ce détour qui évite
 * d'avoir à confier la service_role key à l'application.
 */
export async function notifyActivityParticipants(
  supabase: SupabaseClient<Database>,
  activityId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ready()) return;

  try {
    const { data: targets, error } = await supabase.rpc("push_targets_for_activity", {
      p_activity_id: activityId,
    });
    if (error || !targets || targets.length === 0) return;

    const dead = await sendPush(targets, payload);

    // Les endpoints morts appartiennent à d'autres comptes : leur suppression
    // passe elle aussi par une fonction `security definer`.
    await Promise.all(
      dead.map((endpoint) => supabase.rpc("forget_push_subscription", { p_endpoint: endpoint })),
    );
  } catch (error) {
    console.error("Notification des participants impossible :", error);
  }
}
