-- =====================================================================
-- PROCESO DE TALLER · ACTUALIZACIÓN v20
-- 1) Ficha de diagnóstico estructurada por trabajo.
-- 2) Vistos buenos de respaldo (OT firmada / video enviado) y registro
--    de quién autoriza el paso a reparación.
-- 3) Márgenes de presupuesto definidos por administración + rango de
--    ajuste permitido al asesor.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- =====================================================================

-- ---- 1) Diagnóstico estructurado ------------------------------------
create table if not exists diagnosticos_taller (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null default empresa_actual(),
  trabajo_id    uuid not null references trabajos_taller(id) on delete cascade,
  item          text not null,          -- hallazgo (ej: "Pastillas de freno al 10%")
  severidad     text default 'preventivo', -- critico | pronto | preventivo | ok
  recomendacion text,
  tecnico_id    uuid references usuarios(id) on delete set null,
  creado_en     timestamptz default now()
);
create index if not exists ix_diag_trabajo on diagnosticos_taller(trabajo_id);
alter table diagnosticos_taller enable row level security;
drop policy if exists diag_all on diagnosticos_taller;
create policy diag_all on diagnosticos_taller for all
  using (empresa_id = empresa_actual()) with check (empresa_id = empresa_actual());

-- ---- 2) Respaldos de garantía y autorización -------------------------
alter table trabajos_taller add column if not exists respaldo_ot_firmada boolean default false;
alter table trabajos_taller add column if not exists respaldo_video boolean default false;
alter table trabajos_taller add column if not exists autorizado_por uuid references usuarios(id);
alter table trabajos_taller add column if not exists autorizado_en timestamptz;

-- ---- 3) Márgenes de presupuesto (administración) ---------------------
-- margen_% por tipo de ítem sobre el costo, y ajuste_asesor_pct = rango
-- máximo (±%) en que el asesor puede mover el precio final.
insert into empresa_config (empresa_id, clave, valor) values
 ('00000000-0000-0000-0000-000000000001', 'margenes', '{
   "repuesto": 35,
   "lubricante": 30,
   "filtro": 30,
   "consumible": 25,
   "ajuste_asesor_pct": 10
 }'::jsonb)
on conflict (empresa_id, clave) do update set valor = excluded.valor;

-- Listo. Refresca el CRM tras ejecutar.
