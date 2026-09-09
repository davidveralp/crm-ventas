-- ============================================================================
-- Migración 70 — Tareas de ClickUp con su técnico asignado
-- ============================================================================
--
-- QUÉ RESUELVE
-- Las tareas del taller y quién las tiene asignadas viven en ClickUp: el jefe
-- asigna ahí y los mecánicos marcan avance ahí. El CRM traía la tarjeta del
-- vehículo pero no las subtareas, así que al abrir el detalle no se veía el
-- trabajo real.
--
-- Ahora la sincronización trae subtareas, asignados y observaciones.
--
-- SOBRE `tecnico_nombre`
-- El asignado de ClickUp se cruza con `usuarios` por correo. Cuando no hay
-- coincidencia —una cuenta genérica "Tecnico 1", o alguien que no está en el
-- CRM— se guarda igual el nombre que muestra ClickUp. Es preferible saber que
-- lo hizo "Felipe Alcota" aunque no haya ficha, a no saber nada.
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk).
-- ============================================================================

alter table public.tareas_taller
  add column if not exists tecnico_nombre  text,
  add column if not exists clickup_task_id text;

comment on column public.tareas_taller.tecnico_nombre is
  'Nombre del asignado en ClickUp cuando no se pudo cruzar con un usuario del CRM.';

-- upsert por clickup_task_id: reimportar no duplica las tareas
create unique index if not exists tareas_clickup_uniq
  on public.tareas_taller (clickup_task_id) where clickup_task_id is not null;

-- Verificación
select column_name from information_schema.columns
where table_schema='public' and table_name='tareas_taller'
  and column_name in ('tecnico_nombre','clickup_task_id')
order by column_name;

notify pgrst, 'reload schema';
