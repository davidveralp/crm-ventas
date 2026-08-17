-- ============================================================================
-- Migración 58 — F1b · `oportunidades` + `eventos` + estados calculados
-- ============================================================================
--
-- HALLAZGO PREVIO: los "hallazgos" ya existen
-- `diagnosticos_taller` (migración 24) ya tiene item, severidad
-- (critico | pronto | preventivo | ok), recomendación y técnico. Es exactamente
-- la entidad "hallazgo" de la especificación. NO se crea una tabla nueva: se le
-- agrega el vínculo comercial que le falta.
--
-- QUÉ APORTA ESTA MIGRACIÓN
-- Hoy el circuito se corta en un punto concreto: el técnico registra un
-- diagnóstico, y de ahí en adelante nadie sabe qué pasó con él. No hay forma de
-- responder "¿cuántos hallazgos críticos se convirtieron en venta?", que es la
-- pregunta que originó todo el módulo.
--
-- `oportunidades` es la pieza faltante: el puente entre el hallazgo técnico y la
-- venta. Un hallazgo que no se ofrece es una pérdida invisible; una oportunidad
-- registra el ofrecimiento y su desenlace.
--
-- DECISIÓN SOBRE `eventos` vs `auditoria` (C4 de la Fase 0)
-- No se unifican, tal como se resolvió en Fase 0:
--   `auditoria`  → diffs campo a campo: "¿quién cambió este monto?"
--   `eventos`    → hechos del flujo con payload jsonb: "¿qué pasó con esta
--                  oportunidad?"
-- Son dos preguntas distintas. Una tabla que sirva a ambas sirve mal a las dos.
--
-- Requiere: migraciones 55, 56 y 57 (roles y RLS por rol).
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) `eventos` — log append-only de hechos del flujo
-- ----------------------------------------------------------------------------
create table if not exists eventos (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null default '00000000-0000-0000-0000-000000000001',
  entidad      text not null,          -- 'oportunidad' | 'trabajo' | 'presupuesto' | 'inspeccion'
  entidad_id   uuid not null,
  tipo         text not null,          -- 'creada' | 'ofrecida' | 'aprobada' | ...
  actor_id     uuid references usuarios(id) on delete set null,
  payload      jsonb default '{}',     -- contexto libre del hecho
  ocurrido_en  timestamptz default now()
);

comment on table eventos is
  'Log append-only de hechos del flujo operativo. NO reemplaza a `auditoria`, que registra diffs de campo.';

create index if not exists ix_eventos_entidad on eventos(empresa_id, entidad, entidad_id, ocurrido_en desc);
create index if not exists ix_eventos_tipo    on eventos(empresa_id, tipo, ocurrido_en desc);

-- Append-only de verdad: sin políticas de UPDATE ni DELETE, nadie puede
-- reescribir la historia. Es el punto de tener un log separado.
alter table eventos enable row level security;
drop policy if exists eventos_sel on eventos;
drop policy if exists eventos_ins on eventos;
create policy eventos_sel on eventos
  for select using (empresa_id = empresa_actual());
create policy eventos_ins on eventos
  for insert with check (empresa_id = empresa_actual());

-- Helper para registrar sin repetir el insert en cada lugar
create or replace function registrar_evento(
  p_entidad text, p_entidad_id uuid, p_tipo text, p_payload jsonb default '{}'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into eventos (empresa_id, entidad, entidad_id, tipo, actor_id, payload)
  values (coalesce(empresa_actual(), '00000000-0000-0000-0000-000000000001'),
          p_entidad, p_entidad_id, p_tipo, auth.uid(), coalesce(p_payload, '{}'))
  returning id into v_id;
  return v_id;
end $$;


-- ----------------------------------------------------------------------------
-- 2) `oportunidades` — el puente entre el hallazgo y la venta
-- ----------------------------------------------------------------------------
create table if not exists oportunidades (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null default '00000000-0000-0000-0000-000000000001',

  -- Origen: de dónde salió la oportunidad
  diagnostico_id  uuid references diagnosticos_taller(id) on delete set null,
  trabajo_id      uuid references trabajos_taller(id) on delete set null,
  cliente_id      uuid references clientes(id) on delete cascade,
  vehiculo_id     uuid references vehiculos(id) on delete set null,

  -- Contenido
  titulo          text not null,
  detalle         text,
  severidad       text default 'preventivo',   -- critico | pronto | preventivo
  monto_estimado  numeric(12,0),

  -- Responsables
  detectado_por   uuid references usuarios(id) on delete set null,  -- técnico
  asignado_a      uuid references usuarios(id) on delete set null,  -- asesor

  -- Estado: se CALCULA desde los hijos (ver punto 3). No se escribe a mano.
  estado          text not null default 'detectada',
  -- detectada -> ofrecida -> presupuestada -> aprobada | rechazada | postergada

  presupuesto_id  uuid references presupuestos_taller(id) on delete set null,
  motivo_cierre   text,

  detectada_en    timestamptz default now(),
  ofrecida_en     timestamptz,
  cerrada_en      timestamptz
);

