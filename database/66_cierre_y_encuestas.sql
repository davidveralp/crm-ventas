-- ============================================================================
-- Migración 66 — Cierre del ciclo: entrega, datos de salida y encuesta automática
-- ============================================================================
--
-- QUÉ RESUELVE
-- El ciclo del asesor estaba abierto por el medio: entregaba el vehículo al
-- taller y no volvía a saber de él hasta llenar Nueva OT con los datos de
-- cierre. Entremedio no tenía visibilidad, y la encuesta la transcribía él
-- mismo de lo que el cliente le decía en el mostrador.
--
-- Ahora:
--   taller marca "listo para entrega"
--     → el vehículo aparece en "Pendientes de cierre" del asesor
--       → el asesor registra los datos de salida (documento, montos, entrega)
--         → al día siguiente sale la encuesta por correo, sola
--           → las respuestas alimentan el panel de postventa de administración
--
-- SOBRE LA ENCUESTA
-- Se elimina la captura manual. Un asesor preguntando "¿cómo lo hicimos?" cara
-- a cara obtiene respuestas condescendientes: el NPS del panel marca +100, que
-- no es un dato, es el sesgo. Enviarla por correo al día siguiente da margen
-- para que el cliente use el vehículo y responda sin la presión de tener al
-- asesor delante. El número va a bajar, y ese número bajo es el real.
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Datos de salida en el trabajo de taller
-- ----------------------------------------------------------------------------
alter table public.trabajos_taller
  add column if not exists cierre_estado      text default 'en_proceso',
  -- en_proceso | pendiente_cierre | cerrado
  add column if not exists tipo_documento     text,
  add column if not exists nro_documento      text,
  add column if not exists monto_repuestos    numeric(12,0),
  add column if not exists monto_lubricantes  numeric(12,0),
  add column if not exists monto_mano_obra    numeric(12,0),
  add column if not exists monto_servicio_ext numeric(12,0),
  add column if not exists descuento          numeric(12,0),
  add column if not exists monto_total        numeric(12,0),
  add column if not exists entregado_en       timestamptz,
  add column if not exists entregado_por      uuid references usuarios(id) on delete set null,
  add column if not exists retira_nombre      text,
  add column if not exists observaciones_entrega text;

comment on column public.trabajos_taller.cierre_estado is
  'en_proceso = en taller · pendiente_cierre = listo, falta registrar salida · cerrado = entregado y documentado.';

create index if not exists tt_cierre_idx
  on public.trabajos_taller (cierre_estado, asesor_id) where cierre_estado <> 'cerrado';

-- Al pasar a "listo para entrega", el trabajo entra a la bandeja del asesor.
-- Se hace por trigger y no en el frontend porque el cambio de estado puede
-- venir del CRM o de ClickUp: en el frontend habría que duplicar la lógica.
create or replace function trg_trabajo_pendiente_cierre()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado in ('listo_entrega', 'completada')
     and coalesce(new.cierre_estado, 'en_proceso') = 'en_proceso' then
    new.cierre_estado := 'pendiente_cierre';
    -- Aviso al asesor que recibió el vehículo. Si no hay asesor asignado, va
    -- al rol para que alguien lo tome en vez de quedar sin destinatario.
    insert into notificaciones (empresa_id, usuario_id, rol_destino, titulo, cuerpo, url)
    values (
      new.empresa_id,
      new.asesor_id,
      case when new.asesor_id is null then 'asesor_multimarca' else null end,
      'Vehículo listo para entrega',
      coalesce(new.titulo, 'Trabajo de taller') || ' · registrar datos de salida',
      '/cierres'
    );
  end if;
  return new;
end $$;

drop trigger if exists tg_trabajo_pendiente_cierre on trabajos_taller;
create trigger tg_trabajo_pendiente_cierre
  before update of estado on trabajos_taller
  for each row execute function trg_trabajo_pendiente_cierre();


-- ----------------------------------------------------------------------------
-- 2) Encuestas: se programan al cerrar, se envían al día siguiente
-- ----------------------------------------------------------------------------
create table if not exists encuestas (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null default '00000000-0000-0000-0000-000000000001',
  trabajo_id    uuid references trabajos_taller(id) on delete cascade,
  cliente_id    uuid references clientes(id) on delete cascade,
  vehiculo_id   uuid references vehiculos(id) on delete set null,
  asesor_id     uuid references usuarios(id) on delete set null,
  token         text unique not null default encode(gen_random_bytes(16), 'hex'),

  estado        text not null default 'programada',
  -- programada | enviada | respondida | rebotada | descartada
  enviar_desde  timestamptz not null,
  enviada_en    timestamptz,
  respondida_en timestamptz,

  -- Respuestas. nps 0-10; el resto 1-5.
  nps           int,
  p_calidad     int,
  p_plazo       int,
  p_atencion    int,
  comentario    text,
  email         text,

  creada_en     timestamptz default now(),
  constraint enc_nps_chk check (nps is null or nps between 0 and 10)
);

