-- Repli sur l'email quand un compte est créé sans métadonnées.
--
-- À exécuter d'un bloc dans l'éditeur SQL de Supabase, sur une base déjà
-- installée. Une base neuve reçoit déjà cette version par schema.sql.
--
-- Avant : un compte créé sans full_name ni pseudo dans les user metadata
-- obtenait un nom vide et un UUID en guise de pseudo — invisible dans la
-- liste d'invitation. Après : la partie gauche de l'email sert de repli,
-- suffixée d'un chiffre si ce pseudo est déjà pris.
--
-- Ne touche pas aux comptes existants : voir la requête de rattrapage en
-- fin de fichier pour ceux-là.

create or replace function handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  base   text;
  handle text;
  n      int := 0;
begin
  -- Repli quand les métadonnées sont absentes : la partie gauche de l'email.
  -- Un compte créé sans full_name ni pseudo reste ainsi identifiable dans la
  -- liste d'invitation, au lieu d'y apparaître sous une pastille vide.
  base := nullif(split_part(coalesce(new.email, ''), '@', 1), '');

  handle := nullif(new.raw_user_meta_data ->> 'pseudo', '');
  if handle is null then
    -- `pseudo` est unique : on suffixe tant qu'il est pris plutôt que de
    -- faire échouer la création du compte sur un homonyme d'email.
    handle := coalesce(base, new.id::text);
    while exists (select 1 from profiles p where p.pseudo = handle) loop
      n := n + 1;
      handle := coalesce(base, new.id::text) || n::text;
    end loop;
  end if;

  insert into profiles (id, full_name, pseudo)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), base, ''),
    handle
  );
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Rattrapage des comptes déjà créés sans métadonnées.
-- Les lister d'abord :
--
--   select u.email, p.full_name, p.pseudo
--   from profiles p join auth.users u on u.id = p.id
--   where p.full_name = '' or p.pseudo = p.id::text;
--
-- Puis, pour leur donner leur vrai nom (le pseudo doit rester unique) :
--
--   update profiles set full_name = 'Prénom Nom', pseudo = 'prenom'
--   where id = (select id from auth.users where email = 'x@exemple.fr');
