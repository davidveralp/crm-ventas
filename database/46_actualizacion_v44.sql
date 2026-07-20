-- =====================================================================
-- ACTUALIZACIÓN v44 · Tareas de reparación como Subtareas de ClickUp
-- + "Solicitar revisión" nace directo en 'en_reparacion'
-- ---------------------------------------------------------------------
-- Idempotente. Requiere migraciones 1–45.
-- =====================================================================

alter table tareas_taller add column if not exists clickup_subtask_id text;
create index if not exists idx_tareas_clickup on tareas_taller(clickup_subtask_id) where clickup_subtask_id is not null;

select 'v44 ok' as resultado;
