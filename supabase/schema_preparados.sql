-- Platos preparados: calorías por 100 g sacadas de la etiqueta de un producto ya hecho
-- (arroz negro congelado, gyozas, lasaña…). Las lee todo el mundo; cada uno edita las suyas.
create table if not exists public.ingredient_nutrition (
  ingredient_name text primary key,
  kcal numeric not null check (kcal >= 0 and kcal <= 900),
  protein numeric not null default 0 check (protein >= 0 and protein <= 100),
  carbs numeric not null default 0 check (carbs >= 0 and carbs <= 100),
  unit_grams numeric check (unit_grams is null or (unit_grams > 0 and unit_grams <= 5000)),
  product_id bigint references public.products(id) on delete set null,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.ingredient_nutrition enable row level security;
drop policy if exists "ingredient_nutrition_read" on public.ingredient_nutrition;
create policy "ingredient_nutrition_read" on public.ingredient_nutrition for select to authenticated using (true);
drop policy if exists "ingredient_nutrition_insert" on public.ingredient_nutrition;
create policy "ingredient_nutrition_insert" on public.ingredient_nutrition for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "ingredient_nutrition_update" on public.ingredient_nutrition;
create policy "ingredient_nutrition_update" on public.ingredient_nutrition for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