comment on table oportunidades is
  'Puente entre el hallazgo técnico (diagnosticos_taller) y la venta. Permite medir conversión de venta cruzada.';
comment on column oportunidades.estado is
  'Calculado por trigger desde el presupuesto asociado. No escribir directamente.';

create index if not exists ix_oport_estado   on oportunidades(empresa_id, estado, detectada_en desc);
create index if not exists ix_oport_cliente  on oportunidades(empresa_id, cliente_id);
create index if not exists ix_oport_asignado on oportunidades(empresa_id, asignado_a, estado);
create index if not exists ix_oport_diag     on oportunidades(diagnostico_id);

-- RLS por rol, con el mismo criterio de la migración 56:
-- lectura amplia, escritura según responsabilidad.
alter table oportunidades enable row level security;
do $$
declare r record;
begin
  for r in select policyname from pg_policies
           where schemaname='public' and tablename='oportunidades' loop
    execute format('drop policy if exists %I on public.oportunidades', r.policyname);
  end loop;
end $$;

create policy oportunidades_sel on oportunidades
  for select using (empresa_id = empresa_actual());

-- El técnico puede crear una oportunidad (es quien detecta el hallazgo)
create policy oportunidades_ins on oportunidades
  for insert with check (empresa_id = empresa_actual()
    and (es_admin() or es_taller() or es_asesor() or es_adquisiciones()));

-- Pero solo el asesor, el jefe y adquisiciones la gestionan comercialmente
create policy oportunidades_upd on oportunidades
  for update using (empresa_id = empresa_actual()
    and (es_admin() or es_asesor() or auth_rol_en(array['jefe_taller']) or es_adquisiciones()))
  with check (empresa_id = empresa_actual());

create policy oportunidades_del on oportunidades
  for delete using (empresa_id = empresa_actual() and es_admin_o_jefe());


-- ----------------------------------------------------------------------------
-- 3) Estado calculado desde los hijos
-- ----------------------------------------------------------------------------
-- El estado NO se escribe a mano: se deriva del presupuesto asociado. Así no
-- puede quedar en 'ofrecida' cuando su presupuesto ya fue aprobado, que es el
-- desincronizado clásico cuando el estado es un campo libre.

create or replace function oportunidad_estado_calculado(p_oportunidad uuid)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_pres_estado text;
  v_ofrecida timestamptz;
  v_motivo text;
begin
  select p.estado, o.ofrecida_en, o.motivo_cierre
    into v_pres_estado, v_ofrecida, v_motivo
  from oportunidades o
  left join presupuestos_taller p on p.id = o.presupuesto_id
  where o.id = p_oportunidad;

  -- Un cierre explícito manda sobre todo lo demás
  if v_motivo is not null and v_motivo <> '' then
    return case when v_motivo ilike '%poster%' then 'postergada' else 'rechazada' end;
  end if;

  if v_pres_estado is null then
    return case when v_ofrecida is not null then 'ofrecida' else 'detectada' end;
  end if;

  return case v_pres_estado
    when 'aprobado'   then 'aprobada'
    when 'parcial'    then 'aprobada'
    when 'rechazado'  then 'rechazada'
    when 'enviado'    then 'presupuestada'
    when 'cotizando'  then 'presupuestada'
    when 'solicitado' then 'ofrecida'
    else 'detectada'
  end;
end $$;

