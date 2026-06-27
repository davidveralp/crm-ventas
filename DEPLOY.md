-- =====================================================================
-- DIDIAL CRM · ACTUALIZACIÓN v2
-- Agrega: marca principal del cliente + módulo de presupuestos.
-- Ejecutar en el SQL Editor ANTES de 06_carga_clientes.sql
-- Es seguro re-ejecutarlo.
-- =====================================================================

-- 1. Marca principal del cliente (para segmentar por marca: Toyota, etc.)
alter table clientes add column if not exists marca_principal text;
create index if not exists idx_clientes_marca on clientes(marca_principal);

-- 2. Tipo de estado para presupuestos
do $$ begin
  create type estado_presupuesto as enum (
    'borrador', 'enviado', 'en_seguimiento', 'aprobado', 'rechazado', 'vencido'
  );
exception when duplicate_object then null; end $$;

-- 3. Tabla de presupuestos
create table if not exists presupuestos (
  id            uuid primary key default uuid_generate_v4(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  cliente_id    uuid not null references clientes(id) on delete cascade,
  vehiculo_id   uuid references vehiculos(id) on delete set null,
  vendedor_id   uuid references usuarios(id) on delete set null,
  numero        text,                       -- N° de presupuesto interno
  descripcion   text,
  monto         numeric(14,2) default 0,
  estado        estado_presupuesto default 'borrador',
  fecha_emision date default current_date,
  fecha_validez date,                       -- hasta cuándo es válido
  proxima_gestion date,                     -- cuándo volver a contactar
  notas         text,
  creado_en     timestamptz default now(),
  actualizado_en timestamptz default now()
);
create index if not exists idx_presup_empresa  on presupuestos(empresa_id);
create index if not exists idx_presup_cliente  on presupuestos(cliente_id);
create index if not exists idx_presup_vendedor on presupuestos(vendedor_id);
create index if not exists idx_presup_estado   on presupuestos(estado);

-- 4. Trigger de actualizado_en
drop trigger if exists trg_presup_touch on presupuestos;
create trigger trg_presup_touch
  before update on presupuestos
  for each row execute function touch_actualizado_en();

-- 5. Auditoría de cambios de estado del presupuesto
create or replace function auditar_presupuesto()
returns trigger as $$
begin
  if (old.estado is distinct from new.estado) then
    insert into auditoria (empresa_id, entidad, entidad_id, usuario_id,
                           campo, valor_antes, valor_despues)
    values (new.empresa_id, 'presupuesto', new.id, auth.uid(),
            'estado', old.estado::text, new.estado::text);
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_presup_auditoria on presupuestos;
create trigger trg_presup_auditoria
  after update on presupuestos
  for each row execute function auditar_presupuesto();

-- 6. RLS para presupuestos (mismo criterio: vendedor ve lo suyo, admin todo)
alter table presupuestos enable row level security;

drop policy if exists presup_select on presupuestos;
create policy presup_select on presupuestos
  for select using (
    empresa_id = empresa_actual()
    and (es_admin() or vendedor_id = auth.uid())
  );

drop policy if exists presup_insert on presupuestos;
create policy presup_insert on presupuestos
  for insert with check (empresa_id = empresa_actual());

drop policy if exists presup_update on presupuestos;
create policy presup_update on presupuestos
  for update using (
    empresa_id = empresa_actual()
    and (es_admin() or vendedor_id = auth.uid())
  );

drop policy if exists presup_delete on presupuestos;
create policy presup_delete on presupuestos
  for delete using (
    empresa_id = empresa_actual()
    and (es_admin() or vendedor_id = auth.uid())
  );
