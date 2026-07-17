-- =====================================================================
-- ACTUALIZACIÓN v42 · Integración bidireccional CRM ↔ ClickUp (Taller)
-- ---------------------------------------------------------------------
-- Vincula cada trabajo de taller con su tarjeta en ClickUp (lista
-- "Vehiculos en Taller", space "SERVICIO TECNICO", team 90132937173).
-- Idempotente. Requiere migraciones 1–43.
-- =====================================================================

alter table trabajos_taller add column if not exists clickup_task_id text;
alter table trabajos_taller add column if not exists clickup_synced_at timestamptz;
create index if not exists idx_trabajos_clickup on trabajos_taller(clickup_task_id) where clickup_task_id is not null;

select 'v42 ok' as resultado;
