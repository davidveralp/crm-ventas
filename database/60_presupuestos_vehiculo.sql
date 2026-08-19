-- ============================================================================
-- Migración 60 — Presupuestos por vehículo (sin trabajo de taller abierto)
-- ============================================================================
--
-- PROBLEMA
-- `presupuestos_taller.trabajo_id` es NOT NULL, así que solo se puede cotizar
-- sobre un vehículo que YA está en el taller. Quedan sin salida tres casos
-- reales y frecuentes:
--   · El cliente llama a preguntar un precio.
--   · Seguimiento de una alerta RADAR roja detectada en una visita anterior.
--   · Cotización preventiva sobre un vehículo conocido.
--
-- SOLUCIÓN
-- `trabajo_id` pasa a ser opcional y se agrega `vehiculo_id` como ancla
-- alternativa. Un presupuesto debe colgar de al menos uno de los dos.
--
-- FLUJO CONFIRMADO CON DAVID
--   El ASESOR solicita (describe qué necesita el cliente).
--   El COORDINADOR DE ADQUISICIONES elabora y valoriza.
--   Se envía al cliente con precios de venta reales (PDF / WhatsApp).
-- Es el mismo circuito N6-N9 que ya opera en taller, extendido al vehículo.
--
-- Requiere: migraciones 56, 57 (RLS por rol) y 59 (RADAR).
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Desacoplar el presupuesto del trabajo de taller
-- ----------------------------------------------------------------------------
alter table public.presupuestos_taller
  alter column trabajo_id drop not null;

alter table public.presupuestos_taller
  add column if not exists vehiculo_id   uuid references vehiculos(id) on delete cascade,
  add column if not exists cliente_id    uuid references clientes(id) on delete set null,
  add column if not exists solicitud     text,        -- qué pidió el asesor, en sus palabras
  add column if not exists origen        text default 'taller',   -- taller | vehiculo | radar
  add column if not exists vigencia_dias int default 15;

comment on column public.presupuestos_taller.solicitud is
  'Descripción del asesor sobre qué necesita el cliente. Es el insumo que el coordinador valoriza.';
comment on column public.presupuestos_taller.origen is
  'taller = nace de un trabajo en curso · vehiculo = cotización sin OT · radar = seguimiento de alerta';

-- Un presupuesto tiene que colgar de algo: trabajo o vehículo.
-- NOT VALID para no bloquear filas históricas que pudieran estar incompletas.
alter table public.presupuestos_taller
  drop constraint if exists presup_ancla_chk;
alter table public.presupuestos_taller
  add constraint presup_ancla_chk
  check (trabajo_id is not null or vehiculo_id is not null) not valid;

create index if not exists ix_pt_vehiculo on presupuestos_taller(vehiculo_id, creado_en desc);
create index if not exists ix_pt_cliente  on presupuestos_taller(cliente_id, estado);


-- ----------------------------------------------------------------------------
-- 2) Rellenar vehiculo_id y cliente_id en los presupuestos existentes
-- ----------------------------------------------------------------------------
-- Los que ya existen cuelgan de un trabajo, que sí conoce el vehículo. Se
-- completa para que la ficha del vehículo los muestre todos, no solo los nuevos.
update presupuestos_taller p
set vehiculo_id = t.vehiculo_id,
    cliente_id  = coalesce(p.cliente_id, t.cliente_id),
    origen      = coalesce(p.origen, 'taller')
from trabajos_taller t
where t.id = p.trabajo_id
  and (p.vehiculo_id is null or p.cliente_id is null);