-- Recalcula y registra el cambio en `eventos` solo si el estado cambió.
create or replace function oportunidad_sincronizar(p_oportunidad uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare v_nuevo text; v_actual text;
begin
  select estado into v_actual from oportunidades where id = p_oportunidad;
  v_nuevo := oportunidad_estado_calculado(p_oportunidad);
  if v_nuevo is distinct from v_actual then
    update oportunidades set
      estado = v_nuevo,
      cerrada_en = case when v_nuevo in ('aprobada','rechazada','postergada')
                        then coalesce(cerrada_en, now()) else null end
    where id = p_oportunidad;
    perform registrar_evento('oportunidad', p_oportunidad, 'estado_' || v_nuevo,
                             jsonb_build_object('anterior', v_actual, 'nuevo', v_nuevo));
  end if;
  return v_nuevo;
end $$;

-- Cuando cambia el estado del presupuesto, se recalculan las oportunidades
-- que lo apuntan.
create or replace function trg_presupuesto_sincroniza_oportunidad()
returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from oportunidades where presupuesto_id = new.id loop
    perform oportunidad_sincronizar(r.id);
  end loop;
  return new;
end $$;

drop trigger if exists tg_pres_sync_oport on presupuestos_taller;
create trigger tg_pres_sync_oport
  after update of estado on presupuestos_taller
  for each row execute function trg_presupuesto_sincroniza_oportunidad();

-- Cuando la propia oportunidad cambia (se le vincula un presupuesto, se cierra
-- a mano, se marca como ofrecida), también hay que recalcular su estado.
--
-- Sobre la recursión: este trigger es AFTER UPDATE OF sobre presupuesto_id,
-- motivo_cierre y ofrecida_en. `oportunidad_sincronizar` solo escribe `estado` y
-- `cerrada_en`, que NO están en esa lista, así que el UPDATE interno no vuelve a
-- disparar el trigger. Es la razón de acotar las columnas vigiladas en vez de
-- usar un AFTER UPDATE genérico.
create or replace function trg_oportunidad_recalcular()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform oportunidad_sincronizar(new.id);
  return null;
end $$;

drop trigger if exists tg_oport_autoestado on oportunidades;
create trigger tg_oport_autoestado
  after update of presupuesto_id, motivo_cierre, ofrecida_en on oportunidades
  for each row execute function trg_oportunidad_recalcular();


-- ----------------------------------------------------------------------------
-- 4) Registro automático de eventos en el flujo
-- ----------------------------------------------------------------------------
create or replace function trg_oportunidad_creada()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform registrar_evento('oportunidad', new.id, 'creada',
    jsonb_build_object('titulo', new.titulo, 'severidad', new.severidad,
                       'monto_estimado', new.monto_estimado,
                       'origen', case when new.diagnostico_id is not null
                                      then 'diagnostico' else 'manual' end));
  return new;
end $$;

drop trigger if exists tg_oport_creada on oportunidades;
create trigger tg_oport_creada after insert on oportunidades
  for each row execute function trg_oportunidad_creada();


-- ----------------------------------------------------------------------------
-- 5) Vista de conversión de venta cruzada — la métrica que motivó el módulo
-- ----------------------------------------------------------------------------
create or replace view v_conversion_oportunidades as
select
  date_trunc('month', o.detectada_en)::date            as mes,
  o.severidad,
  count(*)                                             as detectadas,
  count(*) filter (where o.ofrecida_en is not null)     as ofrecidas,
  count(*) filter (where o.estado = 'aprobada')         as aprobadas,
  count(*) filter (where o.estado = 'rechazada')        as rechazadas,
  count(*) filter (where o.estado = 'detectada')        as sin_ofrecer,
  sum(o.monto_estimado)                                as monto_detectado,
  sum(o.monto_estimado) filter (where o.estado='aprobada') as monto_aprobado,
  round(100.0 * count(*) filter (where o.ofrecida_en is not null)
        / nullif(count(*), 0), 1)                      as pct_ofrecimiento,
  round(100.0 * count(*) filter (where o.estado='aprobada')
        / nullif(count(*) filter (where o.ofrecida_en is not null), 0), 1) as pct_cierre
from oportunidades o
group by 1, 2
order by 1 desc, 2;

comment on view v_conversion_oportunidades is
  'Conversión de venta cruzada por mes y severidad. `sin_ofrecer` es la pérdida invisible: hallazgos que nunca llegaron al cliente.';


-- ----------------------------------------------------------------------------
-- 6) VERIFICACIÓN
-- ----------------------------------------------------------------------------
select table_name from information_schema.tables
where table_schema='public' and table_name in ('oportunidades','eventos')
order by table_name;

select tablename, count(*) politicas, string_agg(cmd, ', ' order by cmd) comandos
from pg_policies
where schemaname='public' and tablename in ('oportunidades','eventos')
group by tablename;

-- `eventos` debe tener SOLO select e insert (append-only)
select policyname, cmd from pg_policies
where schemaname='public' and tablename='eventos' order by cmd;

select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
  ('registrar_evento','oportunidad_estado_calculado','oportunidad_sincronizar')
order by p.proname;
