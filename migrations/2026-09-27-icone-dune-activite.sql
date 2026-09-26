-- ============================================================
-- L'icône d'une activité
--
-- À exécuter d'un bloc sur une base déjà installée. Le contenu
-- est repris dans schema.sql pour les installations fraîches.
-- ============================================================

-- Une icône choisie à la création (avion pour un voyage, montagne pour une
-- rando…), qui suit l'activité dans la liste, le détail et le calendrier. La
-- clé renvoie à la bibliothèque de src/lib/activity-icons.ts.
--
-- Pas de contrainte `check` sur la liste des clés : ajouter une icône ne doit
-- pas demander de migration. Une clé inconnue s'affiche comme « autre ».
-- Les activités existantes prennent « autre » ; on les change à la main.
alter table activities
  add column if not exists icon text not null default 'autre';
