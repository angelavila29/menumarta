-- =====================================================================
-- Despensa y básicos recurrentes. Idempotente.
-- =====================================================================

-- Ingredientes que ya tengo en casa: no se compran al crear la lista del menú
create table if not exists pantry_items (
  user_id         uuid not null references profiles(id) on delete cascade,
  ingredient_name text not null,
  created_at      timestamptz not null default now(),
  primary key (user_id, ingredient_name)
);

-- Productos que compro cada semana (leche, pan, café, papel...): entran solos en la lista
create table if not exists staple_items (
  user_id    uuid    not null references profiles(id) on delete cascade,
  product_id bigint  not null references products(id) on delete cascade,
  quantity   numeric not null default 1,
  primary key (user_id, product_id)
);
create index if not exists staple_items_product_idx on staple_items (product_id);

alter table pantry_items enable row level security;
alter table staple_items enable row level security;

drop policy if exists "pantry_items propio" on pantry_items;
create policy "pantry_items propio" on pantry_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "staple_items propio" on staple_items;
create policy "staple_items propio" on staple_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
