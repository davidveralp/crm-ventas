-- =====================================================================
-- MÓDULO TALLER · ACTUALIZACIÓN v18
-- Flujo operativo completo: derivación al taller, tareas por técnico,
-- presupuestos de taller, notificaciones y pipeline operativo.
--
-- ⚠️ IMPORTANTE — EJECUTAR EN DOS PASOS (limitación de Postgres con enums):
--   PASO 1: ejecuta SOLO el bloque "PASO 1" y espera que termine.
--   PASO 2: ejecuta el resto del archivo.
-- =====================================================================

-- ============================ PASO 1 =================================
-- Nuevos roles de usuario (ejecutar solo, sin el resto del script)
alter type rol_usuario add value if not exists 'jefe_taller';
alter type rol_usuario add value if not exists 'tecnico';
alter type rol_usuario add value if not exists 'coordinador_adquisiciones';
alter type rol_usuario add value if not exists 'encargado_bodega';

-- ============================ PASO 2 =================================

-- ---- Trabajos de taller (pipeline operativo por vehículo) ----------
create table if not exists trabajos_taller (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null default empresa_actual(),
  cliente_id         uuid references clientes(id) on delete set null,
  vehiculo_id        uuid references vehiculos(id) on delete set null,
  ot_numero          text,
  titulo             text,                -- ej: "BW VF 55 YARIS ANGELO MASS OT 13237"
  servicio_solicitado text,
  observaciones_cliente text,             -- "dolor del cliente"
  estado             text not null default 'por_designar',
  prioridad          text default 'normal',   -- normal | alta | urgente
  asesor_id          uuid references usuarios(id) on delete set null,
  fecha_limite       date,
  historial          jsonb default '[]',  -- [{estado, fecha, por}]
  creado_en          timestamptz default now(),
  cerrado_en         timestamptz
);
create index if not exists ix_tt_empresa on trabajos_taller(empresa_id, estado);
create index if not exists ix_tt_cliente on trabajos_taller(cliente_id);

-- ---- Tareas del trabajo (asignadas a técnicos) ---------------------
create table if not exists tareas_taller (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null default empresa_actual(),
  trabajo_id   uuid not null references trabajos_taller(id) on delete cascade,
  titulo       text not null,
  tecnico_id   uuid references usuarios(id) on delete set null,
  estado       text not null default 'pendiente',  -- pendiente | en_curso | terminada
  observacion  text,                               -- obligatoria al terminar (valida la app)
  iniciada_en  timestamptz,
  terminada_en timestamptz,
  tiempo_seg   integer default 0,                  -- cronómetro acumulado
  orden        integer default 0,
  creada_en    timestamptz default now()
);
create index if not exists ix_tar_trabajo on tareas_taller(trabajo_id);
create index if not exists ix_tar_tecnico on tareas_taller(empresa_id, tecnico_id, estado);

-- ---- Presupuestos solicitados desde el taller ----------------------
create table if not exists presupuestos_taller (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null default empresa_actual(),
  trabajo_id    uuid not null references trabajos_taller(id) on delete cascade,
  numero        text,
  estado        text not null default 'solicitado',
  -- solicitado → cotizando → enviado → aprobado | rechazado | parcial
  items         jsonb default '[]',
  -- [{tipo: repuesto|lubricante|filtro|consumible, detalle, cant, precio, en_stock}]
  monto         bigint default 0,
  notas         text,
  solicitado_por uuid references usuarios(id) on delete set null,
  elaborado_por  uuid references usuarios(id) on delete set null,
  creado_en     timestamptz default now(),
  resuelto_en   timestamptz
);
create index if not exists ix_pt_trabajo on presupuestos_taller(trabajo_id);
create index if not exists ix_pt_estado  on presupuestos_taller(empresa_id, estado);

-- ---- Notificaciones (por usuario o por rol) ------------------------
create table if not exists notificaciones (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null default empresa_actual(),
  usuario_id  uuid references usuarios(id) on delete cascade, -- destinatario directo (o null)
  rol_destino text,                                           -- o todos los de un rol
  titulo      text not null,
  cuerpo      text,
  url         text,
  leida_por   jsonb default '[]',   -- uuids que ya la leyeron (para rol_destino)
  creada_en   timestamptz default now()
);
create index if not exists ix_notif on notificaciones(empresa_id, creada_en desc);

-- ---- RLS ------------------------------------------------------------
alter table trabajos_taller     enable row level security;
alter table tareas_taller       enable row level security;
alter table presupuestos_taller enable row level security;
alter table notificaciones      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['trabajos_taller','tareas_taller','presupuestos_taller','notificaciones'] loop
    execute format('drop policy if exists %I_all on %I', t, t);
    execute format(
      'create policy %I_all on %I for all using (empresa_id = empresa_actual()) with check (empresa_id = empresa_actual())', t, t);
  end loop;
end $$;

-- ---- Estado de gestión "En taller" (catálogo comercial) ------------
insert into cat_estados_gestion (empresa_id, clave, nombre, color, orden, es_cierre, es_ganada) values
 ('00000000-0000-0000-0000-000000000001','en_taller','En taller','#1f9d57',5,false,false)
on conflict (empresa_id, clave) do nothing;

-- ---- Feature "taller" (gating por plan) -----------------------------
insert into features (clave, nombre) values ('taller','Gestión de taller')
on conflict (clave) do nothing;
insert into plan_features (plan_id, feature_id)
select p.id, f.id from planes p, features f
where p.clave in ('professional','enterprise') and f.clave = 'taller'
on conflict do nothing;

-- Listo. Refresca el CRM tras ejecutar.
