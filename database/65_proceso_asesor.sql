-- ============================================================================
-- Migración 65 — Proceso del asesor en la inspección de ingreso
-- ============================================================================
--
-- CONTEXTO
-- La inspección captura ahora los datos que el asesor definía recién en Nueva
-- OT, cuando el cliente ya se había ido: tipo de ingreso, sucursal, tipo de
-- cliente, origen y autorizaciones.
--
-- Por qué en el ingreso y no después:
--   · `tipo_ingreso` decide si la OT cuenta como garantía (tope de 3 por
--     sucursal al mes). Se sabe al recibir el vehículo, no al cerrarlo.
--   · `sucursal` define a qué meta comercial suma la venta.
--   · `conocio` solo se puede preguntar sin incomodar cuando el cliente es
--     nuevo y está ahí, en el mostrador.
--   · Las autorizaciones son las que el cliente firma en el documento de
--     ingreso; guardarlas después es reconstruirlas de memoria.
--
-- Los campos de CIERRE (documento, monto, encuesta, estado del vehículo)
-- siguen en Nueva OT a propósito: al recibir el vehículo todavía no ocurrieron.
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk).
-- ============================================================================

alter table public.inspecciones_ingreso
  add column if not exists tipo_ingreso          text,
  add column if not exists sucursal              text,
  add column if not exists tipo_cliente          text,
  add column if not exists conocio               text,
  add column if not exists autoriza_movilizacion boolean default true,
  add column if not exists autoriza_contacto     boolean default true;

comment on column public.inspecciones_ingreso.autoriza_contacto is
  'Autorización para recordatorios de mantención. Sin ella, el cliente queda fuera de las campañas de fidelización.';
comment on column public.inspecciones_ingreso.autoriza_movilizacion is
  'Política 1 del documento de ingreso: autoriza movilizar el vehículo para pruebas en ruta.';

-- La sucursal también en el trabajo, para los indicadores por sucursal
alter table public.trabajos_taller
  add column if not exists sucursal text;

comment on column public.trabajos_taller.sucursal is
  'Toyota | Multimarca | DyP. Define a qué meta comercial suma la venta.';

create index if not exists trabajos_taller_sucursal_idx
  on public.trabajos_taller (sucursal) where sucursal is not null;
create index if not exists inspecciones_sucursal_idx
  on public.inspecciones_ingreso (sucursal) where sucursal is not null;

-- Verificación
select table_name, column_name
from information_schema.columns
where table_schema='public'
  and (table_name='inspecciones_ingreso' and column_name in
        ('tipo_ingreso','sucursal','tipo_cliente','conocio','autoriza_movilizacion','autoriza_contacto')
   or table_name='trabajos_taller' and column_name='sucursal')
order by table_name, column_name;

notify pgrst, 'reload schema';
