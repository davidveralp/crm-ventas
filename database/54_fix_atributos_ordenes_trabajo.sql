-- ============================================================================
-- Migración 54 — CORRECCIÓN de la 52: atributos del vehículo en `ordenes_trabajo`
-- ============================================================================
--
-- ERROR QUE CORRIGE
--   "Could not find the 'traccion' column of 'ordenes_trabajo' in the schema cache"
--   al guardar una OT nueva.
--
-- CAUSA
--   La migración 52 agregó version/traccion/transmision a `vehiculos` y a
--   `servicios`, pero Nueva OT inserta la orden en **`ordenes_trabajo`**
--   (NuevaOT.jsx: `supabase.from('ordenes_trabajo').insert(fila)`).
--   `servicios` solo recibe después un upsert con un subconjunto comercial
--   —ot_numero, fecha, patente, tipo_servicio, monto, km, documento— que no
--   incluye estos atributos. O sea: se agregaron en la tabla equivocada.
--
--   Por eso la creación del vehículo sí funcionaba (vehiculos tenía las
--   columnas) y el error aparecía recién al insertar la orden.
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk), NO en "Didial OT".
-- ============================================================================

-- 1) Las columnas que faltaban, donde de verdad se necesitan
alter table public.ordenes_trabajo
  add column if not exists version      text,
  add column if not exists traccion     text,
  add column if not exists transmision  text;

comment on column public.ordenes_trabajo.version     is 'Equipamiento o acabado: GL, Sport, Titanium, Laredo…';
comment on column public.ordenes_trabajo.traccion    is '4X2, 4X4, AWD, 4WD';
comment on column public.ordenes_trabajo.transmision is 'MT, AT, CVT, DSG, AMT';

-- 2) Misma validación suave que en vehiculos. NOT VALID: no bloquea lo histórico.
alter table public.ordenes_trabajo drop constraint if exists ot_traccion_chk;
alter table public.ordenes_trabajo
  add constraint ot_traccion_chk
  check (traccion is null or traccion in ('4X2','4X4','AWD','4WD')) not valid;

alter table public.ordenes_trabajo drop constraint if exists ot_transmision_chk;
alter table public.ordenes_trabajo
  add constraint ot_transmision_chk
  check (transmision is null or transmision in ('MT','AT','CVT','DSG','AMT')) not valid;

-- 3) Limpieza opcional: las columnas que la migración 52 creó de más en
--    `servicios` no se usan. Son inofensivas (quedan siempre en NULL), así que
--    se pueden dejar. Descomentar solo si se prefiere no acumular columnas
--    muertas. NO afecta a `vehiculos`, donde sí se usan.
-- alter table public.servicios
--   drop column if exists version,
--   drop column if exists traccion,
--   drop column if exists transmision;

-- 4) Refrescar la caché de esquema de PostgREST.
--    El mensaje "in the schema cache" indica que PostgREST mantiene una copia
--    del esquema; si tras ejecutar esto el error persiste, este NOTIFY la obliga
--    a recargar sin reiniciar el proyecto.
notify pgrst, 'reload schema';

-- 5) Verificación: deben aparecer las tres columnas.
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('ordenes_trabajo','vehiculos')
  and column_name in ('version','traccion','transmision','cilindrada')
order by table_name, column_name;
