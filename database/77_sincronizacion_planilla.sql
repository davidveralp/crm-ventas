-- ============================================================================
-- Migración 77 — Sincronización con la planilla histórica de OT
-- ============================================================================
--
-- LA PLANILLA
-- 1UTgOhJ5fffCfx3RdArmFD-2z3WOCnUNMyfhKu9w59KQ · 52 columnas, desde 2024.
-- Es la base histórica del negocio y debe seguir alimentándose.
--
-- FLUJO DE LA INFORMACIÓN
--   Recepción      → crea/actualiza cliente y vehículo
--   Nuevo Ingreso  → crea la OT tomando lo que ya cargó Recepción
--   Pendiente de cierre → completa montos, documento y entrega
--          ↓
--   Cada paso actualiza la MISMA fila de la planilla, identificada por
--   N° Orden Trabajo. No se agregan filas nuevas al cerrar.
--
-- POR QUÉ UNA COLA Y NO ENVÍO DIRECTO
-- Si la planilla no responde —Google caído, cuota agotada, red del taller—
-- el envío directo perdería el dato o bloquearía la entrega del vehículo.
-- La cola registra qué falta enviar y reintenta después.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Cola de sincronización
-- ----------------------------------------------------------------------------
create table if not exists sync_planilla (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null default '00000000-0000-0000-0000-000000000001',
  trabajo_id   uuid references trabajos_taller(id) on delete cascade,
  ot_numero    text not null,

  -- ingreso | cierre. Define qué columnas se escriben.
  etapa        text not null,
  estado       text not null default 'pendiente',  -- pendiente | enviado | error
  intentos     int  not null default 0,
  ultimo_error text,

  enviado_en   timestamptz,
  creado_en    timestamptz default now()
);

create index if not exists sync_pendientes_idx
  on sync_planilla (creado_en) where estado <> 'enviado';
create unique index if not exists sync_ot_etapa_uniq
  on sync_planilla (ot_numero, etapa);

alter table sync_planilla enable row level security;
drop policy if exists sync_sel on sync_planilla;
drop policy if exists sync_wri on sync_planilla;
create policy sync_sel on sync_planilla for select using (empresa_id = empresa_actual());
create policy sync_wri on sync_planilla for all using (empresa_id = empresa_actual())
  with check (empresa_id = empresa_actual());


-- ----------------------------------------------------------------------------
-- 2) Vista con las 52 columnas de la planilla
-- ----------------------------------------------------------------------------
-- Arma la fila completa desde el CRM. Tener esto en la base y no en el
-- frontend evita que cada panel construya su propia versión de la fila.
create or replace view v_planilla_ot as
select
  t.id                                          as trabajo_id,
  t.ot_numero                                   as "N° Orden Trabajo",
  to_char(t.creado_en, 'YYYY-MM-DD')            as "F. Ingreso",
  extract(month from t.creado_en)::int          as "Mes Ingreso",
  extract(year  from t.creado_en)::int          as "Año Ingreso",
  v.patente                                     as "Patente",
  v.marca                                       as "Marca",
  v.modelo                                      as "Modelo",
  v.cilindrada                                  as "Cilindrada",
  v.anio                                        as "Año",
  t.km_ingreso                                  as "Kilometraje",
  upper(coalesce(c.tipo, 'PARTICULAR'))         as "Tipo Cliente",
  upper(trim(coalesce(c.nombre,'') || ' ' || coalesce(c.apellidos,''))) as "Propietario",
  c.telefono                                    as "Teléfono",
  c.email                                       as "E-Mail",
  c.ciudad                                      as "Ciudad",
  ua.nombre                                     as "Asesor de Servicio",
  t.tipo_ingreso                                as "Tipo de Ingreso",

  -- Técnico principal: el que tiene más tareas en la OT. Los demás van como
  -- secundarios, que es como lo registra la planilla histórica.
  (select coalesce(u.nombre, ta.tecnico_nombre)
     from tareas_taller ta left join usuarios u on u.id = ta.tecnico_id
    where ta.trabajo_id = t.id and (ta.tecnico_id is not null or ta.tecnico_nombre is not null)
    group by u.nombre, ta.tecnico_nombre order by count(*) desc limit 1) as "Técnico Principal",
  (select string_agg(distinct coalesce(u.nombre, ta.tecnico_nombre), ', ')
     from tareas_taller ta left join usuarios u on u.id = ta.tecnico_id
    where ta.trabajo_id = t.id)                 as "Técnicos Secundarios",

  coalesce(t.monto_repuestos, 0)                as "Monto Repuestos",
  coalesce(t.monto_lubricantes, 0)              as "Monto Lubricantes",
  coalesce(t.monto_mano_obra, 0)                as "Monto Mano de Obra",
  coalesce(t.monto_servicio_ext, 0)             as "Monto Servicio Externo",
  (select string_agg(d.detalle, ' · ') from ot_detalle d
    where d.trabajo_id = t.id and d.tipo = 'servicio_externo') as "Desc Servicio Externo",
  coalesce(t.descuento, 0)                      as "Descuento",
  coalesce(t.monto_total, 0)                    as "Total Reparación",

  split_part(coalesce(t.servicio_solicitado,''), ' · ', 1) as "Tipo Servicio 1",
  split_part(coalesce(t.servicio_solicitado,''), ' · ', 2) as "Tipo Servicio 2",
  t.categoria_servicio                          as "Unidades de Negocio",
  t.estado                                      as "Estado Vehículo",
  to_char(t.entregado_en, 'DD/MM/YYYY')         as "Fecha Entrega",
  t.tipo_documento                              as "Tipo Documento",
  t.nro_documento                               as "N° Documento",
  t.sucursal                                    as "Sucursal",
  ua.email                                      as "Email Asesor",

  case when e.id is not null then 'Sí' else 'No' end as "Encuesta Aplica",
  e.p_plazo                                     as "Enc. P1 Entrega a tiempo",
  e.p_atencion                                  as "Enc. P2 Atención cliente",
  e.p_calidad                                   as "Enc. P3 Servicio mecánico",
  e.nps                                         as "Enc. P4 Recomendaría",
  i.conocio                                     as "Enc. Cómo conoció DIDIAL",

  case when p.id is not null then 'Sí' else 'No' end as "¿Solicitó Presupuesto?",
  p.numero                                      as "N° Presupuesto",
  case when p.estado = 'aprobado' then 'Sí'
       when p.estado = 'rechazado' then 'No'
       when p.id is not null then 'Pendiente' end as "¿Aprobó Presupuesto?",
  p.solicitud                                   as "Detalle Presupuestos",
  e.nps                                         as "N.P.S",

  -- Permanencia en días con un decimal, como en la planilla
  case when t.entregado_en is not null
       then round(extract(epoch from (t.entregado_en - t.creado_en)) / 86400.0, 2)
  end                                           as "Permanencia"
