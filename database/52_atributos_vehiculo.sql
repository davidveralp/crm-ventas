-- ============================================================================
-- Migración 52 — Atributos del vehículo: versión, tracción, transmisión, cilindrada
-- ============================================================================
--
-- CONTEXTO
-- Hasta ahora estos datos se escribían DENTRO del nombre del modelo:
--     "NP 300 4X4"   "SANTA FE AT"   "TUCSON GL"   "HILUX 2.4"
-- Eso fragmentaba los análisis: "HILUX", "HILUX 2.4", "hilux" y "HILUX "
-- contaban como cuatro modelos distintos en el Top 10 y en la matriz
-- Servicio × Marca del Panel Operativo.
--
-- Ahora Nueva OT los captura en campos propios. Sin esta migración, el guardado
-- falla con 'column vehiculos.traccion does not exist' y NO se puede registrar
-- ninguna OT nueva.
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk), NO en "Didial OT".
-- ============================================================================

-- 1) Columnas en la ficha del vehículo (maestro)
alter table public.vehiculos
  add column if not exists version      text,
  add column if not exists cilindrada   text,
  add column if not exists traccion     text,
  add column if not exists transmision  text;

comment on column public.vehiculos.version     is 'Equipamiento o acabado: GL, Sport, Titanium, Laredo…';
comment on column public.vehiculos.cilindrada  is 'Cilindrada en litros, como texto: 2.0, 2.4';
comment on column public.vehiculos.traccion    is '4X2, 4X4, AWD, 4WD';
comment on column public.vehiculos.transmision is 'MT, AT, CVT, DSG, AMT';

-- 2) Mismas columnas en la OT (foto del vehículo al momento del ingreso).
--    Se guardan en ambos lados a propósito: el maestro refleja el estado actual
--    del vehículo y la OT conserva lo que se registró ese día.
alter table public.servicios
  add column if not exists version      text,
  add column if not exists traccion     text,
  add column if not exists transmision  text;

-- 3) Validación suave: se aceptan solo los valores del catálogo, o nulo.
--    Es NOT VALID a propósito: no bloquea filas históricas que ya existan con
--    otro contenido; solo aplica a lo que se inserte o actualice de ahora en más.
alter table public.vehiculos
  drop constraint if exists vehiculos_traccion_chk;
alter table public.vehiculos
  add constraint vehiculos_traccion_chk
  check (traccion is null or traccion in ('4X2','4X4','AWD','4WD')) not valid;

alter table public.vehiculos
  drop constraint if exists vehiculos_transmision_chk;
alter table public.vehiculos
  add constraint vehiculos_transmision_chk
  check (transmision is null or transmision in ('MT','AT','CVT','DSG','AMT')) not valid;

-- 4) Índices para los análisis por atributo (ticket de 4x4 vs 4x2, etc.)
create index if not exists vehiculos_traccion_idx
  on public.vehiculos (traccion) where traccion is not null;
create index if not exists vehiculos_transmision_idx
  on public.vehiculos (transmision) where transmision is not null;

-- 5) Verificación
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'vehiculos'
  and column_name in ('version','cilindrada','traccion','transmision')
order by column_name;

-- 6) Cuántas fichas tienen ya estos datos (al inicio será 0 en todas;
--    se van completando a medida que se registran OTs)
select
  count(*)                                          as vehiculos,
  count(version)                                    as con_version,
  count(cilindrada)                                 as con_cilindrada,
  count(traccion)                                   as con_traccion,
  count(transmision)                                as con_transmision
from public.vehiculos;
