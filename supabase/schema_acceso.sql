-- =====================================================================
-- Funciones en pruebas: solo para los correos de esta lista. Idempotente.
-- Se edita desde el SQL Editor:
--   insert into feature_access (feature, email) values ('cocinar', 'alguien@correo.com');
--   delete from feature_access where email = 'alguien@correo.com';
-- =====================================================================
create table if not exists feature_access (
  feature    text not null,
  email      text not null,
  created_at timestamptz not null default now(),
  primary key (feature, email)
);
alter table feature_access enable row level security;

-- Cada persona solo ve sus propias filas; nadie escribe desde la API.
drop policy if exists "feature_access ver lo mio" on feature_access;
create policy "feature_access ver lo mio" on feature_access for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

insert into feature_access (feature, email) values ('cocinar', 'angelavila292001@gmail.com')
on conflict do nothing;
