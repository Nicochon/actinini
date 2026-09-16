"use server";

import { sendPush, type PushTarget } from "@/lib/push";
import { requireProfile } from "@/lib/session";

export type PushState = { error?: string; success?: string };

/** Ce que `pushManager.subscribe()` produit, réduit à ce qu'on stocke. */
export type DeviceKeys = { endpoint: string; p256dh: string; auth: string };

/**
 * Enregistre l'appareil courant pour le compte connecté.
 *
 * Passe par `save_push_subscription` plutôt que par un insert : la fonction
 * réattribue l'endpoint s'il était déjà connu sous un autre compte — le cas du
 * téléphone prêté, ou du compte de démo utilisé avant le vrai.
 */
export async function registerDevice(device: DeviceKeys): Promise<PushState> {
  const { supabase } = await requireProfile();

  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: device.endpoint,
    p_p256dh: device.p256dh,
    p_auth: device.auth,
  });

  if (error) return { error: "L'appareil n'a pas pu être enregistré." };
  return { success: "Notifications activées sur cet appareil." };
}

/** Oublie l'appareil courant. */
export async function unregisterDevice(endpoint: string): Promise<PushState> {
  const { supabase } = await requireProfile();

  const { error } = await supabase.rpc("forget_push_subscription", { p_endpoint: endpoint });

  if (error) return { error: "L'appareil n'a pas pu être désinscrit." };
  return { success: "Notifications coupées sur cet appareil." };
}

/**
 * S'envoie une notification à soi-même, sur tous ses appareils.
 *
 * Seul moyen honnête de vérifier la chaîne complète (clés VAPID, abonnement,
 * service worker, réglages du téléphone) sans attendre qu'une vraie activité
 * soit créée. Lit ses propres abonnements : la RLS l'autorise pour soi seul.
 */
export async function sendTestNotification(): Promise<PushState> {
  const { supabase, profile } = await requireProfile();

  const { data: devices } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("profile_id", profile.id);

  if (!devices || devices.length === 0) {
    return { error: "Aucun appareil enregistré pour ce compte." };
  }

  const dead = await sendPush(devices as PushTarget[], {
    title: "Nos activités",
    body: "Test réussi : les notifications fonctionnent sur cet appareil.",
    url: "/",
  });

  await Promise.all(
    dead.map((endpoint) => supabase.rpc("forget_push_subscription", { p_endpoint: endpoint })),
  );

  if (dead.length === devices.length) {
    return { error: "Les appareils enregistrés ne répondent plus. Réactive les notifications." };
  }

  return { success: "Notification envoyée. Elle devrait arriver dans quelques secondes." };
}