-- ----------------------------------------------------------------------------
-- 3) Vincular un presupuesto previo a un trabajo nuevo
-- ----------------------------------------------------------------------------
-- Cuando el vehículo por fin entra al taller, la cotización que se hizo antes
-- debe poder engancharse al trabajo en vez de rehacerse.
create or replace function presupuesto_vincular_trabajo(
  p_presupuesto uuid, p_trabajo uuid
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_veh uuid; v_veh_pres uuid;
begin
  select vehiculo_id into v_veh from trabajos_taller where id = p_trabajo;
  select vehiculo_id into v_veh_pres from presupuestos_taller where id = p_presupuesto;

  -- No se vinculan presupuestos de otro vehículo: sería mezclar historias.
  if v_veh is distinct from v_veh_pres then
    raise exception 'El presupuesto es de otro vehículo';
  end if;

  update presupuestos_taller
  set trabajo_id = p_trabajo, origen = 'taller'
  where id = p_presupuesto;

  perform registrar_evento('presupuesto', p_presupuesto, 'vinculado_a_trabajo',
    jsonb_build_object('trabajo_id', p_trabajo));
  return true;
end $$;


-- ----------------------------------------------------------------------------
-- 4) Ítems sugeridos desde las alertas RADAR vigentes
-- ----------------------------------------------------------------------------
-- Devuelve los rojos y amarillos de la ÚLTIMA inspección del vehículo, con el
-- formato de item que usa `presupuestos_taller.items`. El coordinador los
-- valoriza; aquí solo se propone el contenido.
create or replace function radar_items_sugeridos(p_vehiculo uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  with ultima as (
    select id from radar_inspecciones
    where vehiculo_id = p_vehiculo and estado = 'completada'
    order by iniciada_en desc limit 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'tipo', 'repuesto',
           'codigo', '',
           'detalle', cat.nombre || ' · ' || cr.texto ||
                      case when coalesce(r.observacion,'') <> ''
                           then ' (' || r.observacion || ')' else '' end,
           'cant', 1, 'costo', 0, 'precio', 0, 'en_stock', null,
           'severidad', r.severidad
         ) order by cat.orden, cr.orden), '[]'::jsonb)
  from radar_respuestas r
  join ultima u on u.id = r.inspeccion_id
  join radar_criterios cr on cr.codigo = r.criterio_codigo
  join radar_categorias cat on cat.codigo = cr.categoria
  where r.severidad in ('critico','pronto');
$$;


-- ----------------------------------------------------------------------------
-- 5) Oportunidad también para los presupuestos sin trabajo
-- ----------------------------------------------------------------------------
-- Si no, la venta cruzada nacida de una alerta RADAR no se mediría.
create or replace function presupuesto_crear_oportunidad(p_presupuesto uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v record; v_op uuid;
begin
  select * into v from presupuestos_taller where id = p_presupuesto;
  if v is null then return null; end if;

  -- Si ya tiene oportunidad, no se duplica
  select id into v_op from oportunidades where presupuesto_id = p_presupuesto limit 1;
  if v_op is not null then return v_op; end if;

  insert into oportunidades (
    empresa_id, trabajo_id, cliente_id, vehiculo_id,
    titulo, detalle, severidad, monto_estimado,
    asignado_a, presupuesto_id, ofrecida_en
  ) values (
    v.empresa_id, v.trabajo_id, v.cliente_id, v.vehiculo_id,
    coalesce(nullif(v.solicitud,''), 'Presupuesto ' || coalesce(v.numero, left(v.id::text, 6))),
    v.notas,
    case when v.origen = 'radar' then 'pronto' else 'preventivo' end,
    nullif(v.monto, 0),
    v.solicitado_por, v.id, now()
  ) returning id into v_op;

  return v_op;
end $$;


-- ----------------------------------------------------------------------------
-- 6) VERIFICACIÓN
-- ----------------------------------------------------------------------------
select column_name, is_nullable, data_type
from information_schema.columns
where table_schema='public' and table_name='presupuestos_taller'
  and column_name in ('trabajo_id','vehiculo_id','cliente_id','solicitud','origen','vigencia_dias')
order by column_name;

-- Cuántos presupuestos quedaron con vehículo asignado
select origen, count(*) total,
       count(vehiculo_id) con_vehiculo,
       count(trabajo_id)  con_trabajo
from presupuestos_taller group by origen;

select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
  ('presupuesto_vincular_trabajo','radar_items_sugeridos','presupuesto_crear_oportunidad')
order by p.proname;
