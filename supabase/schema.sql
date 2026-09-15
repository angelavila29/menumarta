-- =====================================================================
-- Esquema de la app "Compra" (menú semanal + lista de la compra)
-- Pegar entero en Supabase → SQL Editor → Run. Es idempotente.
-- =====================================================================

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- Datos públicos (precios)
-- ---------------------------------------------------------------------
create table if not exists supermarkets (
  id   text primary key,          -- 'mercadona', 'dia'
  name text not null
);

create table if not exists products (
  id             bigserial primary key,
  supermarket_id text not null references supermarkets(id),
  external_id    text not null,   -- id del producto en la cadena
  name           text not null,
  brand          text,
  category       text,
  price          numeric,         -- precio del envase (€)
  unit_price     numeric,         -- €/kg, €/L o €/ud
  unit           text,            -- 'kg', 'l', 'ud'
  pack_size      text,            -- ej. '1 L', '6 ud', '500 g'
  image_url      text,
  product_url    text,
  zone           text not null default '',  -- ej. 'mad1'
  updated_at     timestamptz not null default now(),
  unique (supermarket_id, external_id, zone)
);

create index if not exists products_name_trgm_idx
  on products using gin (name gin_trgm_ops);
create index if not exists products_supermarket_zone_idx
  on products (supermarket_id, zone);
create index if not exists products_unit_price_idx
  on products (unit_price);

create table if not exists price_history (
  product_id  bigint not null references products(id) on delete cascade,
  price       numeric,
  unit_price  numeric,
  captured_at date not null default current_date,
  primary key (product_id, captured_at)
);

-- ---------------------------------------------------------------------
-- Datos por usuario
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  postal_code text,
  created_at  timestamptz not null default now()
);

create table if not exists user_supermarkets (
  user_id        uuid not null references profiles(id) on delete cascade,
  supermarket_id text not null references supermarkets(id),
  primary key (user_id, supermarket_id)
);

create table if not exists favorites (
  user_id    uuid   not null references profiles(id) on delete cascade,
  product_id bigint not null references products(id) on delete cascade,
  primary key (user_id, product_id)
);

create table if not exists shopping_lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  name       text not null default 'Mi lista',
  created_at timestamptz not null default now()
);

create table if not exists shopping_list_items (
  id         bigserial primary key,
  list_id    uuid   not null references shopping_lists(id) on delete cascade,
  product_id bigint not null references products(id) on delete cascade,
  quantity   numeric not null default 1,
  checked    boolean not null default false
);

create index if not exists shopping_list_items_list_idx on shopping_list_items (list_id);

-- ---------------------------------------------------------------------
-- Crear el perfil automáticamente al registrarse un usuario
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table supermarkets        enable row level security;
alter table products            enable row level security;
alter table price_history       enable row level security;
alter table profiles            enable row level security;
alter table user_supermarkets   enable row level security;
alter table favorites           enable row level security;
alter table shopping_lists      enable row level security;
alter table shopping_list_items enable row level security;

-- Públicas: lectura para todos; escritura solo service_role (que salta RLS).
drop policy if exists "supermarkets lectura publica" on supermarkets;
create policy "supermarkets lectura publica" on supermarkets
  for select using (true);

drop policy if exists "products lectura publica" on products;
create policy "products lectura publica" on products
  for select using (true);

drop policy if exists "price_history lectura publica" on price_history;
create policy "price_history lectura publica" on price_history
  for select using (true);

-- profiles: cada usuario solo lo suyo
drop policy if exists "profiles propio" on profiles;
create policy "profiles propio" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- user_supermarkets
drop policy if exists "user_supermarkets propio" on user_supermarkets;
create policy "user_supermarkets propio" on user_supermarkets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- favorites
drop policy if exists "favorites propio" on favorites;
create policy "favorites propio" on favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- shopping_lists
drop policy if exists "shopping_lists propio" on shopping_lists;
create policy "shopping_lists propio" on shopping_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- shopping_list_items: a través de la lista
drop policy if exists "shopping_list_items propio" on shopping_list_items;
create policy "shopping_list_items propio" on shopping_list_items
  for all
  using (exists (
    select 1 from shopping_lists l
    where l.id = shopping_list_items.list_id and l.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from shopping_lists l
    where l.id = shopping_list_items.list_id and l.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------
-- Datos semilla
-- ---------------------------------------------------------------------
insert into supermarkets (id, name) values
  ('mercadona', 'Mercadona'),
  ('dia', 'Dia')
on conflict (id) do update set name = excluded.name;

-- ---------------------------------------------------------------------
-- Búsqueda sin tildes: columna generada name_norm (minúsculas, sin acentos)
-- ---------------------------------------------------------------------
create extension if not exists unaccent;

create or replace function public.immutable_unaccent(text)
returns text language sql immutable parallel safe strict as $$
  select public.unaccent('public.unaccent', $1)
$$;

alter table products
  add column if not exists name_norm text
  generated always as (public.immutable_unaccent(lower(name))) stored;

create index if not exists products_name_norm_trgm_idx
  on products using gin (name_norm gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Ofertas (opencesta marca is_discounted; hoy solo Dia lo trae)
-- ---------------------------------------------------------------------
alter table products add column if not exists is_discounted boolean not null default false;
create index if not exists products_discounted_idx on products (supermarket_id) where is_discounted;
