import { Card } from "@/components/ui";

export const metadata = { title: "Hors ligne" };

/**
 * Servie par le service worker quand le réseau ne répond pas. Elle doit rester
 * accessible sans session : elle est mise en cache à l'installation, avant
 * toute connexion.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col justify-center px-5 py-8">
      <h1 className="font-display mb-2 text-2xl font-medium tracking-[-0.01em]">Hors ligne</h1>
      <Card>
        <p className="text-ink-soft text-sm">
          Pas de connexion pour l&apos;instant. Les activités, les votes et le budget se lisent en
          direct — reviens dès que le réseau est revenu.
        </p>
      </Card>
    </main>
  );
}
