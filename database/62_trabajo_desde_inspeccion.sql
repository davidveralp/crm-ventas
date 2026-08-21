-- ============================================================================
-- Migración 62 — Vínculo entre la inspección de ingreso y el trabajo de taller
-- ============================================================================
--
-- CONTEXTO
-- Hasta ahora la inspección de ingreso guardaba su registro pero NO creaba un
-- trabajo de taller. Consecuencia práctica: el vehículo llegaba a ClickUp sin
-- datos y quedaba como "vehículo por designar", sin patente, cliente ni la
-- solicitud del cliente.
--
-- Desde la v85 la inspección crea el trabajo, con el vehículo, el cliente y lo
-- que pidió el cliente. Sigue naciendo en estado `por_designar` —el jefe de
-- taller es quien asigna el técnico— pero ahora llega identificado.
--
-- Sin esta migración el guardado falla con
-- 'column trabajos_taller.km_ingreso does not exist'.
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk).
-- ============================================================================

alter table public.trabajos_taller
  add column if not exists km_ingreso    int,
  add column if not exists inspeccion_id uuid references inspecciones_ingreso(id) on delete set null;

comment on column public.trabajos_taller.km_ingreso is
  'Kilometraje al momento del ingreso, tomado de la inspección.';
comment on column public.trabajos_taller.inspeccion_id is
  'Inspección de ingreso que originó este trabajo, si la hubo.';

create index if not exists trabajos_taller_inspeccion_idx
  on public.trabajos_taller (inspeccion_id) where inspeccion_id is not null;

-- Verificación
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'trabajos_taller'
  and column_name in ('km_ingreso', 'inspeccion_id')
order by column_name;

-- Trabajos originados en una inspección (al principio será 0)
select count(*) filter (where inspeccion_id is not null) as desde_inspeccion,
       count(*)                                          as total
from public.trabajos_taller;
