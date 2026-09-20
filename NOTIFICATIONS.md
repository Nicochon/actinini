# Notifications — état des lieux et suites possibles

Note de travail, pas une spécification figée. Elle recense ce qui existe, ce qui
manque, et ce que chaque ajout coûte réellement.

## Ce qui existe aujourd'hui

**Un seul déclencheur** : la création d'une activité prévient ses invités,
l'organisateur excepté (`createActivity`, via `notifyActivityParticipants()`).

La tuyauterie, elle, est complète et réutilisable :

| Pièce | Rôle |
|---|---|
| `src/lib/push.ts` | signature VAPID, envoi, nettoyage des appareils morts |
| `public/sw.js` | réception et affichage, clic qui ouvre la bonne page |
| `push_subscriptions` | un appareil abonné = une ligne |
| `push_targets_for_activity()` | à qui envoyer, en `security definer` |

Ajouter un déclencheur sur une action existante, c'est donc **un appel de
fonction**, pas un chantier.

### Trois règles à ne pas casser

1. **Un envoi qui échoue ne fait jamais échouer l'action.** Créer une activité
   reste l'opération importante ; prévenir est un bonus. Toutes les erreurs sont
   avalées et journalisées. C'est la règle qui gouverne `src/lib/push.ts`.
2. **L'envoi ne fait pas attendre l'utilisateur.** `createActivity` passe par
   `after()` : la réponse part, les notifications suivent. Un téléphone
   injoignable ne doit pas laisser l'organisateur devant son formulaire.
3. **L'app lit les abonnements des autres par fonction `security definer`.**
   Sous RLS, chacun ne voit que ses propres appareils — et c'est bien ainsi.
   C'est ce détour qui évite de confier la clé secrète à cette partie du code.

### Ce qu'il faut savoir avant de promettre quoi que ce soit

- **Un abonnement vaut pour un appareil, pas pour un compte.** Chacun doit
  activer les notifications depuis chacun de ses téléphones. Un ami qui ne
  reçoit rien n'a le plus souvent jamais appuyé sur le bouton.
- **Sur iPhone, rien n'arrive tant que l'app n'est pas installée** sur l'écran
  d'accueil. C'est une contrainte d'iOS, pas un bug.
- **Sans clés VAPID, l'app tourne, les notifications sont muettes.** Le message
  affiché dans *Profil → Notifications* nomme lui-même la panne.

## Les suites, par coût croissant

### 1. La date est fixée

**Le moment où tout le monde a besoin de savoir**, et le seul de la vie d'une
sortie qui ne prévient personne. Un appel dans `confirmDate`, à destination des
invités.

- Coût : une dizaine de lignes, aucune migration.
- Texte : « Weekend à Lisbonne — c'est le 16 au 18 octobre ».
- Piège : ne pas l'envoyer deux fois si l'organisateur change d'avis et
  reconfirme le même créneau. Comparer à l'ancienne valeur avant d'envoyer.

### 2. Tu es invité à une activité existante

Quelqu'un ajouté **après** la création ne reçoit rien aujourd'hui : il n'apprend
la sortie qu'en ouvrant l'app. Un appel dans `addParticipant`, à destination de
la seule personne ajoutée.

- Coût : une dizaine de lignes, **plus** une fonction SQL qui rend les appareils
  d'un profil donné — `push_targets_for_activity()` vise tous les invités et ne
  sait pas cibler.
- Migration : oui, courte (une fonction `security definer` de plus).

### 3. L'activité est annulée

Passer une activité en « annulée » ne prévient personne, alors que c'est
exactement ce qu'on veut savoir sans ouvrir l'app. Un appel dans
`updateActivity`, quand le statut bascule vers `cancelled`.

- Coût : une dizaine de lignes, aucune migration.
- Piège : ne déclencher que sur la **bascule**, pas à chaque enregistrement
  d'une activité déjà annulée.

### 4. Relancer ceux qui n'ont pas répondu

Un bouton pour l'organisateur, à côté de « En attente de réponse · 4 ». Il
réveille ces quatre-là et personne d'autre — l'équivalent du « alors, vous
venez ? » dans le groupe WhatsApp, sans déranger les sept qui ont déjà répondu.

- Coût : une server action, un bouton, et la même fonction SQL ciblée qu'au
  point 2.
- Migration : oui, mutualisée avec le point 2.
- Piège : prévoir un garde-fou contre la relance compulsive (un envoi par jour
  et par activité, par exemple). Une app qui harcèle finit désinstallée.

### 5. Le rappel de la veille

Le seul qui demande une vraie brique nouvelle : rien dans l'app ne s'exécute
tout seul. Il faut un **cron Vercel** qui appelle chaque matin une route
protégée, laquelle cherche les activités du lendemain et envoie.

- Coût : route handler + `vercel.json` + un secret partagé (`CRON_SECRET`) pour
  que la route ne soit pas déclenchable par n'importe qui.
- Migration : probablement oui — il faut se souvenir qu'un rappel est parti,
  sinon deux exécutions le renvoient. Une colonne `reminded_at` sur
  `activities` suffit.
- Attention : la route s'exécute **sans session**. Elle ne peut donc pas passer
  par les fonctions `security definer` actuelles, qui s'appuient sur
  `auth.uid()`. C'est le vrai travail de ce point.

## Ce que je ne ferais pas

- **Une notification par vote, par réponse ou par case cochée.** Quinze
  personnes qui votent, c'est quinze vibrations pour l'organisateur. Si le
  besoin se confirme, il vaut mieux un résumé quotidien qu'un flux.
- **Prévenir des changements de budget.** Un montant qui bouge se lit très bien
  à la prochaine ouverture.

Le principe : une notification sort **quand une décision tombe**, pas quand une
donnée change.

## Ordre suggéré

1, 3 puis 2 et 4 ensemble (ils partagent leur migration), et 5 seulement si le
besoin se fait sentir — c'est le seul qui ajoute de l'infrastructure à
entretenir.
