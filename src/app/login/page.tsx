import { Card } from "@/components/ui";

import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion — Nos activités" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const target = typeof next === "string" ? next : "/";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col justify-center px-5 py-8">
      <h1 className="font-display mb-1 text-2xl font-medium tracking-[-0.01em]">Nos activités</h1>
      <p className="text-ink-soft mb-7 text-sm">
        Connecte-toi avec les identifiants que l&apos;admin t&apos;a transmis.
      </p>
      <Card>
        <LoginForm next={target} />
      </Card>
    </main>
  );
}
