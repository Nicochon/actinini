-- ============================================================
-- Un seul créneau proposé : il est retenu d'office
--
-- À exécuter d'un bloc sur une base déjà installée. Le contenu
-- est repris dans schema.sql pour les installations fraîches.
-- ============================================================

-- Avant : une sortie à date unique restait « en vote » jusqu'à ce que l'admin
-- clique « Confirmer cette date » — alors qu'il n'y avait rien à trancher. La
-- liste n'affichait aucune date, le calendrier la donnait en pointillé, et le
-- bouton demandait de valider une évidence.
--
-- L'invariant est tenu en base plutôt qu'à l'affichage : ainsi la liste, le
-- calendrier, le badge de statut et la page de détail lisent tous la même
-- vérité, sans cas particulier.
create or replace function confirm_lone_date_option()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  target uuid := coalesce(new.activity_id, old.activity_id);
  total  int;
  lone   uuid;
begin
  select count(*) into total from date_options where activity_id = target;

  if total = 1 then
    select id into lone from date_options where activity_id = target;

    update activities
       set confirmed_date_option_id = lone,
           -- Une activité passée ou annulée garde son statut : seule une
           -- activité encore en vote devient « confirmée ».
           status = case when status = 'voting' then 'confirmed' else status end
     where id = target
       and (confirmed_date_option_id is distinct from lone or status = 'voting');

  elsif tg_op = 'INSERT' and total = 2 then
    -- Un deuxième créneau apparaît : la validation d'office n'était pas une
    -- décision, elle s'annule et le choix se rouvre. Au-delà de deux créneaux,
    -- la date retenue a été choisie à la main — on n'y touche pas.
    --
    -- Le garde porte sur la date retenue, pas sur le statut : celui-ci arrive
    -- du formulaire d'édition et peut être en retard d'un coup sur la base.
    -- Une activité passée ou annulée, elle, ne se rouvre pas.
    update activities
       set confirmed_date_option_id = null,
           status = case when status = 'confirmed' then 'voting' else status end
     where id = target
       and confirmed_date_option_id is not null
       and status in ('voting', 'confirmed');
  end if;

  return null;
end;
$$;

drop trigger if exists on_date_option_change on date_options;

create trigger on_date_option_change
  after insert or delete on date_options
  for each row execute function confirm_lone_date_option();

-- Rattrapage des activités déjà créées à date unique.
update activities a
   set confirmed_date_option_id = d.id,
       status = case when a.status = 'voting' then 'confirmed' else a.status end
  from date_options d
 where d.activity_id = a.id
   and a.confirmed_date_option_id is null
   and (select count(*) from date_options x where x.activity_id = a.id) = 1;
