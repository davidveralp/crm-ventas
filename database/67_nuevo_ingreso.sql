-- ============================================================================
-- Migración 67 — Nuevo Ingreso: revisión de recepción
-- ============================================================================
--
-- CAMBIO DE ENFOQUE
-- El inventario del vehículo (gato, rueda de repuesto, radio…) protegía al
-- taller de un reclamo, pero no producía nada. Se reemplaza por una REVISIÓN
-- de once puntos que se hace con el cliente presente y detecta necesidades:
-- luces, plumillas, filtros, fugas, frenos y niveles de los cinco fluidos.
--
-- Es la primera instancia de venta cruzada, antes del RADAR: el asesor puede
-- mostrarle al cliente lo que encontró en el momento de recibir el vehículo.
--
-- Las respuestas usan el mismo vocabulario de severidad que el RADAR
-- (ok / pronto / critico / na), para que ambos alimenten el mismo circuito de
-- diagnósticos y oportunidades.
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk).
-- ============================================================================

alter table public.inspecciones_ingreso
  add column if not exists revision_recepcion jsonb default '{}'::jsonb,
  add column if not exists niveles_fluidos    jsonb default '{}'::jsonb,
  add column if not exists tipo_vehiculo      text,
  add column if not exists combustible        text,
  add column if not exists tipo_servicio      text,
  add column if not exists solicita_presupuesto boolean default false,
  add column if not exists detalle_presupuesto  text,
  add column if not exists razon_social       text;

comment on column public.inspecciones_ingreso.revision_recepcion is
  'Once puntos de revisión con el cliente presente. {clave: {v, sev}} con sev en ok|pronto|critico|na.';
comment on column public.inspecciones_ingreso.niveles_fluidos is
  'Nivel de los cinco fluidos: {Refrigerante: "ok", "Aceite motor": "bajo", ...}';
comment on column public.inspecciones_ingreso.detalle_presupuesto is
  'Qué se le pide cotizar al encargado de presupuestos, en palabras del asesor.';

-- El inventario queda como está: no se borra para no perder lo ya registrado,
-- pero deja de usarse en el formulario.

-- Índice para encontrar los ingresos que pidieron presupuesto y siguen sin él
create index if not exists inspecciones_presupuesto_idx
  on public.inspecciones_ingreso (solicita_presupuesto, iniciada_en desc)
  where solicita_presupuesto;

-- Verificación
select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='inspecciones_ingreso'
  and column_name in ('revision_recepcion','niveles_fluidos','tipo_vehiculo',
                      'combustible','tipo_servicio','solicita_presupuesto',
                      'detalle_presupuesto','razon_social')
order by column_name;

notify pgrst, 'reload schema';
