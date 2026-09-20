-- ============================================================
-- Schéma Supabase — App de gestion d'activités entre amis
-- À exécuter d'un bloc dans l'éditeur SQL de Supabase
-- (installation fraîche, dans cet ordre).
--
-- Ordre du fichier :
--   1. Tables
--   2. Index
--   3. Fonctions utilitaires (helpers RLS)
--   4. Triggers
--   5. Row Level Security
-- ============================================================


-- ============================================================
-- 1. TABLES
-- ============================================================

-- ----------------------------------------------------------
-- 1.1 PROFILES
-- Complète auth.users avec les infos affichables.
-- Une ligne est créée automatiquement à la création d'un compte
-- (voir TRIGGER 1).
--
-- is_admin : le groupe a un seul administrateur (le créateur du
-- projet). Lui seul peut créer des activités. Ce flag n'est pas
-- modifiable par l'utilisateur (voir REVOKE plus bas) : il se
-- pose depuis le dashboard Supabase ou via la service_role key.
-- ----------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  pseudo text not null unique,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------
-- 1.2 ACTIVITIES
-- confirmed_date_option_id : le créneau retenu par l'admin.
-- Toujours null tant que le vote est en cours — la date gagnante
-- n'est jamais calculée automatiquement (validation manuelle).
-- ----------------------------------------------------------
create table activities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'voting'
    check (status in ('voting', 'confirmed', 'completed', 'cancelled')),
  confirmed_date_option_id uuid,  -- FK ajoutée après date_options (références croisées)
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------
-- 1.3 ACTIVITY_PARTICIPANTS
-- Qui est invité à quelle activité (sous-ensemble des profiles).
-- ----------------------------------------------------------
create table activity_participants (
  activity_id uuid not null references activities(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  invited_at timestamptz not null default now(),
  -- Refus explicite. Le « oui » se lit dans `votes` (un vote sur le créneau
  -- retenu vaut « je viens ») ; sans cette colonne, un « non » serait
  -- indistinguable d'une absence de réponse.
  declined boolean not null default false,
  primary key (activity_id, profile_id)
);

-- ----------------------------------------------------------
-- 1.4 DATE_OPTIONS
-- Les créneaux proposés pour une activité.
-- Un créneau est une plage de jours : end_date null = journée unique
-- ("soirée jeux samedi 14"), end_date renseignée = plage
-- ("ven 16 au dim 18 octobre"). Pas d'heure : les activités se
-- discutent à la journée, l'horaire précis va dans la description.
--
-- unique (id, activity_id) : cible de la clé étrangère composite
-- de votes, qui garantit qu'un vote et son créneau appartiennent
-- bien à la même activité.
-- ----------------------------------------------------------
create table date_options (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  constraint date_options_range_valid
    check (end_date is null or end_date >= start_date),
  unique (id, activity_id)
);

-- La date confirmée d'une activité doit être un de ses propres créneaux :
-- garanti par TRIGGER 5. On efface la référence si le créneau disparaît.
alter table activities
  add constraint activities_confirmed_date_option_fkey
  foreign key (confirmed_date_option_id)
  references date_options(id) on delete set null;

-- ----------------------------------------------------------
-- 1.5 VOTES
-- Une ligne = un participant a voté pour un créneau (toggle : insert/delete).
-- Un participant peut voter pour plusieurs créneaux.
-- ----------------------------------------------------------
create table votes (
  activity_id uuid not null references activities(id) on delete cascade,
  date_option_id uuid not null,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (date_option_id, profile_id),
  -- le créneau voté appartient forcément à l'activité du vote
  constraint votes_date_option_fkey
    foreign key (date_option_id, activity_id)
    references date_options(id, activity_id) on delete cascade
);

-- ----------------------------------------------------------
-- 1.6 BUDGET_ITEMS
-- Une ligne de budget par activité (ex: "vol", "logement"),
-- montant par personne. Le mode de paiement est par ligne.
-- ----------------------------------------------------------
create table budget_items (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  label text not null,
  amount_per_person numeric(10,2) not null check (amount_per_person >= 0),
  payment_mode text not null check (payment_mode in ('advance', 'on_site')),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------
-- 1.7 PAYMENTS
-- Suivi des remboursements. Jamais écrit directement par un
-- utilisateur : les lignes sont créées et supprimées par les
-- triggers 2, 3 et 4 (security definer).
-- ----------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  budget_item_id uuid not null references budget_items(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (budget_item_id, profile_id)
);


-- ----------------------------------------------------------
-- 1.8 PUSH_SUBSCRIPTIONS
-- Une ligne = un appareil abonné aux notifications. Un même profil
-- en a plusieurs (téléphone, tablette, navigateur de bureau) :
-- c'est l'endpoint, l'URL privée fournie par Apple ou Google, qui
-- identifie l'appareil, pas le profil.
--
-- Jamais écrite directement par un utilisateur : les lignes passent
-- par save_push_subscription() et forget_push_subscription()
-- (security definer), comme payments passe par ses triggers.
-- ----------------------------------------------------------
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);


-- ============================================================
-- 2. INDEX
-- Postgres n'indexe pas automatiquement les clés étrangères.
-- Ceux-ci couvrent les accès de l'app et les vérifications RLS.
-- ============================================================

create index activities_created_by_idx        on activities (created_by);
create index activity_participants_profile_idx on activity_participants (profile_id);
create index date_options_activity_idx        on date_options (activity_id);
create index votes_activity_idx               on votes (activity_id);
create index votes_profile_idx                on votes (profile_id);
create index budget_items_activity_idx        on budget_items (activity_id);
create index payments_budget_item_idx         on payments (budget_item_id);
create index payments_profile_idx             on payments (profile_id);
create index push_subscriptions_profile_idx    on push_subscriptions (profile_id);


-- ============================================================
-- 3. FONCTIONS UTILITAIRES (helpers RLS)
--
-- Indispensables : sans elles, les policies de `activities` et de
-- `activity_participants` s'appellent mutuellement et Postgres
-- échoue en "infinite recursion detected in policy". Étant
-- `security definer`, ces fonctions lisent les tables sans
-- repasser par la RLS et cassent le cycle.
-- ============================================================

-- L'utilisateur courant est-il l'administrateur du groupe ?
create function is_group_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce((select p.is_admin from profiles p where p.id = auth.uid()), false);
$$;

-- L'utilisateur courant est-il le créateur de cette activité ?
create function is_activity_owner(a_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from activities a
    where a.id = a_id and a.created_by = auth.uid()
  );
$$;

-- L'utilisateur courant est-il invité à cette activité ?
-- N'interroge que `activity_participants` : c'est ce qui permet de l'utiliser
-- dans la policy SELECT de `activities` sans auto-référence (voir plus bas).
create function is_activity_participant(a_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from activity_participants ap
    where ap.activity_id = a_id and ap.profile_id = auth.uid()
  );
$$;

-- L'utilisateur courant a-t-il accès à cette activité
-- (créateur OU invité) ? Pour les tables *rattachées* à une activité.
create function is_activity_member(a_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select is_activity_participant(a_id) or is_activity_owner(a_id);
$$;

-- Même question, à partir d'une ligne de budget (utilisé par payments).
create function is_budget_item_member(bi_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select is_activity_member((select bi.activity_id from budget_items bi where bi.id = bi_id));
$$;

create function is_budget_item_owner(bi_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select is_activity_owner((select bi.activity_id from budget_items bi where bi.id = bi_id));
$$;


-- ------------------------------------------------------------
-- Notifications push — écriture et lecture des abonnements.
--
-- Ces trois-là ne servent pas la RLS, elles la contournent
-- délibérément sur un périmètre étroit. Le raisonnement complet est
-- dans migrations/2026-09-17-notifications-push.sql.
-- ------------------------------------------------------------

-- Enregistre l'appareil courant. Le delete préalable traite le
-- téléphone qui change de mains : l'endpoint est déjà en base au nom
-- de l'ancien compte, et une policy UPDATE refuserait de le
-- réattribuer — le nouveau propriétaire ne recevrait jamais rien.
create function save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;

  delete from push_subscriptions where endpoint = p_endpoint;

  insert into push_subscriptions (profile_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth);
end;
$$;

-- Oublie un appareil. Deux appelants : l'utilisateur qui coupe ses
-- notifications, et le serveur quand Apple ou Google répond 404/410
-- (app désinstallée). Le second ne connaît pas le profil visé, d'où
-- le ciblage par endpoint seul.
create function forget_push_subscription(p_endpoint text)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;

  delete from push_subscriptions where endpoint = p_endpoint;
end;
$$;

-- Les appareils des invités d'une activité, rendus à son créateur
-- seul. C'est ce qui évite de donner la service_role key à l'app.
--
-- En `language sql` et non en plpgsql à dessein : une colonne de
-- sortie nommée `auth` deviendrait en plpgsql une variable qui
-- masquerait le schéma `auth`, et `auth.uid()` cesserait de
-- fonctionner dans le corps de la fonction.
create function push_targets_for_activity(p_activity_id uuid)
returns table (endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select ps.endpoint, ps.p256dh, ps.auth
  from push_subscriptions ps
  join activity_participants ap on ap.profile_id = ps.profile_id
  where ap.activity_id = p_activity_id
    and ps.profile_id <> auth.uid()
    -- Non-propriétaire : zéro ligne, pas d'erreur. L'envoi de
    -- notifications ne doit jamais faire échouer l'action en cours.
    and is_activity_owner(p_activity_id);
$$;


-- ============================================================
-- 4. TRIGGERS
-- ============================================================

-- ------------------------------------------------------------
-- TRIGGER 1 — création automatique du profil à l'inscription
-- Quand un compte est créé dans auth.users (par l'admin), une
-- ligne profiles correspondante est créée. full_name et pseudo
-- sont lus depuis raw_user_meta_data ; à défaut, on retombe sur
-- la partie gauche de l'email plutôt que sur un nom vide.
-- is_admin n'est jamais posé ici : il se met à la main sur le
-- seul compte administrateur.
-- ------------------------------------------------------------
create function handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  base   text;
  handle text;
  n      int := 0;
begin
  -- Repli quand les métadonnées sont absentes : la partie gauche de l'email.
  -- Un compte créé sans full_name ni pseudo reste ainsi identifiable dans la
  -- liste d'invitation, au lieu d'y apparaître sous une pastille vide.
  base := nullif(split_part(coalesce(new.email, ''), '@', 1), '');

  handle := nullif(new.raw_user_meta_data ->> 'pseudo', '');
  if handle is null then
    -- `pseudo` est unique : on suffixe tant qu'il est pris plutôt que de
    -- faire échouer la création du compte sur un homonyme d'email.
    handle := coalesce(base, new.id::text);
    while exists (select 1 from profiles p where p.pseudo = handle) loop
      n := n + 1;
      handle := coalesce(base, new.id::text) || n::text;
    end loop;
  end if;

  insert into profiles (id, full_name, pseudo)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), base, ''),
    handle
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ------------------------------------------------------------
-- TRIGGER 2 — lignes payments à la création d'un budget_item
-- Un budget_item en mode 'advance' génère une ligne payments
-- (paid = false) pour chaque participant déjà invité.
-- ------------------------------------------------------------
create function handle_new_budget_item()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.payment_mode = 'advance' then
    insert into payments (budget_item_id, profile_id)
    select new.id, ap.profile_id
    from activity_participants ap
    where ap.activity_id = new.activity_id
    on conflict (budget_item_id, profile_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_budget_item_created
  after insert on budget_items
  for each row execute function handle_new_budget_item();

-- ------------------------------------------------------------
-- TRIGGER 3 — changement de mode de paiement d'un budget_item
-- on_site -> advance : on génère les lignes manquantes.
-- advance -> on_site : plus de remboursement à suivre, on efface.
-- ------------------------------------------------------------
create function handle_budget_item_mode_change()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.payment_mode = 'advance' and old.payment_mode <> 'advance' then
    insert into payments (budget_item_id, profile_id)
    select new.id, ap.profile_id
    from activity_participants ap
    where ap.activity_id = new.activity_id
    on conflict (budget_item_id, profile_id) do nothing;
  elsif new.payment_mode <> 'advance' and old.payment_mode = 'advance' then
    delete from payments where budget_item_id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_budget_item_mode_changed
  after update of payment_mode on budget_items
  for each row
  when (old.payment_mode is distinct from new.payment_mode)
  execute function handle_budget_item_mode_change();

-- ------------------------------------------------------------
-- TRIGGER 4 — arrivée / départ d'un participant
-- À l'ajout : on rattrape les lignes payments des budget_items
-- 'advance' déjà créés (sinon le participant ajouté après coup
-- n'apparaît nulle part dans le suivi des remboursements).
-- Au retrait : on efface ses lignes payments et ses votes sur
-- cette activité.
-- ------------------------------------------------------------
create function handle_participant_added()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into payments (budget_item_id, profile_id)
  select bi.id, new.profile_id
  from budget_items bi
  where bi.activity_id = new.activity_id
    and bi.payment_mode = 'advance'
  on conflict (budget_item_id, profile_id) do nothing;
  return new;
end;
$$;

create trigger on_participant_added
  after insert on activity_participants
  for each row execute function handle_participant_added();

create function handle_participant_removed()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  delete from payments p
  using budget_items bi
  where p.budget_item_id = bi.id
    and bi.activity_id = old.activity_id
    and p.profile_id = old.profile_id;

  delete from votes v
  where v.activity_id = old.activity_id
    and v.profile_id = old.profile_id;

  return old;
end;
$$;

create trigger on_participant_removed
  after delete on activity_participants
  for each row execute function handle_participant_removed();

-- ------------------------------------------------------------
-- TRIGGER 5 — cohérence de la date confirmée
-- Le créneau retenu doit appartenir à l'activité qu'il confirme.
-- ------------------------------------------------------------
create function check_confirmed_date_option()
returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if new.confirmed_date_option_id is not null
     and not exists (
       select 1 from date_options d
       where d.id = new.confirmed_date_option_id
         and d.activity_id = new.id
     ) then
    raise exception 'Le créneau confirmé n''appartient pas à cette activité';
  end if;
  return new;
end;
$$;

create trigger on_activity_confirmed_date
  before insert or update of confirmed_date_option_id on activities
  for each row execute function check_confirmed_date_option();

-- ------------------------------------------------------------
-- TRIGGER 6 — horodatage paid_at
-- paid_at suit toujours l'état de paid, sans que l'app ait à
-- envoyer les deux champs.
-- ------------------------------------------------------------
create function sync_payment_paid_at()
returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if new.paid and not old.paid then
    new.paid_at := now();
  elsif not new.paid then
    new.paid_at := null;
  end if;
  return new;
end;
$$;

create trigger on_payment_paid_changed
  before update of paid on payments
  for each row execute function sync_payment_paid_at();

-- ------------------------------------------------------------
-- TRIGGER 7 — updated_at
-- Les colonnes updated_at existaient mais rien ne les mettait à jour.
-- ------------------------------------------------------------
create function set_updated_at()
returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger activities_set_updated_at
  before update on activities
  for each row execute function set_updated_at();


-- ============================================================
-- 5. ROW LEVEL SECURITY
-- Principe général :
--   - un participant ne voit que les activités où il est invité
--   - seul l'administrateur du groupe crée des activités
--   - seul le créateur d'une activité la modifie, gère ses
--     participants, ses dates, son budget, et coche les paiements
--   - un participant vote/dévote pour lui-même uniquement
--   - chacun modifie son propre profil
--
-- Toutes les policies sont réservées au rôle `authenticated` :
-- le rôle `anon` n'a accès à rien.
-- ============================================================

alter table profiles enable row level security;
alter table activities enable row level security;
alter table activity_participants enable row level security;
alter table date_options enable row level security;
alter table votes enable row level security;
alter table budget_items enable row level security;
alter table payments enable row level security;
alter table push_subscriptions enable row level security;

-- --- PROFILES ---
-- Tout le monde dans le groupe voit les profils (les noms sont
-- affichés partout : votants, participants, remboursements).
create policy "profiles_select_all"
  on profiles for select to authenticated
  using (true);

-- Chacun modifie uniquement son propre profil.
-- Le with check empêche de réassigner la ligne à quelqu'un d'autre.
create policy "profiles_update_own"
  on profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- L'admin du groupe modifie aussi les profils des autres : c'est lui
-- qui crée les comptes, donc lui qui rattrape un nom mal saisi. Les
-- colonnes atteignables restent celles du GRANT ci-dessous.
create policy "profiles_update_admin"
  on profiles for update to authenticated
  using (is_group_admin())
  with check (is_group_admin());

-- Colonnes non modifiables par l'utilisateur, quelle que soit la
-- policy : une élévation en admin passe forcément par le dashboard
-- Supabase ou la service_role key.
-- Le droit UPDATE est retiré au niveau table puis re-accordé colonne
-- par colonne : un revoke sur colonnes seules resterait sans effet
-- tant qu'un grant table couvre tout.
revoke update on profiles from authenticated;
grant update (full_name, pseudo) on profiles to authenticated;

-- --- ACTIVITIES ---
-- Voir : en être le créateur ou y être invité.
--
-- La condition sur le créateur lit directement la colonne `created_by` au lieu
-- de passer par is_activity_owner(). C'est délibéré : une policy SELECT qui
-- re-interroge sa propre table ne voit pas la ligne en cours d'insertion, et
-- tout `insert ... returning` (le `.insert().select()` de supabase-js) échouerait
-- alors en 42501 alors même que l'écriture est autorisée.
create policy "activities_select_member"
  on activities for select to authenticated
  using (created_by = auth.uid() or is_activity_participant(id));

-- Créer : réservé à l'administrateur du groupe, et pour lui-même.
create policy "activities_insert_admin"
  on activities for insert to authenticated
  with check (created_by = auth.uid() and is_group_admin());

-- Modifier / supprimer : uniquement le créateur.
-- Le with check interdit de transférer l'activité à un autre compte.
create policy "activities_update_owner"
  on activities for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "activities_delete_owner"
  on activities for delete to authenticated
  using (created_by = auth.uid());

-- --- ACTIVITY_PARTICIPANTS ---
-- Voir la liste complète des invités : créateur ou participant.
create policy "participants_select_member"
  on activity_participants for select to authenticated
  using (is_activity_member(activity_id));

-- Ajouter / retirer : uniquement le créateur de l'activité.
create policy "participants_insert_owner"
  on activity_participants for insert to authenticated
  with check (is_activity_owner(activity_id));

create policy "participants_delete_owner"
  on activity_participants for delete to authenticated
  using (is_activity_owner(activity_id));

-- Répondre à l'invitation : chacun pour lui-même, et seule la colonne
-- `declined` est atteignable (le grant est posé juste en dessous).
create policy "participants_update_self"
  on activity_participants for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

revoke update on activity_participants from authenticated;
grant update (declined) on activity_participants to authenticated;

-- --- DATE_OPTIONS ---
create policy "date_options_select_member"
  on date_options for select to authenticated
  using (is_activity_member(activity_id));

create policy "date_options_insert_owner"
  on date_options for insert to authenticated
  with check (is_activity_owner(activity_id));

create policy "date_options_update_owner"
  on date_options for update to authenticated
  using (is_activity_owner(activity_id))
  with check (is_activity_owner(activity_id));

create policy "date_options_delete_owner"
  on date_options for delete to authenticated
  using (is_activity_owner(activity_id));

-- --- VOTES ---
-- Voir les votes : créateur ou participant de l'activité
-- (les noms des votants sont affichés sous chaque créneau).
create policy "votes_select_member"
  on votes for select to authenticated
  using (is_activity_member(activity_id));

-- Voter : uniquement pour soi-même, et uniquement si on est invité.
-- (is_activity_member couvre aussi le créateur, qui vote s'il
-- s'est invité à sa propre activité.)
create policy "votes_insert_self"
  on votes for insert to authenticated
  with check (profile_id = auth.uid() and is_activity_member(activity_id));

-- Dévoter (toggle) : uniquement son propre vote.
create policy "votes_delete_self"
  on votes for delete to authenticated
  using (profile_id = auth.uid());

-- --- BUDGET_ITEMS ---
create policy "budget_items_select_member"
  on budget_items for select to authenticated
  using (is_activity_member(activity_id));

create policy "budget_items_insert_owner"
  on budget_items for insert to authenticated
  with check (is_activity_owner(activity_id));

create policy "budget_items_update_owner"
  on budget_items for update to authenticated
  using (is_activity_owner(activity_id))
  with check (is_activity_owner(activity_id));

create policy "budget_items_delete_owner"
  on budget_items for delete to authenticated
  using (is_activity_owner(activity_id));

-- --- PAYMENTS ---
-- Visible par tous les participants de l'activité concernée
-- (transparence assumée).
create policy "payments_select_member"
  on payments for select to authenticated
  using (is_budget_item_member(budget_item_id));

-- Cocher un paiement comme reçu : uniquement le créateur de
-- l'activité (c'est lui qui avance l'argent et constate le
-- remboursement). Le with check empêche de déplacer la ligne
-- vers un autre participant ou un autre budget_item.
create policy "payments_update_owner"
  on payments for update to authenticated
  using (is_budget_item_owner(budget_item_id))
  with check (is_budget_item_owner(budget_item_id));

-- Pas de policy insert ni delete : les lignes payments sont gérées
-- uniquement par les triggers (security definer), jamais
-- directement par un utilisateur.


-- --- PUSH_SUBSCRIPTIONS ---
-- Chacun ne voit que ses propres appareils : de quoi s'envoyer une
-- notification de test. L'envoi aux autres passe par
-- push_targets_for_activity().
--
-- Pas de policy insert, update ni delete : l'écriture se fait
-- uniquement par save_push_subscription() et
-- forget_push_subscription().
create policy "push_subscriptions_select_own"
  on push_subscriptions for select to authenticated
  using (profile_id = auth.uid());
