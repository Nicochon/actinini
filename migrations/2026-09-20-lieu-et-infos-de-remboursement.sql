-- ============================================================
-- Le lieu d'une activité, et comment rembourser quelqu'un
--
-- À exécuter d'un bloc sur une base déjà installée. Le contenu
-- est repris dans schema.sql pour les installations fraîches.
-- ============================================================

-- ----------------------------------------------------------
-- 1. LIEU
-- Pour une sortie, « où » pèse autant que « quand ». Le lieu
-- vivait dans la description, mélangé au reste.
-- ----------------------------------------------------------
alter table activities
  add column if not exists location text;

-- ----------------------------------------------------------
-- 2. COMMENT ME REMBOURSER
-- Texte libre plutôt qu'un IBAN structuré : Wero, Lydia, PayPal
-- et le virement n'ont pas la même forme, et un champ « IBAN »
-- donnerait l'illusion d'une validation qu'on ne fait pas.
--
-- L'information est lisible par tout le groupe — c'est son but,
-- et la page le dit —, mais elle n'est modifiable que par son
-- propriétaire : elle désigne un compte où part de l'argent.
-- ----------------------------------------------------------
alter table profiles
  add column if not exists payment_info text;

grant update (payment_info) on profiles to authenticated;

-- L'admin peut corriger le nom et le pseudo de n'importe qui
-- (policy `profiles_update_admin`). Pas ceci : le privilège de
-- rediriger un virement ne se donne pas par commodité.
create or replace function check_payment_info_owner()
returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  -- auth.uid() est null hors session (dashboard, clé secrète) : la
  -- comparaison rend null, la condition est fausse, et l'écriture passe.
  -- C'est la porte de service assumée, la même que pour `is_admin`.
  if new.payment_info is distinct from old.payment_info
     and new.id <> auth.uid() then
    raise exception 'Les informations de remboursement ne se modifient que par leur propriétaire';
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_payment_info on profiles;

create trigger on_profile_payment_info
  before update of payment_info on profiles
  for each row execute function check_payment_info_owner();
