-- =====================================================================
-- Histórico de precios, hábitos, fotos de recetas y lista compartida. Idempotente.
-- =====================================================================

-- Histórico: productos cuyo precio ha cambiado en los últimos días -------
create or replace function public.price_changes(p_chains text[], p_days int default 30)
returns table (product_id bigint, first_price numeric, last_price numeric, first_date date, last_date date, pct numeric)
language sql stable set search_path = public as $$
  with h as (
    select ph.product_id, ph.price, ph.captured_at
    from price_history ph join products p on p.id = ph.product_id
    where p.supermarket_id = any(p_chains) and ph.captured_at >= current_date - p_days and ph.price is not null and ph.price > 0
  ),
  f as (select distinct on (product_id) product_id, price, captured_at from h order by product_id, captured_at asc),
  l as (select distinct on (product_id) product_id, price, captured_at from h order by product_id, captured_at desc)
  select f.product_id, f.price, l.price, f.captured_at, l.captured_at, round((l.price - f.price) / f.price * 100, 1)
  from f join l using (product_id)
  where f.price <> l.price
$$;
grant execute on function public.price_changes(text[], int) to authenticated;

-- Hábitos: marcar un plato como cocinado ---------------------------------
alter table weekly_menu_slots add column if not exists cooked boolean not null default false;

-- Fotos de recetas (Supabase Storage, bucket público de solo lectura) -----
alter table recipes add column if not exists photo_url text;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-photos', 'recipe-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "recipe-photos subir" on storage.objects;
create policy "recipe-photos subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "recipe-photos borrar" on storage.objects;
create policy "recipe-photos borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Lista compartida (piso compartido) --------------------------------------
create table if not exists list_members (
  list_id   uuid not null references shopping_lists(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (list_id, user_id)
);
create index if not exists list_members_user_idx on list_members (user_id);
alter table list_members enable row level security;

-- Funciones security definer para que las políticas no se llamen en círculo
create or replace function public.is_list_owner(p_list uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from shopping_lists l where l.id = p_list and l.user_id = auth.uid())
$$;
create or replace function public.is_list_member(p_list uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from list_members m where m.list_id = p_list and m.user_id = auth.uid())
$$;
-- Quién comparte una lista conmigo, con nombre
create or replace function public.list_people(p_list uuid)
returns table (user_id uuid, display_name text, is_owner boolean)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(nullif(trim(p.display_name), ''), 'Alguien'), p.id = l.user_id
  from shopping_lists l
  join profiles p on p.id = l.user_id or p.id in (select m.user_id from list_members m where m.list_id = l.id)
  where l.id = p_list and (l.user_id = auth.uid() or exists (select 1 from list_members m where m.list_id = l.id and m.user_id = auth.uid()))
$$;
revoke execute on function public.is_list_owner(uuid) from public, anon;
revoke execute on function public.is_list_member(uuid) from public, anon;
revoke execute on function public.list_people(uuid) from public, anon;
grant execute on function public.is_list_owner(uuid) to authenticated;
grant execute on function public.is_list_member(uuid) to authenticated;
grant execute on function public.list_people(uuid) to authenticated;

drop policy if exists "list_members ver" on list_members;
create policy "list_members ver" on list_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_list_owner(list_id));
-- Solo el dueño invita, y solo a sus amigos
drop policy if exists "list_members invitar" on list_members;
create policy "list_members invitar" on list_members for insert to authenticated
  with check (public.is_list_owner(list_id) and public.are_friends(user_id, (select auth.uid())));
-- El dueño expulsa; cada miembro puede salirse
drop policy if exists "list_members salir" on list_members;
create policy "list_members salir" on list_members for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_list_owner(list_id));

drop policy if exists "shopping_lists propio" on shopping_lists;
create policy "shopping_lists propio" on shopping_lists for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "shopping_lists compartida" on shopping_lists;
create policy "shopping_lists compartida" on shopping_lists for select to authenticated
  using (public.is_list_member(id));

drop policy if exists "shopping_list_items propio" on shopping_list_items;
create policy "shopping_list_items propio" on shopping_list_items for all to authenticated
  using (public.is_list_owner(list_id) or public.is_list_member(list_id))
  with check (public.is_list_owner(list_id) or public.is_list_member(list_id));
