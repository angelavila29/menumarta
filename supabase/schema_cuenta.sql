-- =====================================================================
-- Tus datos son tuyos: borrar la cuenta y descargar lo que hay guardado.
-- Idempotente.
-- =====================================================================

-- Borra la cuenta de quien la llama. Todo lo demás (perfil, recetas,
-- menús, listas, despensa, amistades) cuelga de auth.users con
-- "on delete cascade", así que se va con ella.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Hay que haber iniciado sesión.' using errcode = 'insufficient_privilege';
  end if;

  -- Las fotos de recetas viven en Storage y hay que borrarlas con su API
  -- (Postgres no deja tocar storage.objects a mano): lo hace la app antes
  -- de llamar aquí, en lib/account-actions.ts.

  -- Que la invitación no bloquee a quien quiera volver más adelante.
  delete from signup_allowlist a
   using auth.users u
   where u.id = uid and a.email = lower(u.email);

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