comment on table encuestas is
  'Encuesta de satisfacción enviada por correo al día siguiente de la entrega. Reemplaza la captura manual del asesor, que producía respuestas condescendientes.';

create index if not exists encuestas_pendientes_idx
  on encuestas (enviar_desde) where estado = 'programada';
create index if not exists encuestas_cliente_idx on encuestas (cliente_id, creada_en desc);
create index if not exists encuestas_asesor_idx  on encuestas (asesor_id, estado);

alter table encuestas enable row level security;
drop policy if exists encuestas_sel on encuestas;
drop policy if exists encuestas_ins on encuestas;
drop policy if exists encuestas_upd on encuestas;
create policy encuestas_sel on encuestas for select using (empresa_id = empresa_actual());
create policy encuestas_ins on encuestas for insert with check (empresa_id = empresa_actual());
create policy encuestas_upd on encuestas for update using (empresa_id = empresa_actual())
  with check (empresa_id = empresa_actual());

-- Al cerrar el trabajo se programa la encuesta para el día siguiente.
create or replace function trg_programar_encuesta()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if new.cierre_estado = 'cerrado' and coalesce(old.cierre_estado,'') <> 'cerrado' then
    select c.email into v_email from clientes c where c.id = new.cliente_id;
    -- Sin correo no hay encuesta que enviar: se registra igual para que el
    -- panel muestre cuántas se pierden por falta de contacto.
    insert into encuestas (empresa_id, trabajo_id, cliente_id, vehiculo_id, asesor_id,
                           enviar_desde, email, estado)
    values (new.empresa_id, new.id, new.cliente_id, new.vehiculo_id, new.asesor_id,
            date_trunc('day', now()) + interval '1 day' + interval '10 hours',
            v_email,
            case when coalesce(v_email,'') = '' then 'descartada' else 'programada' end);
  end if;
  return new;
end $$;

drop trigger if exists tg_programar_encuesta on trabajos_taller;
create trigger tg_programar_encuesta
  after update of cierre_estado on trabajos_taller
  for each row execute function trg_programar_encuesta();


-- ----------------------------------------------------------------------------
-- 3) Vistas para el panel de postventa
-- ----------------------------------------------------------------------------
create or replace view v_postventa as
select
  e.id, e.estado, e.nps, e.p_calidad, e.p_plazo, e.p_atencion, e.comentario,
  e.enviada_en, e.respondida_en, e.creada_en,
  case when e.nps >= 9 then 'promotor'
       when e.nps >= 7 then 'pasivo'
       when e.nps is not null then 'detractor' end as categoria,
  c.id as cliente_id, c.nombre, c.apellidos, c.telefono, c.email as cliente_email,
  v.patente, v.marca, v.modelo,
  u.nombre as asesor,
  t.id as trabajo_id, t.titulo, t.monto_total, t.entregado_en
from encuestas e
left join clientes c on c.id = e.cliente_id
left join vehiculos v on v.id = e.vehiculo_id
left join usuarios u on u.id = e.asesor_id
left join trabajos_taller t on t.id = e.trabajo_id;

comment on view v_postventa is
  'Base del panel de postventa. `categoria` sigue el criterio NPS estándar: 9-10 promotor, 7-8 pasivo, 0-6 detractor.';

-- Verificación
select table_name from information_schema.tables
where table_schema='public' and table_name = 'encuestas';

select count(*) filter (where cierre_estado = 'pendiente_cierre') as pendientes_cierre,
       count(*) filter (where cierre_estado = 'cerrado')          as cerrados,
       count(*)                                                    as total
from trabajos_taller;

notify pgrst, 'reload schema';


-- ----------------------------------------------------------------------------
-- 4) Despacho automático diario (pg_cron)
-- ----------------------------------------------------------------------------
-- Llama a la Edge Function `enviar-encuestas` cada día a las 10:00. Ejecutar
-- DESPUÉS de desplegar la función.
--
-- Reemplazar <PROJECT_REF> y <SERVICE_ROLE_KEY> por los del proyecto.
-- Descomentar para activar.

-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule(
--   'encuestas-diarias', '0 10 * * *',
--   $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/enviar-encuestas',
--     headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
--     body := '{"accion":"despachar"}'::jsonb
--   );
--   $$
-- );

-- Para ver las tareas programadas:  select * from cron.job;
-- Para desactivarla:                select cron.unschedule('encuestas-diarias');
--
-- ALTERNATIVA SIN pg_cron: un botón en el panel de postventa que despache a
-- mano. Menos automático, pero no depende de extensiones del proyecto.
