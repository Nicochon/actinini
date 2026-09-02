# Actinini

App de gestion d'activités entre amis — dates, budget partagé, participants.
Voir `PROJECT-SPEC.md` pour la spécification fonctionnelle.

**Stack** : Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · Supabase (Postgres + Auth + RLS)

## Mise en route

### 1. Base de données

Créer un projet sur [supabase.com](https://supabase.com), puis coller `schema.sql`
d'un bloc dans l'éditeur SQL. Le fichier est idempotent sur une base vierge :
tables, index, fonctions, triggers et policies RLS.

### 2. Variables d'environnement

```bash
cp .env.local.example .env.local
```

Renseigner l'URL et la clé anon du projet
(Dashboard → Project Settings → API).

### 3. Créer les comptes

Il n'y a pas d'inscription libre : les comptes sont créés par l'admin depuis
le dashboard Supabase (Authentication → Users → Add user). Renseigner
`full_name` et `pseudo` dans les **user metadata** — un trigger crée la ligne
`profiles` correspondante.

Puis désigner l'administrateur du groupe, en SQL :

```sql
update profiles set is_admin = true where pseudo = 'ton-pseudo';
```

`is_admin` n'est pas modifiable depuis l'app (le privilège UPDATE est retiré
sur la colonne) : il ne se pose que par cette voie.

### 4. Lancer

```bash
npm install
npm run dev
```

> Node 18.18+ requis (Next 16).

## Installation sur téléphone (PWA)

L'app s'installe sur l'écran d'accueil depuis le navigateur, sans store :

- **Android / Chrome** — menu ⋮ → « Installer l'application »
- **iOS / Safari** — Partager → « Sur l'écran d'accueil »

Elle s'ouvre alors en plein écran, sans barre d'adresse, avec sa propre icône.

**Cela demande HTTPS** : l'installation n'est proposée qu'en production (Vercel
fournit le certificat) ou sur `localhost`. Depuis un téléphone pointant sur un
`npm run dev` en IP locale, l'app fonctionne mais n'est pas installable.

Les pièces concernées :

| Fichier | Rôle |
|---|---|
| `src/app/manifest.ts` | nom, icônes, couleurs, `display: standalone` |
| `public/icon-*.png` | icônes 192 et 512, plus une version *maskable* pour Android |
| `src/app/apple-icon.png` | icône iOS (sans transparence, non recadrée) |
| `public/sw.js` | service worker : installabilité et écran hors ligne |
| `src/app/offline/page.tsx` | page servie quand le réseau ne répond pas |

Le service worker **ne met jamais en cache une page authentifiée** : seuls les
actifs figés de Next et la page `/offline` le sont. Les pages passent toujours
par le réseau — sur un téléphone partagé, servir une page en cache reviendrait
à montrer les données d'un autre compte.

`/manifest.webmanifest` et `/sw.js` sont exclus du garde d'authentification
(`src/proxy.ts`) : le navigateur les lit avant toute connexion, et les faire
rediriger vers `/login` casserait l'installation.

## Structure

```
src/
  app/
    login/                  connexion email / mot de passe
    (app)/                  routes protégées, avec la tab bar
      page.tsx              liste des activités (à venir / passées)
      activities/new/       création (admin uniquement)
      activities/[id]/      détail : dates, budget, participants
      profile/              nom, pseudo, identifiants
  components/               tab bar + primitives visuelles
  lib/
    supabase/               clients navigateur, serveur et proxy
    database.types.ts       reflet manuel de schema.sql
    format.ts               dates, montants, énumérations en français
    session.ts              requireProfile() pour pages et actions
  proxy.ts                  rafraîchit la session, garde les routes
```

Les mutations passent par des **server actions** ; l'autorisation est portée
par la RLS, pas par le code applicatif. Une action non autorisée n'écrit rien.

## Points d'attention

- **Les lignes `payments` ne sont jamais écrites par l'app.** Elles sont créées
  et supprimées par des triggers Postgres (création d'une ligne de budget en
  mode « avance », arrivée ou départ d'un participant, changement de mode de
  paiement). L'app ne fait qu'un `update` sur `paid`.
- **L'ordre compte à la création d'une activité** : les participants sont
  insérés avant les lignes de budget, sinon le trigger n'a personne à qui
  générer des remboursements.
- **Les policies SELECT ne doivent pas ré-interroger leur propre table** : la
  ligne en cours d'insertion n'y est pas visible, et tout `insert … returning`
  (le `.insert().select()` de supabase-js) échoue en 42501. D'où le
  `created_by = auth.uid()` en dur dans `activities_select_member`.

## Régénérer les types

```bash
npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
```
