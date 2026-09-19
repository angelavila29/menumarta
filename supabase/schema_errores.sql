-- =====================================================================
-- Registro de errores: para enterarnos de lo que falla a quien la usa.
-- Idempotente.
-- =====================================================================
create table if not exists app_errors (
  id         bigserial primary key,
  user_id    uuid references profiles(id) on delete set null,
  path       text,
  message    text,
  digest     text,
  created_at timestamptz not null default now()
);
create index if not exists app_errors_fecha on app_errors (created_at desc);

alter table app_errors enable row level security;

-- Solo se escribe, y solo lo tuyo. Nadie lee desde la API: se consulta
-- desde el SQL Editor de Supabase.
drop policy if exists "app_errors apuntar" on app_errors;
create policy "app_errors apuntar" on app_errors for insert to authenticated
  with check (user_id = (select auth.uid()));

-- La tabla no debe crecer: nos quedamos con los últimos 30 días.
create or replace function public.prune_app_errors()
returns integer language plpgsql security invoker set search_path = public as $$
declare n integer;
begin
  delete from app_errors where created_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.prune_app_errors() from public, anon, authenticated;
grant execute on function public.prune_app_errors() to service_role;
