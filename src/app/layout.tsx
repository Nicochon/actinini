import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";

import { ServiceWorker } from "@/components/service-worker";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Nos activités",
  description: "Organiser les sorties du groupe : dates, budget, participants.",
  applicationName: "Activités",
  // Le nom sous l'icône et la barre d'état de l'app installée sur iPhone.
  // (Le plein écran, lui, vient de `display: standalone` du manifeste, que
  // Safari lit depuis iOS 16.4.)
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Activités" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f3f4f1",
  // Nécessaire pour que `env(safe-area-inset-*)` soit renseigné : c'est ce qui
  // empêche la tab bar de passer sous l'indicateur d'accueil de l'iPhone.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
