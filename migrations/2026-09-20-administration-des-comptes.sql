-- ============================================================
-- Administration des comptes — l'admin corrige les profils
--
-- À exécuter d'un bloc sur une base déjà installée. Le contenu
-- est repris dans schema.sql pour les installations fraîches.
-- ============================================================

-- L'admin du groupe modifie n'importe quel profil, pas seulement le sien.
--
-- Les colonnes atteignables restent celles du GRANT de schema.sql
-- (full_name, pseudo) : `is_admin` demeure hors de portée de l'app pour
-- tout le monde, l'admin compris. Se donner — ou donner à un autre — le
-- privilège d'administrateur passe toujours par le dashboard Supabase.
--
-- Le reste de la gestion d'un compte (email, mot de passe, création,
-- suppression) ne vit pas ici mais dans auth.users, que la RLS ne
-- gouverne pas. L'app y touche avec la clé secrète du projet, côté
-- serveur uniquement — voir src/lib/supabase/admin.ts.
drop policy if exists "profiles_update_admin" on profiles;

create policy "profiles_update_admin"
  on profiles for update to authenticated
  using (is_group_admin())
  with check (is_group_admin());
