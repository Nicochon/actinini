-- ============================================================
-- Les remboursements ne suivent plus ceux qui ont dit non
--
-- À exécuter d'un bloc sur une base déjà installée. Le contenu
-- est repris dans schema.sql pour les installations fraîches.
-- ============================================================

-- Avant : une ligne `payments` par invité, quoi qu'il ait répondu. Dix invités
-- dont trois avaient dit « je ne viens pas » donnaient dix cases à cocher, dont
-- trois pour un vol que personne ne prendra.
--
-- Le critère retenu est le **refus explicite**, pas la présence confirmée : un
-- invité qui n'a pas encore répondu garde sa ligne, parce qu'on ne sait pas
-- s'il vient. Adosser les remboursements aux votes ferait au contraire
-- apparaître et disparaître des lignes à chaque changement d'avis sur une date.

-- ----------------------------------------------------------
-- TRIGGER 2 — création d'un budget_item
-- ----------------------------------------------------------
create or replace function handle_new_budget_item()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.payment_mode = 'advance' then
    insert into payments (budget_item_id, profile_id)
    select new.id, ap.profile_id
    from activity_participants ap
    where ap.activity_id = new.activity_id
      and not ap.declined
    on conflict (budget_item_id, profile_id) do nothing;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------
-- TRIGGER 3 — changement de mode de paiement
-- ----------------------------------------------------------
create or replace function handle_budget_item_mode_change()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.payment_mode = 'advance' and old.payment_mode <> 'advance' then
    insert into payments (budget_item_id, profile_id)
    select new.id, ap.profile_id
    from activity_participants ap
    where ap.activity_id = new.activity_id
      and not ap.declined
    on conflict (budget_item_id, profile_id) do nothing;
  elsif new.payment_mode <> 'advance' and old.payment_mode = 'advance' then
    delete from payments where budget_item_id = new.id;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------
-- TRIGGER 4 — arrivée d'un participant
-- ----------------------------------------------------------
create or replace function handle_participant_added()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  -- Inviter quelqu'un qui a déjà décliné (réinvitation après un retrait) ne
  -- lui recrée pas de lignes : sa réponse tient toujours.
  if new.declined then
    return new;
  end if;

  insert into payments (budget_item_id, profile_id)
  select bi.id, new.profile_id
  from budget_items bi
  where bi.activity_id = new.activity_id
    and bi.payment_mode = 'advance'
  on conflict (budget_item_id, profile_id) do nothing;
  return new;
end;
$$;

-- ----------------------------------------------------------
-- TRIGGER 4 bis — réponse à l'invitation
-- Dire non retire ses lignes de remboursement, revenir sur son
-- refus les recrée.
-- ----------------------------------------------------------
create or replace function handle_participant_declined()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.declined then
    -- Une ligne déjà cochée n'est pas effacée : un remboursement constaté est
    -- un fait, pas une prévision. Elle reste visible, et c'est à l'organisateur
    -- de décider s'il rend l'argent.
    delete from payments p
    using budget_items bi
    where p.budget_item_id = bi.id
      and bi.activity_id = new.activity_id
      and p.profile_id = new.profile_id
      and not p.paid;
  else
    insert into payments (budget_item_id, profile_id)
    select bi.id, new.profile_id
    from budget_items bi
    where bi.activity_id = new.activity_id
      and bi.payment_mode = 'advance'
    on conflict (budget_item_id, profile_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_participant_declined on activity_participants;

create trigger on_participant_declined
  after update of declined on activity_participants
  for each row
  when (old.declined is distinct from new.declined)
  execute function handle_participant_declined();

-- Rattrapage : les lignes encore dues de ceux qui ont déjà décliné.
delete from payments p
using budget_items bi, activity_participants ap
where p.budget_item_id = bi.id
  and ap.activity_id = bi.activity_id
  and ap.profile_id = p.profile_id
  and ap.declined
  and not p.paid;
