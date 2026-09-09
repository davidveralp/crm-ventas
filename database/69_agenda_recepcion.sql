-- ============================================================================
-- Migración 69 — Agenda de taller con capacidad por isla
-- ============================================================================
--
-- CONTEXTO
-- El taller tiene 4 islas. Hoy la agenda vive en ClickUp (estado "agenda", el
-- más usado: 7 de 18 tarjetas) y no hay forma de saber si queda cupo antes de
-- comprometerle una hora al cliente.
--
-- SOBRE LA DURACIÓN
-- Se usa 2 horas por defecto, que es el promedio que indicaste. Pero ClickUp
-- muestra 4,6 vehículos cerrados por día con 4 islas, cuando la capacidad
-- teórica sería 18: la diferencia se explica por espera de repuestos, espera de
-- aprobación y registro tardío de las tarjetas.
--
-- Por eso la duración es POR SERVICIO y editable: cuando el ClickApp de tiempos
-- entregue datos reales (dos semanas), estos valores se ajustan sin tocar código.
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Islas de trabajo
-- ----------------------------------------------------------------------------
create table if not exists islas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null default '00000000-0000-0000-0000-000000000001',
  nombre      text not null,
  orden       int  not null default 0,
  -- Una isla puede estar limitada a cierto trabajo: el elevador de alineación
  -- no sirve para desabolladura.
  admite      text[] default null,   -- null = admite todo
  activa      boolean not null default true
);

insert into islas (nombre, orden) values
  ('Isla 1', 1), ('Isla 2', 2), ('Isla 3', 3), ('Isla 4', 4)
on conflict do nothing;


-- ----------------------------------------------------------------------------
-- 2) Duración estimada por servicio
-- ----------------------------------------------------------------------------
create table if not exists servicio_duracion (
  servicio    text primary key,
  minutos     int not null default 120,
  actualizado timestamptz default now()
);

comment on table servicio_duracion is
  'Minutos que ocupa una isla por servicio. Editable: los valores iniciales son estimaciones a ajustar con los datos del ClickApp de tiempos.';

insert into servicio_duracion (servicio, minutos) values
  ('PACK MANTENCIÓN 360°', 180),
  ('CAMBIO DE ACEITE', 60),
  ('ALINEACION', 60),
  ('PURIFICACIÓN DE AIRE (AIRLIFE)', 45)
on conflict (servicio) do nothing;


-- ----------------------------------------------------------------------------
-- 3) Citas
-- ----------------------------------------------------------------------------
create table if not exists citas (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null default '00000000-0000-0000-0000-000000000001',
  cliente_id   uuid references clientes(id) on delete set null,
  vehiculo_id  uuid references vehiculos(id) on delete set null,
  isla_id      uuid references islas(id) on delete set null,

  -- Datos sueltos para quien agenda sin ficha creada todavía
  nombre_contacto text,
  telefono        text,
  patente         text,

  servicio     text,
  inicia       timestamptz not null,
  minutos      int not null default 120,
  estado       text not null default 'agendada',
  -- agendada | confirmada | llego | no_llego | cancelada | convertida
  canal        text default 'telefono',   -- telefono | whatsapp | presencial | web
  notas        text,

  trabajo_id   uuid references trabajos_taller(id) on delete set null,
  creada_por   uuid references usuarios(id) on delete set null,
  creada_en    timestamptz default now()
);

create index if not exists citas_dia_idx on citas (empresa_id, inicia)
  where estado not in ('cancelada', 'no_llego');
create index if not exists citas_isla_idx on citas (isla_id, inicia);

alter table citas enable row level security;
drop policy if exists citas_sel on citas;
drop policy if exists citas_wri on citas;
create policy citas_sel on citas for select using (empresa_id = empresa_actual());
create policy citas_wri on citas for all using (empresa_id = empresa_actual())
  with check (empresa_id = empresa_actual());

alter table islas enable row level security;
drop policy if exists islas_sel on islas;
drop policy if exists islas_wri on islas;
create policy islas_sel on islas for select using (true);
create policy islas_wri on islas for all using (es_admin_o_jefe()) with check (es_admin_o_jefe());

