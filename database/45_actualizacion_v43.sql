-- =====================================================================
-- ACTUALIZACIÓN v43 · Bandeja de tareas nuevas creadas en ClickUp
-- ---------------------------------------------------------------------
-- Cuando alguien crea una tarea directo en ClickUp (no desde el CRM), no
-- se auto-crea el cliente/vehículo — el formato es texto libre y no
-- confiable para automatizar sin revisión (ej. "JS WW 16 TOYOTA HILUX
-- NELSON VALLEJO OT 12902/TRAS 1667"). En vez de eso, queda en esta
-- bandeja para que el jefe de taller/admin la vincule o cree el registro
-- con los datos ya sugeridos, pero siempre revisados antes de guardar.
-- Idempotente. Requiere migraciones 1–44.
-- =====================================================================

create table if not exists clickup_tareas_pendientes (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null default '00000000-0000-0000-0000-000000000001',
  clickup_task_id     text unique not null,
  titulo              text,
  descripcion         text,
  patente_candidata   text,          -- extraída por regex del título, editable
  estado              text default 'pendiente',  -- pendiente | vinculada | descartada
  vinculado_trabajo_id uuid references trabajos_taller(id) on delete set null,
  creado_en           timestamptz default now()
);
alter table clickup_tareas_pendientes enable row level security;
do $$ begin
  create policy ctp_tenant on clickup_tareas_pendientes for all
    using (empresa_id = '00000000-0000-0000-0000-000000000001')
    with check (empresa_id = '00000000-0000-0000-0000-000000000001');
exception when duplicate_object then null; end $$;

select 'v43 ok' as resultado;
