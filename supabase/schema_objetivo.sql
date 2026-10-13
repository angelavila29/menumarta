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

-- Recetas copiadas: de cuál vienen ("Hacer mi versión").
alter table recipes add column if not exists based_on bigint references recipes(id) on delete set null;

-- Última vez que se revisó o tocó la despensa (para el recordatorio semanal).
alter table profiles add column if not exists pantry_reviewed_at timestamptz;

-- Guarnición opcional en cada comida del menú ("Salmón con puré").
alter table weekly_menu_slots add column if not exists side_recipe_id bigint references recipes(id) on delete set null;
