"use client";

import { useEffect, useState, useTransition } from "react";

import { Card, FormError, PrimaryButton } from "@/components/ui";

import { registerDevice, sendTestNotification, unregisterDevice, type PushState } from "./push-actions";

/**
 * La clé publique VAPID, lue littéralement : Next substitue
 * `process.env.NEXT_PUBLIC_*` à la compilation par analyse statique, un accès
 * dynamique ne serait pas remplacé dans le bundle navigateur.
 */
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/**
 * La clé publique voyage en base64url ; `pushManager.subscribe()` veut des
 * octets bruts.
 *
 * Le type de retour est `Uint8Array<ArrayBuffer>` et non `Uint8Array` tout
 * court : depuis TypeScript 5.7 le second couvre aussi les `SharedArrayBuffer`,
 * que `applicationServerKey` refuse.
 */
function decodeKey(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), "=");
  const binary = window.atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

type Status =
  /** Tant qu'on n'a pas interrogé le navigateur, on n'affiche rien. */
  | { kind: "checking" }
  /** iPhone, mais l'app n'est pas installée : c'est là que ça coince le plus souvent. */
  | { kind: "needs-install" }
  /** Navigateur sans push, ou service worker non enregistré (dev en http). */
  | { kind: "unsupported" }
  /** Serveur sans clés VAPID. */
  | { kind: "unconfigured" }
  /** L'utilisateur a refusé : seul le système peut revenir en arrière. */
  | { kind: "blocked" }
  | { kind: "off" }
  | { kind: "on"; endpoint: string };

/**
 * Ce que le navigateur a à dire sur les notifications, au chargement.
 *
 * Rend l'état au lieu de le poser : un `setState` synchrone depuis le corps
 * d'un effet déclenche des rendus en cascade, et React le signale.
 */
async function detect(): Promise<Status> {
  if (!VAPID_PUBLIC_KEY) return { kind: "unconfigured" };

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    // Sur iPhone, `PushManager` n'existe que dans l'app installée sur l'écran
    // d'accueil — dans un onglet Safari, il est simplement absent. C'est donc
    // une marche à suivre qu'il faut afficher, pas un « navigateur non
    // compatible » qui laisserait l'utilisateur sans issue.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    return { kind: isIOS ? "needs-install" : "unsupported" };
  }

  // `serviceWorker.ready` n'aboutit jamais si l'enregistrement a échoué — en
  // développement sur une IP locale, par exemple, où le navigateur refuse les
  // service workers hors HTTPS. On borne l'attente plutôt que de laisser la
  // section vide indéfiniment.
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
  ]);
  if (!registration) return { kind: "unsupported" };

  const subscription = await registration.pushManager.getSubscription();
  if (subscription) return { kind: "on", endpoint: subscription.endpoint };

  return { kind: Notification.permission === "denied" ? "blocked" : "off" };
}

/**
 * Activation des notifications pour l'appareil courant.
 *
 * Un abonnement vaut pour **un appareil**, pas pour un compte : chacun doit
 * l'activer depuis chacun de ses téléphones. D'où le vocabulaire « cet
 * appareil » partout dans les libellés.
 */
export function PushNotifications() {
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const [feedback, setFeedback] = useState<PushState>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let current = true;
    detect().then((next) => {
      if (current) setStatus(next);
    });
    return () => {
      current = false;
    };
  }, []);

  const enable = () =>
    startTransition(async () => {
      setFeedback({});
      try {
        // La demande de permission doit partir d'un vrai clic : les
        // navigateurs ignorent silencieusement celles qui n'en viennent pas.
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return setStatus({ kind: "blocked" });

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          // Obligatoire, et pas seulement déclaratif : iOS révoque
          // l'abonnement d'un serveur qui enverrait un push sans notification.
          userVisibleOnly: true,
          applicationServerKey: decodeKey(VAPID_PUBLIC_KEY!),
        });

        const { keys } = subscription.toJSON() as { keys?: { p256dh: string; auth: string } };
        if (!keys) throw new Error("Abonnement sans clés de chiffrement");

        const result = await registerDevice({
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        });

        setFeedback(result);
        // Un abonnement que le serveur n'a pas pu stocker ne sert à rien : on
        // le défait, pour que le bouton ne mente pas sur l'état réel.
        if (result.error) {
          await subscription.unsubscribe();
          return setStatus({ kind: "off" });
        }
        setStatus({ kind: "on", endpoint: subscription.endpoint });
      } catch {
        setFeedback({ error: "Les notifications n'ont pas pu être activées sur cet appareil." });
      }
    });

  const disable = () =>
    startTransition(async () => {
      setFeedback({});
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          // Le serveur d'abord : après `unsubscribe()`, l'endpoint est perdu
          // et la ligne resterait en base à recevoir des envois dans le vide.
          setFeedback(await unregisterDevice(subscription.endpoint));
          await subscription.unsubscribe();
        }
        setStatus({ kind: "off" });
      } catch {
        setFeedback({ error: "Les notifications n'ont pas pu être coupées." });
      }
    });

  const test = () =>
    startTransition(async () => {
      setFeedback({});
      setFeedback(await sendTestNotification());
    });

  if (status.kind === "checking") return null;

  return (
    <Card>
      {status.kind === "needs-install" && (
        <Explanation>
          Sur iPhone, les notifications demandent que l&apos;app soit installée sur
          l&apos;écran d&apos;accueil. Appuie sur le bouton Partager <strong>↑</strong> en bas de
          Safari, descends dans la liste, puis « Sur l&apos;écran d&apos;accueil ». Reviens
          ensuite ici depuis l&apos;app installée.
        </Explanation>
      )}

      {status.kind === "unsupported" && (
        <Explanation>Ce navigateur ne sait pas recevoir de notifications.</Explanation>
      )}

      {status.kind === "unconfigured" && (
        <Explanation>
          Les notifications ne sont pas configurées sur le serveur (clés VAPID manquantes).
        </Explanation>
      )}

      {status.kind === "blocked" && (
        <Explanation>
          Les notifications sont bloquées pour ce site. Le navigateur ne redemandera plus :
          il faut les réautoriser dans les réglages du téléphone, à la ligne de cette app.
        </Explanation>
      )}

      {status.kind === "off" && (
        <>
          <Explanation>
            Reçois une alerte sur cet appareil quand une nouvelle activité t&apos;est proposée.
          </Explanation>
          <PrimaryButton type="button" onClick={enable} disabled={pending}>
            {pending ? "Activation…" : "Activer les notifications"}
          </PrimaryButton>
        </>
      )}

      {status.kind === "on" && (
        <>
          <Explanation>Les notifications sont actives sur cet appareil.</Explanation>
          <div className="mt-4 flex items-center gap-4">
            <button
              type="button"
              onClick={test}
              disabled={pending}
              className="text-ink-soft text-[13px] font-medium underline disabled:opacity-50"
            >
              Envoyer un test
            </button>
            <button
              type="button"
              onClick={disable}
              disabled={pending}
              className="text-brick-deep text-[13px] font-medium underline disabled:opacity-50"
            >
              Désactiver
            </button>
          </div>
        </>
      )}

      {feedback.error && <FormError>{feedback.error}</FormError>}
      {feedback.success && (
        <p role="status" className="text-sage-deep bg-sage-pale mt-4 rounded-md px-3 py-2 text-[13px]">
          {feedback.success}
        </p>
      )}
    </Card>
  );
}

function Explanation({ children }: { children: React.ReactNode }) {
  return <p className="text-ink-soft text-[13px] leading-relaxed">{children}</p>;
}
