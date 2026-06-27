-- =====================================================================
-- DIDIAL CRM · ESQUEMA DE BASE DE DATOS
-- PostgreSQL (Supabase) · Versión 1.0
-- =====================================================================
-- Orden de ejecución en el SQL Editor de Supabase:
--   1. 01_schema.sql   (este archivo: tablas, tipos, índices, triggers)
--   2. 02_rls.sql      (políticas de seguridad por filas)
--   3. 03_seed.sql     (empresa, segmentos, estados, usuarios iniciales)
-- =====================================================================

-- Extensiones ----------------------------------------------------------
create extension if not exists "uuid-ossp";

-- =====================================================================
-- TIPOS ENUMERADOS
-- =====================================================================
do $$ begin
  create type rol_usuario as enum ('admin', 'vendedor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type segmento_valor as enum (
    'flota_empresa', 'vip_activo', 'alto_valor_riesgo',
    'leal_recurrente', 'prometedor', 'dormido_recuperable', 'ocasional'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type ventana_km as enum (
    'vencida', 'inminente', 'proxima', 'futura', 'lejana'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_mantencion as enum ('basica', 'intermedia', 'mayor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_actividad as enum (
    'llamada', 'propuesta', 'agendamiento', 'visita', 'email', 'whatsapp'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type resultado_actividad as enum (
    'pendiente', 'exitosa', 'no_contesta', 'interesado',
    'no_interesado', 'agendado', 'reagendar'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type canal_campana as enum ('whatsapp', 'llamada', 'email', 'sms');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_campana as enum ('borrador', 'activa', 'pausada', 'completada');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- EMPRESAS  (multi-empresa para replicabilidad)
-- =====================================================================
create table if not exists empresas (
  id           uuid primary key default uuid_generate_v4(),
  nombre       text not null,
  rut          text,
  ciudad       text,
  email        text,
  zona_horaria text default 'America/Santiago',
  activa       boolean default true,
  creada_en    timestamptz default now()
);

-- =====================================================================
-- USUARIOS  (perfil; el login vive en auth.users de Supabase)
-- El id coincide con auth.users.id
-- =====================================================================
create table if not exists usuarios (
  id           uuid primary key references auth.users(id) on delete cascade,
  empresa_id   uuid not null references empresas(id) on delete cascade,
  nombre       text not null,
  email        text not null,
  rol          rol_usuario not null default 'vendedor',
  telefono     text,
  activo       boolean default true,
  creado_en    timestamptz default now()
);
create index if not exists idx_usuarios_empresa on usuarios(empresa_id);

-- =====================================================================
-- ESTADOS DE PIPELINE  (embudo configurable por empresa)
-- =====================================================================
create table if not exists pipeline_estados (
  id          uuid primary key default uuid_generate_v4(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  nombre      text not null,
  color       text default '#1C4357',
  orden       int not null default 0,
  es_final    boolean default false        -- Vendido / Perdido
);
create index if not exists idx_estados_empresa on pipeline_estados(empresa_id);

-- =====================================================================
-- CLIENTES
-- =====================================================================
create table if not exists clientes (
  id                   uuid primary key default uuid_generate_v4(),
  empresa_id           uuid not null references empresas(id) on delete cascade,
  nombre               text not null,
  email                text,
  telefono             text,
  ciudad               text,
  tipo                 text,                -- 'EMPRESA' | 'PARTICULAR'
  segmento             segmento_valor,
  ticket_promedio      numeric(14,2) default 0,
  facturacion_total    numeric(14,2) default 0,
  num_ot               int default 0,       -- nº de órdenes de trabajo
  ultima_visita        date,
  recencia_dias        int,
  vendedor_id          uuid references usuarios(id) on delete set null,
  estado_id            uuid references pipeline_estados(id) on delete set null,
  accion_recomendada   text,
  notas                text,
  creado_en            timestamptz default now(),
  actualizado_en       timestamptz default now()
);
create index if not exists idx_clientes_empresa  on clientes(empresa_id);
create index if not exists idx_clientes_vendedor on clientes(vendedor_id);
create index if not exists idx_clientes_segmento on clientes(segmento);
create index if not exists idx_clientes_estado   on clientes(estado_id);

-- =====================================================================
-- VEHÍCULOS
-- =====================================================================
create table if not exists vehiculos (
  id                   uuid primary key default uuid_generate_v4(),
  cliente_id           uuid not null references clientes(id) on delete cascade,
  empresa_id           uuid not null references empresas(id) on delete cascade,
  patente              text,
  marca                text,
  modelo               text,
  anio                 int,
  km_ultimo            int,
  km_actual_estimado   int,
  proximo_servicio_km  int,
  tipo_mantencion      tipo_mantencion,
  es_mantencion_mayor  boolean default false,
  ventana              ventana_km,
  ritmo_km_mes         numeric(10,2),
  creado_en            timestamptz default now()
);
create index if not exists idx_vehiculos_cliente on vehiculos(cliente_id);
create index if not exists idx_vehiculos_empresa on vehiculos(empresa_id);
create index if not exists idx_vehiculos_ventana on vehiculos(ventana);

-- =====================================================================
-- ACTIVIDADES  (seguimiento: llamadas, propuestas, agendamientos)
-- =====================================================================
create table if not exists actividades (
  id              uuid primary key default uuid_generate_v4(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  cliente_id      uuid not null references clientes(id) on delete cascade,
  vendedor_id     uuid references usuarios(id) on delete set null,
  tipo            tipo_actividad not null,
  resultado       resultado_actividad default 'pendiente',
  fecha           date not null default current_date,
  hora            time,
  descripcion     text,
  proxima_accion  text,
  monto_recuperado numeric(14,2),
  campana_id      uuid,
  creado_en       timestamptz default now(),
  actualizado_en  timestamptz default now()
);
create index if not exists idx_actividades_empresa  on actividades(empresa_id);
create index if not exists idx_actividades_cliente  on actividades(cliente_id);
create index if not exists idx_actividades_vendedor on actividades(vendedor_id);
create index if not exists idx_actividades_fecha    on actividades(fecha);

-- =====================================================================
-- CAMPAÑAS
-- =====================================================================
create table if not exists campanas (
  id                uuid primary key default uuid_generate_v4(),
  empresa_id        uuid not null references empresas(id) on delete cascade,
  nombre            text not null,
  descripcion       text,
  segmento          segmento_valor,
  ventana           ventana_km,
  canal             canal_campana,
  estado            estado_campana default 'borrador',
  mensaje_plantilla text,
  fecha_inicio      date,
  fecha_fin         date,
  prioridad         int default 0,
  creado_en         timestamptz default now()
);
create index if not exists idx_campanas_empresa on campanas(empresa_id);

-- =====================================================================
-- AUDITORÍA  (registro de cambios de estado)
-- =====================================================================
create table if not exists auditoria (
  id          uuid primary key default uuid_generate_v4(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  entidad     text not null,        -- 'cliente' | 'actividad' | 'pipeline'
  entidad_id  uuid not null,
  usuario_id  uuid references usuarios(id) on delete set null,
  campo       text,
  valor_antes text,
  valor_despues text,
  ocurrido_en timestamptz default now()
);
create index if not exists idx_auditoria_empresa on auditoria(empresa_id);
create index if not exists idx_auditoria_entidad on auditoria(entidad, entidad_id);

-- =====================================================================
-- FUNCIONES Y TRIGGERS
-- =====================================================================

-- Actualiza el campo actualizado_en automáticamente
create or replace function touch_actualizado_en()
returns trigger as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_clientes_touch on clientes;
create trigger trg_clientes_touch
  before update on clientes
  for each row execute function touch_actualizado_en();

drop trigger if exists trg_actividades_touch on actividades;
create trigger trg_actividades_touch
  before update on actividades
  for each row execute function touch_actualizado_en();

-- Registra en auditoría cualquier cambio de estado de pipeline del cliente
create or replace function auditar_cambio_estado()
returns trigger as $$
begin
  if (old.estado_id is distinct from new.estado_id) then
    insert into auditoria (empresa_id, entidad, entidad_id, usuario_id,
                           campo, valor_antes, valor_despues)
    values (new.empresa_id, 'cliente', new.id, auth.uid(),
            'estado_id', old.estado_id::text, new.estado_id::text);
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_clientes_auditoria on clientes;
create trigger trg_clientes_auditoria
  after update on clientes
  for each row execute function auditar_cambio_estado();

-- Helper: devuelve la empresa del usuario autenticado (para RLS)
create or replace function empresa_actual()
returns uuid as $$
  select empresa_id from usuarios where id = auth.uid();
$$ language sql stable security definer;

-- Helper: ¿el usuario autenticado es admin?
create or replace function es_admin()
returns boolean as $$
  select exists (
    select 1 from usuarios where id = auth.uid() and rol = 'admin'
  );
$$ language sql stable security definer;
