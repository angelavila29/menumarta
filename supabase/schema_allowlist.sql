-- =====================================================================
-- Registro por invitación: solo entra quien esté en la lista. Idempotente.
-- =====================================================================

create table if not exists signup_allowlist (
  email      text primary key,
  invited_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table signup_allowlist enable row level security;

-- Quien ya tiene cuenta puede invitar; nadie lee la lista desde la API
drop policy if exists "signup_allowlist invitar" on signup_allowlist;
create policy "signup_allowlist invitar" on signup_allowlist for insert to authenticated
  with check (invited_by = (select auth.uid()));
drop policy if exists "signup_allowlist ver lo mio" on signup_allowlist;
create policy "signup_allowlist ver lo mio" on signup_allowlist for select to authenticated
  using (invited_by = (select auth.uid()));
drop policy if exists "signup_allowlist quitar lo mio" on signup_allowlist;
create policy "signup_allowlist quitar lo mio" on signup_allowlist for delete to authenticated
  using (invited_by = (select auth.uid()));

-- Los que ya tienen cuenta quedan permitidos
insert into signup_allowlist (email)
select lower(email) from auth.users where email is not null
on conflict (email) do nothing;

-- Al crear una cuenta: solo si está invitada
create or replace function public.check_signup_allowed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from signup_allowlist a where a.email = lower(new.email)) then
    raise exception 'Sobremesa es solo por invitación. Pide a quien te invitó que añada tu correo.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_allowlist on auth.users;
create trigger on_auth_user_allowlist
  before insert on auth.users
  for each row execute procedure public.check_signup_allowed();
