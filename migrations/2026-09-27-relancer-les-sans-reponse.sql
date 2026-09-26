-- ============================================================
-- Relancer les invités qui n'ont pas répondu
--
-- À exécuter d'un bloc sur une base déjà installée. Le contenu
-- est repris dans schema.sql pour les installations fraîches.
-- ============================================================

-- L'organisateur peut relancer d'un bouton ceux dont il attend encore une
-- réponse. Cette colonne retient la dernière relance : elle sert de garde-fou
-- (une relance toutes les 12 h au plus, voir src/lib/reminders.ts) et
-- s'affiche sous le bouton. Une app qui harcèle finit désinstallée.
--
-- Pas de nouvelle fonction : l'envoi réutilise push_targets_for_participant(),
-- une personne à la fois, pour ne toucher que ceux qui n'ont pas répondu.
alter table activities
  add column if not exists reminded_at timestamptz;
