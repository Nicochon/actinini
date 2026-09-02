# App de gestion d'activités entre amis — Spécification

## 1. Contexte et objectif

Remplacer un groupe WhatsApp servant à organiser des activités entre amis (proposer une sortie, sonder des dates, gérer un budget partagé). L'app centralise l'info pour qu'elle ne se perde plus dans le flux de conversation.

- Groupe fermé, **1 à 15 personnes**
- **Un seul administrateur** (le créateur du projet) : lui seul crée les comptes et les activités. Il est identifié par le flag `profiles.is_admin`, posé à la main depuis le dashboard Supabase (aucun utilisateur ne peut se l'attribuer)
- **Aucune messagerie/chat dans l'app** — seulement l'info structurée (dates, budget, participants)
- **Aucune notification** (ni push, ni email) en V1
- Suivi des paiements **visible par tous les participants** de l'activité (transparence assumée)

## 2. Stack technique

- **Frontend** : Next.js
- **Style** : Tailwind CSS
- **Backend / DB / Auth** : Supabase (Postgres + Supabase Auth + Row Level Security)
- **Déploiement** : via Git (repo poussé, déployable sur Vercel)

## 3. Modèle de données

Voir `schema.sql` (fichier séparé) pour le SQL complet : 7 tables, index, 5 fonctions utilitaires, 7 triggers et les policies RLS, prêt à exécuter d'un bloc dans l'éditeur SQL de Supabase.

Résumé des tables :

| Table | Rôle |
|---|---|
| `profiles` | Infos affichables des comptes (nom, pseudo unique, `is_admin`), complète `auth.users` |
| `activities` | Une activité : titre, description, statut (`voting` / `confirmed` / `completed` / `cancelled`), créneau retenu (`confirmed_date_option_id`), créateur |
| `activity_participants` | Qui est invité à quelle activité (sous-ensemble des `profiles`) |
| `date_options` | Créneaux proposés pour une activité (`start_date` + `end_date` optionnelle pour les plages) |
| `votes` | Qui a voté pour quel créneau (un participant peut voter pour plusieurs créneaux, vote togglable) |
| `budget_items` | Lignes de budget par activité (ex: "vol", "logement"), montant **par personne**, mode de paiement par ligne |
| `payments` | Suivi des remboursements par participant, **généré automatiquement** par trigger quand un `budget_item` en mode `advance` est créé |

Règles métier clés :
- Un participant peut voter pour **plusieurs** créneaux (pas de choix unique)
- La date gagnante n'est **pas automatique** : l'admin valide manuellement quel créneau devient la date confirmée, même en cas d'égalité de votes. Le créneau retenu est stocké dans `activities.confirmed_date_option_id` ; un trigger vérifie qu'il appartient bien à cette activité
- Un créneau est une **plage de jours** : `start_date` seule = journée unique, `end_date` renseignée = plage (ex. « ven 16 au dim 18 octobre »). Pas d'heure en base — l'horaire précis va dans la description
- `payment_mode` est défini **par ligne de budget**, pas par activité entière (ex: le vol est avancé par l'admin, le logement est payé sur place)
- Les lignes `payments` sont gérées **entièrement par triggers**, jamais écrites directement par l'app :
  - création d'un `budget_item` en mode `advance` → une ligne par participant déjà invité
  - participant ajouté ensuite → ses lignes manquantes sont rattrapées
  - participant retiré → ses lignes de paiement et ses votes sur l'activité sont effacés
  - `budget_item` basculé `on_site` → `advance` → les lignes sont créées ; l'inverse les supprime
  - `paid_at` est horodaté automatiquement quand `paid` passe à vrai, et remis à `null` si on décoche
- Seul l'admin du groupe (`is_admin`) peut créer une activité ; seul le créateur d'une activité peut la modifier, gérer les participants, les dates et le budget, et cocher un paiement comme reçu
- Chaque utilisateur peut modifier son propre profil (nom, pseudo) et ses identifiants (via `supabase.auth.updateUser()`). Les colonnes `id`, `is_admin` et `created_at` lui sont inaccessibles en écriture (privilèges retirés au niveau colonne)

## 4. Écrans (pages)

Navigation mobile : tab bar fixée en bas de l'écran avec 3 onglets.

```
/login                — connexion email/mot de passe (Supabase Auth)
/                      — liste des activités (à venir / passées), onglet "Liste"
/activities/new        — création d'activité (admin uniquement), onglet "Nouvelle activité"
/activities/[id]       — détail d'une activité
/profile               — édition du profil personnel, onglet "Profil"
```

### Détail d'une activité (`/activities/[id]`)
Sections dans l'ordre, séparées par une ligne pointillée (perforation) :
1. **En-tête** — titre, description, badge de statut
2. **Dates proposées** — chaque créneau avec le nombre de votes et les noms de ceux qui ont voté ; bouton toggle pour voter ; bouton "Confirmer cette date" (admin uniquement)
3. **Budget par personne** — chaque ligne (ex: vol, logement) avec montant, mode de paiement, et pour le mode "avance" : combien de participants ont remboursé
4. **Participants** — liste des invités sous forme de chips ; ajout/retrait possible par l'admin

### Création d'activité (`/activities/new`)
Formulaire dans une carte blanche : titre, description, liste de dates (ajout dynamique), lignes de budget (label + montant par personne + mode de paiement), sélection des participants parmi les comptes existants.

## 5. Direction visuelle (design tokens)

Un prototype HTML autonome est fourni (`prototype-app-activites.html`) — à ouvrir dans un navigateur pour voir le rendu exact. Voici les tokens utilisés, à reprendre dans Tailwind :

**Couleurs**
```
--paper:        #F3F4F1   (fond de page, blanc cassé/gris)
--paper-raised: #FFFFFF   (cartes, fond blanc pur)
--ink:          #22281F   (texte principal, encre foncée)
--ink-soft:     #5B6152   (texte secondaire)
--amber:        #C98A2B   (accent statut "vote en cours")
--amber-deep:   #8A5C16   (texte sur fond amber)
--sage:         #6E7F5C   (accent statut "confirmé" / vote actif)
--sage-deep:    #4A5540   (texte sur fond sage)
--brick:        #A8493A   (accent alertes/suppression)
--brick-deep:   #7A3428
--line:         #D6D8D2   (bordures)
--line-soft:    #E4E5E1   (séparateurs internes)
```

**Typographie**
- Titres / display : **Fraunces** (serif, chargée via Google Fonts), poids 500
- Corps de texte / UI : **Inter** (sans-serif), poids 400/500

**Layout**
- Largeur de contenu plafonnée à 640px, centrée
- Cartes : `border-radius: 4px`, bordure fine `1px solid var(--line)`, fond `--paper-raised`
- Séparateur de section dans le détail d'activité : ligne pointillée horizontale (`border-top: 1px dashed var(--line)`) façon perforation de ticket
- Badges de statut : forme pilule (`border-radius: 20px`), couleur selon statut (amber = vote en cours, sage = confirmé, gris = passé)
- Navigation : tab bar fixée en bas de l'écran (`position: fixed; bottom: 0`), 3 onglets avec petit point indicateur sous l'onglet actif

## 6. Fichiers fournis

- `schema.sql` — schéma complet Supabase (tables, contraintes, triggers, RLS), prêt à exécuter
- `prototype-app-activites.html` — prototype visuel autonome (HTML/CSS/JS, sans dépendances) montrant les 3 écrans principaux et l'interaction de vote

## 7. Hors scope (V1)

- Chat / messagerie dans l'app
- Notifications push ou email
- Inscription libre (les comptes sont créés uniquement par l'admin)
- Résolution automatique de la date gagnante (toujours une validation manuelle)