alter table servicio_duracion enable row level security;
drop policy if exists sdur_sel on servicio_duracion;
drop policy if exists sdur_wri on servicio_duracion;
create policy sdur_sel on servicio_duracion for select using (true);
create policy sdur_wri on servicio_duracion for all using (es_admin_o_jefe()) with check (es_admin_o_jefe());


-- ----------------------------------------------------------------------------
-- 4) Capacidad de un día
-- ----------------------------------------------------------------------------
-- Responde "¿queda cupo?" antes de comprometer una hora con el cliente.
create or replace function capacidad_dia(p_fecha date)
returns table (
  isla_id uuid, isla text, minutos_ocupados int, minutos_disponibles int, citas int
)
language sql stable security definer set search_path = public as $$
  with jornada as (select 540 as total)   -- 9 horas por isla
  select i.id, i.nombre,
         coalesce(sum(c.minutos), 0)::int,
         (select total from jornada) - coalesce(sum(c.minutos), 0)::int,
         count(c.id)::int
  from islas i
  left join citas c on c.isla_id = i.id
       and c.inicia::date = p_fecha
       and c.estado not in ('cancelada', 'no_llego')
  where i.activa
  group by i.id, i.nombre, i.orden
  order by i.orden;
$$;

-- Verificación
select nombre from islas order by orden;
select servicio, minutos from servicio_duracion order by minutos desc;
select * from capacidad_dia(current_date);

notify pgrst, 'reload schema';


-- ============================================================================
-- Mensajes de WhatsApp
-- ============================================================================
-- Didial tiene dos números registrados en Meta:
--   Toyota      +56 9 3740 1051
--   Multimarca  +56 9 8974 8626
-- Cada mensaje guarda por cuál salió, para responder desde el número correcto.

create table if not exists wa_mensajes (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null default '00000000-0000-0000-0000-000000000001',
  telefono      text not null,          -- normalizado: 56912345678
  direccion     text not null,          -- entrante | saliente
  texto         text,
  wa_id         text unique,            -- id de Meta; evita duplicar reintentos
  sucursal      text,
  cliente_id    uuid references clientes(id) on delete set null,
  nombre_perfil text,
  enviado_por   uuid references usuarios(id) on delete set null,
  leido         boolean not null default false,
  recibido_en   timestamptz default now()
);

create index if not exists wa_conversacion_idx on wa_mensajes (telefono, recibido_en desc);
create index if not exists wa_cliente_idx on wa_mensajes (cliente_id, recibido_en desc);
create index if not exists wa_sin_leer_idx on wa_mensajes (empresa_id, recibido_en desc)
  where direccion = 'entrante' and not leido;

alter table wa_mensajes enable row level security;
drop policy if exists wa_sel on wa_mensajes;
drop policy if exists wa_wri on wa_mensajes;
create policy wa_sel on wa_mensajes for select using (empresa_id = empresa_actual());
create policy wa_wri on wa_mensajes for all using (empresa_id = empresa_actual())
  with check (empresa_id = empresa_actual());

-- Última conversación por teléfono, para la bandeja
create or replace view v_wa_conversaciones as
select distinct on (m.telefono)
  m.telefono, m.texto as ultimo_texto, m.direccion as ultima_direccion,
  m.recibido_en as ultima_fecha, m.nombre_perfil, m.sucursal,
  c.id as cliente_id, c.nombre, c.apellidos,
  (select count(*) from wa_mensajes x
    where x.telefono = m.telefono and x.direccion = 'entrante' and not x.leido) as sin_leer,
  -- Dentro de 24 h se puede escribir libre; fuera, solo plantilla aprobada.
  (select max(recibido_en) from wa_mensajes y
    where y.telefono = m.telefono and y.direccion = 'entrante')
    > now() - interval '24 hours' as ventana_abierta
from wa_mensajes m
left join clientes c on c.id = m.cliente_id
order by m.telefono, m.recibido_en desc;

notify pgrst, 'reload schema';
