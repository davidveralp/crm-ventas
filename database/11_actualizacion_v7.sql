-- =====================================================================
-- DIDIAL CRM · ACTUALIZACIÓN v7
-- 1) Segmento "Nuevo cliente"
-- 2) Dirección del cliente
-- 3) Tabla de servicios (historial de OT por vehículo / patente)
-- Ejecutar en el SQL Editor de Supabase. Es seguro re-ejecutarlo.
-- NOTA: si la línea ALTER TYPE da error por transacción, ejecútala sola.
-- =====================================================================

-- ---- 1. Nuevo valor de segmento -----------------------------------
alter type segmento_valor add value if not exists 'nuevo';

-- ---- 2. Dirección del cliente -------------------------------------
alter table clientes add column if not exists direccion text;
alter table clientes add column if not exists comuna    text;

-- ---- 3. Historial de servicios (alimentado desde la base de OT) ----
create table if not exists servicios (
  id            uuid primary key default uuid_generate_v4(),
  empresa_id    uuid not null references empresas(id)  on delete cascade,
  cliente_id    uuid references clientes(id)           on delete set null,
  vehiculo_id   uuid references vehiculos(id)          on delete set null,
  patente       text,
  ot_numero     text,
  fecha         date,
  tipo_servicio   text,
  tipo_servicio_2 text,
  descripcion   text,
  monto         numeric,
  km            integer,
  creado_en     timestamptz default now()
);
-- Por si la tabla ya existía de una corrida anterior:
alter table servicios add column if not exists tipo_servicio_2 text;
create index if not exists idx_servicios_patente on servicios(patente);
create index if not exists idx_servicios_cliente on servicios(cliente_id);
-- Único normal (NO parcial): requerido para el upsert on_conflict del sync.
create unique index if not exists uq_servicios_ot on servicios(empresa_id, ot_numero);

alter table servicios enable row level security;
drop policy if exists servicios_all on servicios;
create policy servicios_all on servicios
  for all using (empresa_id = empresa_actual())
  with check (empresa_id = empresa_actual());

-- Vincula cada servicio con su vehículo/cliente por patente (re-ejecutable).
-- Córrela después de cada sincronización desde la planilla de OT.
update servicios s set
  vehiculo_id = v.id,
  cliente_id  = coalesce(s.cliente_id, v.cliente_id)
from vehiculos v
where s.vehiculo_id is null
  and s.patente is not null
  and regexp_replace(upper(v.patente), '[^A-Z0-9]', '', 'g')
    = regexp_replace(upper(s.patente), '[^A-Z0-9]', '', 'g');

-- Listo. Refresca el CRM tras ejecutar.