from trabajos_taller t
left join vehiculos v on v.id = t.vehiculo_id
left join clientes  c on c.id = t.cliente_id
left join usuarios ua on ua.id = t.asesor_id
left join inspecciones_ingreso i on i.id = t.inspeccion_id
left join encuestas e on e.trabajo_id = t.id
left join lateral (
  select * from presupuestos_taller px
   where px.trabajo_id = t.id order by px.creado_en limit 1
) p on true;

comment on view v_planilla_ot is
  'Fila de la planilla histórica armada desde el CRM. Una sola definición para que todos los paneles envíen lo mismo.';


-- ----------------------------------------------------------------------------
-- 3) Columnas que faltaban para completar la planilla
-- ----------------------------------------------------------------------------
alter table public.trabajos_taller
  add column if not exists categoria_servicio text,
  add column if not exists asesor_id uuid references usuarios(id) on delete set null;

alter table public.vehiculos
  add column if not exists cilindrada text;


-- ----------------------------------------------------------------------------
-- 4) Encolar automáticamente
-- ----------------------------------------------------------------------------
create or replace function trg_encolar_planilla()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ot_numero is null then return new; end if;

  -- Al crear: etapa ingreso. Al cerrar: etapa cierre.
  if tg_op = 'INSERT' then
    insert into sync_planilla (empresa_id, trabajo_id, ot_numero, etapa)
    values (new.empresa_id, new.id, new.ot_numero, 'ingreso')
    on conflict (ot_numero, etapa) do nothing;

  elsif new.cierre_estado = 'cerrado' and coalesce(old.cierre_estado,'') <> 'cerrado' then
    insert into sync_planilla (empresa_id, trabajo_id, ot_numero, etapa)
    values (new.empresa_id, new.id, new.ot_numero, 'cierre')
    on conflict (ot_numero, etapa) do update
      set estado = 'pendiente', intentos = 0, ultimo_error = null;
  end if;

  return new;
end $$;

drop trigger if exists tg_encolar_planilla_ins on trabajos_taller;
create trigger tg_encolar_planilla_ins
  after insert on trabajos_taller
  for each row execute function trg_encolar_planilla();

drop trigger if exists tg_encolar_planilla_upd on trabajos_taller;
create trigger tg_encolar_planilla_upd
  after update of cierre_estado on trabajos_taller
  for each row execute function trg_encolar_planilla();


-- Verificación
select count(*) as en_cola from sync_planilla where estado <> 'enviado';
select * from v_planilla_ot limit 1;

notify pgrst, 'reload schema';
