-- ============================================================
-- Notifier un invité ajouté après la création
--
-- À exécuter d'un bloc sur une base déjà installée. Le contenu
-- est repris dans schema.sql pour les installations fraîches.
-- ============================================================

-- Avant : seule la création d'une activité prévenait ses invités. Quelqu'un
-- ajouté ensuite n'apprenait la sortie qu'en ouvrant l'app.
--
-- push_targets_for_activity() rend les appareils de tous les invités : s'en
-- servir ici notifierait une seconde fois ceux qui l'ont déjà été. Cette
-- variante ne vise qu'une personne, et seulement si elle est bien invitée à
-- une activité de l'appelant — l'organisateur ne peut pas s'en servir pour
-- joindre n'importe quel compte.
--
-- En `language sql` pour la même raison que push_targets_for_activity() :
-- une colonne de sortie `auth` masquerait le schéma `auth` en plpgsql.
create or replace function push_targets_for_participant(p_activity_id uuid, p_profile_id uuid)
returns table (endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select ps.endpoint, ps.p256dh, ps.auth
  from push_subscriptions ps
  join activity_participants ap on ap.profile_id = ps.profile_id
  where ap.activity_id = p_activity_id
    and ap.profile_id = p_profile_id
    and ps.profile_id <> auth.uid()
    -- Non-propriétaire : zéro ligne, pas d'erreur.
    and is_activity_owner(p_activity_id);
$$;
