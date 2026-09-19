-- Mantenimiento: tamaño del histórico de precios e higiene de permisos.
-- Idempotente: se puede pegar entero en el SQL Editor las veces que haga falta.

-- ---------------------------------------------------------------------
-- 1. Histórico de precios: no crecer sin límite
-- ---------------------------------------------------------------------
-- La ingesta añade ~10.000 filas al día. El plan gratuito de Supabase da
-- 500 MB, así que guardamos el detalle diario de los últimos meses y del
-- resto dejamos una foto por semana (suficiente para la gráfica y para
-- "¿ha subido de precio?").
create or replace function public.prune_price_history(p_keep_days int default 120)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  n integer;
begin
  with antiguas as (
    select
      product_id,
      captured_at,
      row_number() over (
        partition by product_id, date_trunc('week', captured_at)
        order by captured_at
      ) as rn
    from price_history
    where captured_at < current_date - p_keep_days
  )
  delete from price_history ph
  using antiguas a
  where ph.product_id = a.product_id
    and ph.captured_at = a.captured_at
    and a.rn > 1;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.prune_price_history(int) from public, anon, authenticated;
grant execute on function public.prune_price_history(int) to service_role;

-- ---------------------------------------------------------------------
-- 2. Higiene de permisos
-- ---------------------------------------------------------------------
-- Estas tres solo las llama un trigger. Nadie debería poder invocarlas
-- desde el cliente con la clave pública.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.check_signup_allowed() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- search_path fijo (aviso del linter de Supabase).
alter function public.immutable_unaccent(text) set search_path = public, pg_catalog;
