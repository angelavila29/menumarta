-- =====================================================================
-- Banco de recetas y amigos. Aplicar después de schema_menu.sql. Idempotente.
-- =====================================================================

-- Recetas de usuarios ---------------------------------------------------
alter table recipes add column if not exists owner_id uuid references profiles(id) on delete cascade; -- null = receta de Sobremesa
alter table recipes add column if not exists visibility text not null default 'public'
  check (visibility in ('private', 'friends', 'public'));
alter table recipes add column if not exists author_name text;
alter table recipes add column if not exists created_at timestamptz not null default now();

-- El nombre ya no es único global: cada persona puede tener sus "Lentejas"
alter table recipes drop constraint if exists recipes_name_key;
create unique index if not exists recipes_owner_name_key on recipes (owner_id, name) nulls not distinct;
create index if not exists recipes_owner_idx on recipes (owner_id);

-- Amistades ---------------------------------------------------------------
alter table profiles add column if not exists friend_code text unique
  default upper(substr(md5(gen_random_uuid()::text), 1, 8));

create table if not exists friendships (
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index if not exists friendships_addressee_idx on friendships (addressee_id);

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a))
  )
$$;

-- Mis amistades con nombre (profiles solo deja leer la fila propia)
create or replace function public.my_friendships()
returns table (other_id uuid, display_name text, status text, incoming boolean, recipes bigint)
language sql stable security definer set search_path = public as $$
  select o.id,
         coalesce(nullif(trim(o.display_name), ''), 'Alguien'),
         f.status,
         f.addressee_id = auth.uid(),
         (select count(*) from recipes r where r.owner_id = o.id and r.visibility in ('friends', 'public'))
  from friendships f
  join profiles o on o.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where auth.uid() in (f.requester_id, f.addressee_id)
$$;

-- Buscar a alguien por su código de invitación
create or replace function public.profile_by_friend_code(p_code text)
returns table (id uuid, display_name text)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(nullif(trim(p.display_name), ''), 'Alguien')
  from profiles p
  where auth.uid() is not null and p.friend_code = upper(trim(p_code))
$$;

revoke execute on function public.are_friends(uuid, uuid) from public, anon;
revoke execute on function public.my_friendships() from public, anon;
revoke execute on function public.profile_by_friend_code(text) from public, anon;
revoke execute on function public.ensure_supermarket(text, text) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.my_friendships() to authenticated;
grant execute on function public.profile_by_friend_code(text) to authenticated;
grant execute on function public.ensure_supermarket(text, text) to authenticated;

-- RLS -----------------------------------------------------------------------
alter table friendships enable row level security;

drop policy if exists "friendships ver" on friendships;
create policy "friendships ver" on friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
drop policy if exists "friendships pedir" on friendships;
create policy "friendships pedir" on friendships for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');
drop policy if exists "friendships aceptar" on friendships;
create policy "friendships aceptar" on friendships for update to authenticated
  using (addressee_id = (select auth.uid())) with check (addressee_id = (select auth.uid()));
drop policy if exists "friendships borrar" on friendships;
create policy "friendships borrar" on friendships for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- Recetas: se ven las de Sobremesa, las públicas, las mías y las de mis amigos
drop policy if exists "recipes lectura publica" on recipes;
drop policy if exists "recipes visibles" on recipes;
create policy "recipes visibles" on recipes for select to authenticated
  using (
    owner_id is null
    or visibility = 'public'
    or owner_id = (select auth.uid())
    or (visibility = 'friends' and public.are_friends(owner_id, (select auth.uid())))
  );
drop policy if exists "recipes crear" on recipes;
create policy "recipes crear" on recipes for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists "recipes editar" on recipes;
create policy "recipes editar" on recipes for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "recipes borrar" on recipes;
create policy "recipes borrar" on recipes for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Ingredientes: visibles si la receta lo es; editables si la receta es mía
drop policy if exists "recipe_ingredients lectura publica" on recipe_ingredients;
drop policy if exists "recipe_ingredients visibles" on recipe_ingredients;
create policy "recipe_ingredients visibles" on recipe_ingredients for select to authenticated
  using (exists (select 1 from recipes r where r.id = recipe_ingredients.recipe_id));
drop policy if exists "recipe_ingredients propios" on recipe_ingredients;
create policy "recipe_ingredients propios" on recipe_ingredients for all to authenticated
  using (exists (select 1 from recipes r where r.id = recipe_ingredients.recipe_id and r.owner_id = (select auth.uid())))
  with check (exists (select 1 from recipes r where r.id = recipe_ingredients.recipe_id and r.owner_id = (select auth.uid())));

-- Qué recetas de amigos entran al generar el menú: 'all' = todas, 'saved' = solo las guardadas
alter table profiles add column if not exists friend_recipes_mode text not null default 'all'
  check (friend_recipes_mode in ('all', 'saved'));
