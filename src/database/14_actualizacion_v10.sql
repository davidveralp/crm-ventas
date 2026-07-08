-- =====================================================================
-- DIDIAL CRM · ACTUALIZACIÓN v10
-- Las gestiones se vuelven un PROCESO abierto que agrupa su historial
-- de contactos, presupuestos y agendamientos. (Evolutivo: la
-- arquitectura actual se mantiene; solo se agrupa lo existente.)
-- Ejecutar en el SQL Editor de Supabase. Es seguro re-ejecutarlo.
-- =====================================================================

-- ---- 1. Tabla de gestiones ----------------------------------------
create table if not exists gestiones (
  id          uuid primary key default uuid_generate_v4(),
  empresa_id  uuid not null references empresas(id)  on delete cascade,
  cliente_id  uuid not null references clientes(id)  on delete cascade,
  vehiculo_id uuid references vehiculos(id)          on delete set null,
  campana_id  uuid references campanas(id)           on delete set null,
  vendedor_id uuid references usuarios(id)           on delete set null,
  titulo      text,
  estado      text not null default 'pendiente_contacto',
  abierta     boolean not null default true,
  creado_en   timestamptz default now(),
  cerrada_en  timestamptz
);
create index if not exists idx_gestiones_cliente on gestiones(cliente_id);

alter table gestiones enable row level security;
drop policy if exists gestiones_all on gestiones;
create policy gestiones_all on gestiones
  for all using (empresa_id = empresa_actual())
  with check (empresa_id = empresa_actual());

-- ---- 2. Enlaces y campos de agendamiento --------------------------
alter table actividades  add column if not exists gestion_id      uuid references gestiones(id) on delete cascade;
alter table actividades  add column if not exists agenda_tipo     text;   -- tipo de acción FUTURA
alter table actividades  add column if not exists recordatorio_min int;   -- minutos antes (default 15)
alter table presupuestos add column if not exists gestion_id      uuid references gestiones(id) on delete set null;
create index if not exists idx_actividades_gestion  on actividades(gestion_id);
create index if not exists idx_presupuestos_gestion on presupuestos(gestion_id);

-- ---- 3. Respaldo: agrupa lo existente en una gestión por cliente ---
insert into gestiones (empresa_id, cliente_id, vendedor_id, titulo, estado, abierta)
select c.empresa_id, c.id, c.vendedor_id, 'Gestión histórica', 'en_seguimiento', true
from clientes c
where exists (select 1 from actividades a where a.cliente_id = c.id and a.gestion_id is null)
  and not exists (select 1 from gestiones g where g.cliente_id = c.id);

update actividades a set gestion_id = g.id
from gestiones g
where a.gestion_id is null and g.cliente_id = a.cliente_id;

update presupuestos p set gestion_id = g.id
from gestiones g
where p.gestion_id is null and g.cliente_id = p.cliente_id;

-- Listo. Refresca el CRM tras ejecutar.
