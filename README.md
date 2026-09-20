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

Renseigner l'URL et la clé publique : bouton **Connect** en haut du dashboard
Supabase → onglet **Framework** → **Next.js**, qui affiche les deux lignes.

Ne pas suivre les autres étapes de cette page : les paquets sont déjà
installés et les clients Supabase existent sous `src/lib/supabase/`.

Le code accepte `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` comme
`NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase a renommé la clé, les deux
fonctionnent.

Renseigner aussi `SUPABASE_SECRET_KEY` (même écran, section **API keys** ;
« service_role » sur les projets plus anciens). Elle est nécessaire à la page
**Comptes** pour créer un compte ou changer un mot de passe — voir plus bas.
Elle ignore la RLS : jamais de préfixe `NEXT_PUBLIC_`, jamais dans le dépôt.

### 3. Créer les comptes

Il n'y a pas d'inscription libre : les comptes sont créés par l'admin. Le
premier — le sien — se crée depuis le dashboard Supabase (Authentication →
Users → Add user), en renseignant `full_name` et `pseudo` dans les **user
metadata** ; un trigger crée la ligne `profiles` correspondante. Les suivants
se créent depuis l'onglet **Comptes** de l'app, qui fait la même chose.

Si on les oublie, le trigger retombe sur la partie gauche de l'email
(`marie@…` → `marie`), suffixée d'un chiffre si ce pseudo est déjà pris. Le
compte reste donc identifiable dans la liste d'invitation ; le pseudo affiché
est simplement approximatif, et chacun peut corriger le sien depuis l'onglet
**Profil**.

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
      page.tsx              calendrier du mois + liste (à venir / passées)
      activities/new/       création (admin uniquement)
      activities/[id]/      détail : dates, budget, participants
      accounts/             gestion des comptes (admin uniquement)
      profile/              nom, pseudo, identifiants
  components/               tab bar, calendrier, primitives visuelles
  lib/
    supabase/               clients navigateur, serveur, proxy et admin
    database.types.ts       reflet manuel de schema.sql
    format.ts               dates, montants, énumérations en français
    session.ts              requireProfile() / requireAdmin(), pages et actions
  proxy.ts                  rafraîchit la session, garde les routes
```

Les mutations passent par des **server actions** ; l'autorisation est portée
par la RLS, pas par le code applicatif. Une action non autorisée n'écrit rien.

## Gestion des comptes (onglet Comptes)

L'admin y voit tous les comptes du groupe et peut, pour chacun, corriger le nom
et le pseudo, changer l'adresse email, remplacer le mot de passe ou supprimer le
compte. Il peut aussi en créer un.

Deux chemins d'autorisation cohabitent, et c'est la seule subtilité du dossier :

| Ce qui est modifié | Où ça vit | Comment l'app y touche |
|---|---|---|
| nom, pseudo | `profiles` | client de session, policy `profiles_update_admin` |
| email, mot de passe, création, suppression | `auth.users` | API d'administration + `SUPABASE_SECRET_KEY` |

`src/lib/supabase/admin.ts` porte cette clé, qui ignore la RLS. **Il ne sert
qu'aux appels `auth.admin.*`** : tout ce qui touche aux tables publiques
continue de passer par la RLS, qui reste le garde-fou. Sans la clé, la page
reste consultable et les noms restent modifiables — elle affiche alors ce qui
lui manque, au lieu d'échouer.

`is_admin` n'est modifiable ni depuis cette page ni depuis aucune autre : le
privilège UPDATE est retiré sur la colonne. Désigner un administrateur passe
toujours par le SQL de la mise en route.

Aucun mail n'est envoyé : ni invitation, ni lien de réinitialisation. L'admin
transmet lui-même les identifiants, et un mot de passe posé ici est actif
immédiatement. C'est délibéré — le SMTP par défaut de Supabase est trop bridé
pour qu'on puisse compter dessus.

## Points d'attention

- **Un créneau unique est retenu d'office**, par le trigger
  `confirm_lone_date_option` : une sortie à date unique n'a rien à faire
  trancher. Proposer un deuxième créneau annule cette validation automatique et
  rouvre le vote ; au-delà de deux, la date retenue a été choisie à la main et
  le trigger n'y touche pas. Conséquence pour le code d'édition : l'en-tête
  (dont le statut) s'écrit **avant** les créneaux, sinon la valeur affichée par
  le formulaire, déjà périmée, écraserait la décision du trigger.
- **Le « oui » et le « non » ne vivent pas au même endroit.** Participer, c'est
  avoir voté sur le créneau retenu (ou sur l'unique créneau proposé) : la donnée
  est une ligne de `votes`. Refuser, c'est `activity_participants.declined` —
  sans cette colonne, un refus serait indistinguable d'une absence de réponse.
  Décliner efface les votes de la personne sur l'activité, et voter efface son
  refus : les deux états ne peuvent pas coexister. Les deux boutons vivent dans
  la section « Ta réponse » ; chacun est un interrupteur, si bien qu'on peut
  revenir à « pas encore répondu ». Tant qu'aucune date n'est tranchée, seul le
  « non » est proposé — « je participe » ne veut rien dire tant qu'on ignore
  quel jour.
- **C'est le pseudo qui s'affiche, jamais le nom complet.** Le groupe se connaît
  sous ces pseudos-là ; l'état civil ne sert qu'à l'administration des comptes,
  où il apparaît sous le pseudo. Tout passe par `displayName()`
  (`src/lib/format.ts`), qui ne retombe sur le nom que si le pseudo est resté
  l'UUID posé par le trigger. Un pseudo peut contenir des espaces : c'est un nom
  d'usage, pas un identifiant technique.
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
