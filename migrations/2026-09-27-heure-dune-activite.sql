-- ============================================================
-- L'heure d'une activité
--
-- À exécuter d'un bloc sur une base déjà installée. Le contenu
-- est repris dans schema.sql pour les installations fraîches.
-- ============================================================

-- « Soirée le 29, à 20h » : l'heure vivait dans la description. Une seule
-- heure par activité, facultative, qui vaut pour tous les créneaux proposés —
-- le cas courant est « à 20h, mais quel jour ? ». Pour un séjour de plusieurs
-- jours, c'est l'heure du départ.
alter table activities
  add column if not exists start_time time;
