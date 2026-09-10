-- ============================================================================
-- Migración 73 — Líneas de la OT desde el ingreso y valorización posterior
-- ============================================================================
--
-- CONTEXTO (documento de Dimasoft, OT 13696)
-- Dimasoft divide la OT en cinco pestañas: Trabajo Solicitado, Observaciones,
-- Repuestos, Lubricantes y Otros Insumos, Mano de Obra/Mecánicos y Servicios
-- Externos. Ese es el modelo que hay que reemplazar.
--
-- Lo que se pierde hoy: en el ejemplo real, el precio va escrito dentro de
-- Observaciones — "REPARACIÓN DE BIELETAS, BANDEJAS Y CORREA $289.000" — sin
-- línea de detalle. Así no hay margen por ítem, ni consumo de bodega, ni forma
-- de saber qué repuesto se usó.
--
-- CÓMO QUEDA
--   1. El ASESOR carga las líneas al ingresar, en las cuatro áreas, SIN precio.
--      Sabe qué hay que hacer, no cuánto cuesta.
--   2. Esas líneas suben a ClickUp como subtareas agrupadas por área.
--   3. El ENCARGADO DE PRESUPUESTOS las valoriza en un paso propio.
--   4. Al cerrar, el detalle ya está: el asesor solo confirma.
--
-- Se reutiliza `ot_detalle` (migración 68) en vez de crear otra tabla: es la
-- misma información en otro momento del ciclo.
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk).
-- ============================================================================

alter table public.ot_detalle
  -- Quién y cuándo cargó la línea, para distinguir lo que puso el asesor de lo
  -- que valorizó el encargado.
  add column if not exists cargado_por    uuid references usuarios(id) on delete set null,
  add column if not exists valorizado_por uuid references usuarios(id) on delete set null,
  add column if not exists valorizado_en  timestamptz,
  add column if not exists proveedor      text,      -- servicios externos
  add column if not exists notas          text;

-- El precio deja de ser obligatorio: al ingresar todavía no se conoce.
alter table public.ot_detalle alter column precio_unit drop not null;
alter table public.ot_detalle alter column precio_unit set default 0;

comment on column public.ot_detalle.valorizado_por is
  'Encargado de presupuestos que puso el precio. Si está vacío, la línea sigue pendiente de valorizar.';

-- Índice para la bandeja del encargado: qué OTs tienen líneas sin precio.
create index if not exists ot_detalle_sin_valorizar_idx
  on public.ot_detalle (trabajo_id)
  where valorizado_en is null;

-- Cuántas líneas quedan por valorizar en cada trabajo
create or replace view v_ot_por_valorizar as
select
  t.id as trabajo_id, t.ot_numero, t.estado, t.creado_en,
  v.patente, v.marca, v.modelo,
  c.nombre, c.apellidos,
  count(d.id) filter (where d.valorizado_en is null) as sin_valorizar,
  count(d.id)                                        as total_lineas,
  coalesce(sum(d.total), 0)                          as monto_actual
from trabajos_taller t
join ot_detalle d on d.trabajo_id = t.id
left join vehiculos v on v.id = t.vehiculo_id
left join clientes c on c.id = t.cliente_id
where t.cierre_estado <> 'cerrado'
group by t.id, t.ot_numero, t.estado, t.creado_en, v.patente, v.marca, v.modelo, c.nombre, c.apellidos
having count(d.id) filter (where d.valorizado_en is null) > 0
order by t.creado_en;

comment on view v_ot_por_valorizar is
  'Bandeja del encargado de presupuestos: OTs con líneas cargadas por el asesor y sin precio.';

-- Verificación
select column_name from information_schema.columns
where table_schema='public' and table_name='ot_detalle'
  and column_name in ('cargado_por','valorizado_por','valorizado_en','proveedor','notas')
order by column_name;

select * from v_ot_por_valorizar limit 5;

notify pgrst, 'reload schema';
