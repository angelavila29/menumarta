-- =====================================================================
-- Objetivo corporal: para valorar si el menú semanal cuadra con la persona.
-- Idempotente.
-- =====================================================================
alter table profiles
  add column if not exists sex text check (sex in ('mujer','hombre')),
  add column if not exists age integer check (age between 10 and 110),
  add column if not exists weight_kg numeric check (weight_kg between 25 and 300),
  add column if not exists height_cm integer check (height_cm between 100 and 250),
  add column if not exists activity text check (activity in ('baja','media','alta')),
  add column if not exists body_goal text check (body_goal in ('perder','mantener','ganar'));

-- Electrodomésticos que hay en casa (null = no lo ha dicho, no se filtra).
alter table profiles add column if not exists appliances text[];
