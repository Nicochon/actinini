-- ============================================================
-- « Je ne viens pas » — un invité peut décliner explicitement
--
-- À exécuter d'un bloc sur une base déjà installée. Le contenu
-- est repris dans schema.sql pour les installations fraîches.
-- ============================================================

-- Avant : un invité n'avait que deux états, « a voté sur le créneau retenu »
-- (donc vient) ou rien. Celui qui ne venait pas restait indistinguable de
-- celui qui n'avait pas encore ouvert l'app. Cette colonne porte le refus.
alter table activity_participants
  add column if not exists declined boolean not null default false;

-- Chacun répond pour lui-même, et seulement pour lui-même.
drop policy if exists "participants_update_self" on activity_participants;

create policy "participants_update_self"
  on activity_participants for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Seule `declined` est modifiable : la composition de la liste reste au
-- créateur, qui l'écrit par insert et delete. Le droit UPDATE est retiré au
-- niveau table puis re-accordé colonne par colonne — un revoke sur colonnes
-- seules resterait sans effet tant qu'un grant table couvre tout.
revoke update on activity_participants from authenticated;
grant update (declined) on activity_participants to authenticated;
