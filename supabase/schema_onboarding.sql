-- =====================================================================
-- Onboarding: ubicación del usuario y cadenas detectadas cerca. Idempotente.
-- =====================================================================

alter table supermarkets add column if not exists has_prices boolean not null default false;
update supermarkets set has_prices = true where id in ('mercadona', 'dia');

-- Cadenas conocidas (sin precios todavía salvo mercadona y dia)
insert into supermarkets (id, name, has_prices) values
  ('carrefour', 'Carrefour', false),
  ('lidl', 'Lidl', false),
  ('aldi', 'Aldi', false),
  ('alcampo', 'Alcampo', false),
  ('ahorramas', 'Ahorramás', false),
  ('eroski', 'Eroski', false),
  ('elcorteingles', 'Supermercado El Corte Inglés', false),
  ('supercor', 'Supercor', false),
  ('hipercor', 'Hipercor', false),
  ('bm', 'BM', false),
  ('consum', 'Consum', false),
  ('froiz', 'Froiz', false),
  ('gadis', 'Gadis', false),
  ('lupa', 'Lupa', false),
  ('condis', 'Condis', false),
  ('caprabo', 'Caprabo', false),
  ('coviran', 'Covirán', false),
  ('spar', 'Spar', false),
  ('masymas', 'Masymas', false),
  ('familycash', 'Family Cash', false),
  ('primaprix', 'Primaprix', false),
  ('unide', 'Unide', false),
  ('suma', 'Suma', false),
  ('sanchezromero', 'Sánchez Romero', false),
  ('bonpreu', 'Bonpreu', false),
  ('elarbol', 'El Árbol', false),
  ('dealz', 'Dealz', false)
on conflict (id) do nothing;

alter table profiles add column if not exists lat double precision;
alter table profiles add column if not exists lng double precision;
alter table profiles add column if not exists address text;
alter table profiles add column if not exists onboarded_at timestamptz;

-- Alta de una cadena vista en el mapa que no está en la tabla (solo usuarios logueados)
create or replace function public.ensure_supermarket(p_id text, p_name text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'no autenticado';
  end if;
  insert into supermarkets (id, name, has_prices)
  values (lower(regexp_replace(p_id, '[^a-z0-9]', '', 'g')), left(p_name, 60), false)
  on conflict (id) do nothing;
end;
$$;
revoke all on function public.ensure_supermarket(text, text) from public;
grant execute on function public.ensure_supermarket(text, text) to authenticated;
