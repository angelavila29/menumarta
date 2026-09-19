-- =====================================================================
-- Iteración 6: recetas y menú semanal. Pegar en el SQL Editor tras schema.sql.
-- Idempotente.
-- =====================================================================

create table if not exists recipes (
  id       bigserial primary key,
  name     text not null unique,
  meal     text not null check (meal in ('comida', 'cena', 'ambas')),
  servings int  not null default 4,
  tags     text[] not null default '{}'
);

create table if not exists recipe_ingredients (
  id              bigserial primary key,
  recipe_id       bigint not null references recipes(id) on delete cascade,
  ingredient_name text not null,
  qty             numeric not null,
  unit            text not null   -- 'g', 'ml', 'ud'
);
create index if not exists recipe_ingredients_recipe_idx on recipe_ingredients (recipe_id);

create table if not exists weekly_menus (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  week_start date not null,
  servings   int  not null default 2,
  unique (user_id, week_start)
);

create table if not exists weekly_menu_slots (
  menu_id   uuid   not null references weekly_menus(id) on delete cascade,
  day       int    not null check (day between 0 and 6),
  meal      text   not null check (meal in ('comida', 'cena')),
  recipe_id bigint references recipes(id) on delete set null,
  primary key (menu_id, day, meal)
);

create table if not exists ingredient_product_map (
  user_id         uuid   not null references profiles(id) on delete cascade,
  ingredient_name text   not null,
  product_id      bigint not null references products(id) on delete cascade,
  primary key (user_id, ingredient_name)
);

-- RLS
alter table recipes                enable row level security;
alter table recipe_ingredients     enable row level security;
alter table weekly_menus           enable row level security;
alter table weekly_menu_slots      enable row level security;
alter table ingredient_product_map enable row level security;

drop policy if exists "recipes lectura publica" on recipes;
create policy "recipes lectura publica" on recipes for select using (true);

drop policy if exists "recipe_ingredients lectura publica" on recipe_ingredients;
create policy "recipe_ingredients lectura publica" on recipe_ingredients for select using (true);

drop policy if exists "weekly_menus propio" on weekly_menus;
create policy "weekly_menus propio" on weekly_menus
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "weekly_menu_slots propio" on weekly_menu_slots;
create policy "weekly_menu_slots propio" on weekly_menu_slots
  for all
  using (exists (select 1 from weekly_menus m where m.id = weekly_menu_slots.menu_id and m.user_id = auth.uid()))
  with check (exists (select 1 from weekly_menus m where m.id = weekly_menu_slots.menu_id and m.user_id = auth.uid()));

drop policy if exists "ingredient_product_map propio" on ingredient_product_map;
create policy "ingredient_product_map propio" on ingredient_product_map
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Detalle de receta: descripción, tiempo, dificultad y pasos
alter table recipes add column if not exists description text;
alter table recipes add column if not exists time_minutes int;
alter table recipes add column if not exists difficulty text;
alter table recipes add column if not exists steps text[] not null default '{}';

-- Recetas favoritas
create table if not exists favorite_recipes (
  user_id   uuid   not null references profiles(id) on delete cascade,
  recipe_id bigint not null references recipes(id) on delete cascade,
  primary key (user_id, recipe_id)
);
alter table favorite_recipes enable row level security;
drop policy if exists "favorite_recipes propio" on favorite_recipes;
create policy "favorite_recipes propio" on favorite_recipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Menú realista: huecos "como fuera" y cuántas veces se cocina a la semana
alter table weekly_menu_slots add column if not exists kind text not null default 'meal'
  check (kind in ('meal', 'out'));
alter table profiles add column if not exists cook_sessions int check (cook_sessions between 1 and 14);
