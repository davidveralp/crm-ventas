-- ============================================================================
-- Migración 72 — Clasificación de las tareas de ClickUp
-- ============================================================================
--
-- El taller agrupa las subtareas en ClickUp con separadores del tipo
-- "*** MANO DE OBRA ***". La sincronización los detecta y clasifica las tareas
-- que vienen después, hasta el siguiente separador.
--
-- Eso permite que el cierre de OT llegue precargado con las líneas ya
-- separadas en repuestos, insumos, mano de obra y servicios externos: el asesor
-- solo agrega los valores en vez de transcribir el trabajo completo.
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk).
-- ============================================================================

alter table public.tareas_taller
  add column if not exists tipo_linea text default 'servicio';

comment on column public.tareas_taller.tipo_linea is
  'repuesto | insumo | servicio (mano de obra) | servicio_externo. Se deduce de los separadores de ClickUp; el asesor puede corregirlo al cerrar.';

create index if not exists tareas_tipo_idx on public.tareas_taller (trabajo_id, tipo_linea);

select column_name from information_schema.columns
where table_schema='public' and table_name='tareas_taller' and column_name='tipo_linea';

notify pgrst, 'reload schema';
