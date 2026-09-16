-- ============================================================
-- Notifications push — abonnements des appareils
--
-- À exécuter sur une base déjà installée. Le contenu est repris
-- dans schema.sql pour les installations fraîches.
-- ============================================================

-- ----------------------------------------------------------
-- TABLE
-- Une ligne = un appareil abonné. Un même profil en a plusieurs
-- (téléphone, tablette, navigateur de bureau) : c'est l'endpoint,
-- l'URL privée fournie par Apple ou Google, qui identifie
-- l'appareil, pas le profil.
--
-- Aucune policy d'écriture : la table se remplit uniquement via
-- save_push_subscription() et forget_push_subscription(), comme
-- payments se remplit via ses triggers. La raison est en dessous.
-- ----------------------------------------------------------
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_profile_idx on push_subscriptions (profile_id);

alter table push_subscriptions enable row level security;

-- Lecture : chacun ne voit que ses propres appareils. Suffisant pour
-- s'envoyer une notification de test ; l'envoi aux autres passe par
-- push_targets_for_activity().
create policy "push_subscriptions_select_own"
  on push_subscriptions for select to authenticated
  using (profile_id = auth.uid());

-- ----------------------------------------------------------
-- ENREGISTREMENT D'UN APPAREIL
--
-- Le delete préalable traite le cas du téléphone qui change de
-- mains : l'endpoint est déjà en base au nom de l'ancien compte, et
-- une policy UPDATE classique refuserait de le réattribuer — le
-- nouveau propriétaire ne recevrait jamais rien, sans message
-- d'erreur. `security definer` est là uniquement pour ça.
-- ----------------------------------------------------------
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

-- ----------------------------------------------------------
-- OUBLI D'UN APPAREIL
--
-- Deux appelants : l'utilisateur qui coupe ses notifications, et le
-- serveur quand Apple ou Google répond 404/410 (app désinstallée,
-- abonnement expiré). Le second ne connaît pas toujours le profil
-- visé, d'où le ciblage par endpoint seul.
--
-- Le risque assumé : quelqu'un qui connaîtrait l'endpoint d'un autre
-- pourrait le désabonner. Un endpoint est une URL secrète de 150
-- caractères qui n'est jamais affichée, et la nuisance se limite à
-- ne plus recevoir de notifications — à remettre en regard d'une
-- table qui se remplirait d'appareils morts.
-- ----------------------------------------------------------
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

-- ----------------------------------------------------------
-- DESTINATAIRES D'UNE ACTIVITÉ
--
-- Rend les appareils des invités d'une activité, à son créateur
-- seul. C'est ce qui évite d'avoir à donner la service_role key à
-- l'app : sans cette fonction, l'organisateur ne peut pas lire les
-- abonnements des autres (et c'est bien ainsi), donc ne peut rien
-- leur envoyer.
--
-- Écrite en `language sql` et non en plpgsql à dessein : une colonne
-- de sortie nommée `auth` deviendrait, en plpgsql, une variable qui
-- masquerait le schéma `auth` — et `auth.uid()` cesserait de
-- fonctionner à l'intérieur de la fonction.
--
-- Le créateur est exclu : il vient de créer l'activité, il n'a pas
-- besoin qu'on le prévienne.
-- ----------------------------------------------------------
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
