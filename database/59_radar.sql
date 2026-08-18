-- ============================================================================
-- Migración 59 — RADAR de Salud Vehicular: catálogo, inspecciones y alertas
-- ============================================================================
--
-- ORIGEN
-- Catálogo extraído del formulario "RADAR DE SALUD VEHICULAR" de ClickUp
-- (espacio SERVICIO TECNICO, lista 901328193477). 45 criterios en 8 categorías.
--
-- CORRECCIÓN DE DISEÑO RESPECTO DEL FORMULARIO DE CLICKUP
-- El formulario tiene 8 campos desplegables llamados "Radar a Revisar"
-- (1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1), cada uno con las MISMAS 8 opciones
-- (TREN DELANTERO, TREN TRASERO, …). Son ocho selecciones redundantes que el
-- técnico debe llenar sin que aporten información: la categoría ya está
-- implícita en la numeración del criterio.
--
-- Aquí la categoría es una TABLA (`radar_categorias`), no un campo a completar.
-- El técnico no elige la categoría: la ve como encabezado de sección. Son ocho
-- interacciones menos por inspección.
--
-- SEMÁFORO
-- Los colores de ClickUp se traducen a severidad, que es el mismo vocabulario
-- que ya usa `diagnosticos_taller`:
--     #e5484d rojo     → critico
--     #ffc53d amarillo → pronto
--     #30a46c verde    → ok
--     #cecece gris     → na (no aplica)
--
-- Requiere: migración 58 (oportunidades y eventos).
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Catálogo: categorías y criterios
-- ----------------------------------------------------------------------------
create table if not exists radar_categorias (
  codigo  text primary key,
  nombre  text not null,
  orden   int  not null default 0,
  activa  boolean not null default true
);

create table if not exists radar_criterios (
  id            uuid primary key default gen_random_uuid(),
  categoria     text not null references radar_categorias(codigo) on delete cascade,
  codigo        text not null unique,          -- '1.2', '5.9.1'
  texto         text not null,
  -- opciones: [{"t":"texto visible","s":"critico|pronto|ok|na"}]
  opciones      jsonb not null default '[]',
  orden         int not null default 0,
  activo        boolean not null default true
);

create index if not exists ix_radar_crit_cat on radar_criterios(categoria, orden);

insert into radar_categorias (codigo, nombre, orden) values
  ('TREN_DELANTERO', 'Tren delantero', 1),
  ('TREN_TRASERO', 'Tren trasero', 2),
  ('SUSPENSION', 'Suspensión', 3),
  ('RUEDAS', 'Ruedas', 4),
  ('FRENOS', 'Frenos', 5),
  ('ENGRASE', 'Engrase', 6),
  ('LUCES', 'Luces', 7),
  ('MOTOR', 'Compartimiento de motor', 8)
on conflict (codigo) do update set nombre = excluded.nombre, orden = excluded.orden;

insert into radar_criterios (categoria, codigo, texto, opciones) values
('TREN_DELANTERO', '1.2', 'Rueda holgura vertical', '[{"t":"SI / Diagnosticar","s":"critico"}, {"t":"NO","s":"ok"}]'::jsonb),
  ('TREN_DELANTERO', '1.3', 'Rueda holgura horizontal', '[{"t":"SI/Diagnosticar","s":"critico"}, {"t":"NO","s":"ok"}]'::jsonb),
  ('TREN_DELANTERO', '1.4', 'Holgura en bieletas', '[{"t":"SI/Reemplazar","s":"critico"}, {"t":"NO","s":"ok"}]'::jsonb),
  ('TREN_DELANTERO', '1.5', 'Giro de rueda (ruido)', '[{"t":"SI/Diagnosticar","s":"critico"}, {"t":"NO","s":"ok"}]'::jsonb),
  ('TREN_DELANTERO', '1.6', 'Defecto de bujes', '[{"t":"SI","s":"critico"}, {"t":"NO","s":"ok"}]'::jsonb),
  ('TREN_DELANTERO', '1.7', 'Altura carrocería', '[{"t":"DISPAREJA/Diagnosticar","s":"critico"}, {"t":"NORMAL","s":"ok"}]'::jsonb),
  ('TREN_TRASERO', '2.2', 'Rueda holgura vertical', '[{"t":"SI/Diagnosticar","s":"critico"}, {"t":"NO","s":"ok"}]'::jsonb),
  ('TREN_TRASERO', '2.3', 'Rueda holgura horizontal', '[{"t":"SI/Diagnosticar","s":"critico"}, {"t":"NO","s":"ok"}]'::jsonb),
  ('TREN_TRASERO', '2.4', 'Holgura en bieletas', '[{"t":"SI/Diagnosticar","s":"critico"}, {"t":"NO","s":"ok"}]'::jsonb),
  ('TREN_TRASERO', '2.5', 'Giro de rueda (ruido)', '[{"t":"SI/Diagnosticar","s":"critico"}, {"t":"NO","s":"ok"}]'::jsonb),
  ('TREN_TRASERO', '2.6', 'Defecto de bujes', '[{"t":"SI","s":"critico"}, {"t":"NO","s":"ok"}]'::jsonb),
  ('TREN_TRASERO', '2.7', 'Altura carrocería', '[{"t":"DISPAREJA","s":"critico"}, {"t":"PAREJA","s":"ok"}]'::jsonb),
  ('TREN_TRASERO', '2.9', 'Distancia entre ejes', '[{"t":"INCORRECTA/Diagnosticar","s":"critico"}, {"t":"CORRECTA","s":"ok"}]'::jsonb),
  ('SUSPENSION', '3.2', 'Amortiguadores delanteros', '[{"t":"Con fuga/Cambiar","s":"critico"}, {"t":"Envejecido","s":"pronto"}, {"t":"Buen estado","s":"ok"}]'::jsonb),
  ('SUSPENSION', '3.3', 'Altura carrocería', '[{"t":"DISPAREJA/diagnosticar","s":"critico"}, {"t":"NORMAL","s":"ok"}]'::jsonb),
  ('SUSPENSION', '3.4', 'Amortiguadores traseros', '[{"t":"Con fuga/Reemplazar","s":"critico"}, {"t":"Envejecido","s":"pronto"}, {"t":"Buen estado","s":"ok"}]'::jsonb),
  ('RUEDAS', '4.2', '¿Los neumáticos son todos iguales?', '[{"t":"SI/Cambiar","s":"critico"}, {"t":"SI","s":"ok"}]'::jsonb),
  ('RUEDAS', '4.3', 'Presión de aire (32 PSI) en todos los neumáticos', '[{"t":"NO/Diagnosticar","s":"critico"}, {"t":"SI","s":"ok"}]'::jsonb),
  ('RUEDAS', '4.4', 'Desgaste de los neumáticos', '[{"t":"DESGASTE IRREGULAR/Diagnosticar","s":"critico"}, {"t":"BUEN ESTADO","s":"ok"}]'::jsonb),
  ('RUEDAS', '4.5', 'Profundidad de neumáticos (min 1.6 mm)', '[{"t":"EN MAL ESTADO TODOS/Reemplazar","s":"critico"}, {"t":"EN MAL ESTADO DELANTEROS/Reemplazar","s":"critico"}, {"t":"EN MAL ESTADO TRASEROS/Reemplazar","s":"critico"}, {"t":"REGULAR ESTADO TODOS","s":"pronto"}, {"t":"REGULAR ESTADO DELANTEROS","s":"pronto"}, {"t":"REGULAR ESTADO TRASEROS","s":"pronto"}, {"t":"BUEN ESTADO","s":"ok"}]'::jsonb),
  ('RUEDAS', '4.6', '¿Faltan tuercas o pernos de rueda?', '[{"t":"SI/Cambiar o Instalar","s":"critico"}, {"t":"NO","s":"ok"}]'::jsonb),
  ('FRENOS', '5.2', 'Vida útil pastillas delanteras (min 2mm=0%)', '[{"t":"- 30%/ Cambiar","s":"critico"}, {"t":"ENTRE 30% y 50% / Mantención","s":"pronto"}, {"t":"ENTRE 50% y 70% / Mantención","s":"pronto"}, {"t":"+70%/ Mantención","s":"ok"}]'::jsonb),
  ('FRENOS', '5.3', 'Discos de frenos delanteros', '[{"t":"DELGADOS / Cambiar","s":"critico"}, {"t":"CRISTALIZADOS / Mantención","s":"pronto"}, {"t":"BUEN ESTADO","s":"ok"}, {"t":"DEFORMADOS/Rectificar","s":"pronto"}]'::jsonb),
  ('FRENOS', '5.4', 'Vida útil pastillas traseras (min 2mm=0%)', '[{"t":"- 30%/ Cambiar","s":"critico"}, {"t":"ENTRE 30% y 50% / Mantención","s":"pronto"}, {"t":"ENTRE 50% y 70% / Mantención","s":"pronto"}, {"t":"+70%/ Mantención","s":"ok"}, {"t":"No aplica","s":"na"}]'::jsonb),
  ('FRENOS', '5.5', 'Discos de frenos traseros', '[{"t":"Delgados / Cambiar","s":"critico"}, {"t":"Cristalizados / Mantención","s":"pronto"}, {"t":"Buen estado","s":"ok"}, {"t":"No aplica","s":"na"}]'::jsonb),
  ('FRENOS', '5.6', 'Vida útil balatas (min 2mm=0%)', '[{"t":"- 30%/ Cambiar","s":"critico"}, {"t":"ENTRE 30% y 50% / Mantención","s":"pronto"}, {"t":"ENTRE 50% y 70% / Mantención","s":"pronto"}, {"t":"+70%/ Mantención","s":"ok"}, {"t":"No aplica","s":"na"}]'::jsonb),
  ('FRENOS', '5.7', 'Tambores', '[{"t":"Delgados / Cambiar","s":"critico"}, {"t":"Cristalizados / Mantención","s":"pronto"}, {"t":"Buen estado","s":"ok"}, {"t":"No aplica","s":"na"}]'::jsonb),
  ('FRENOS', '5.8', 'Recorrido pedal de frenos', '[{"t":"Largo / Diagnosticar","s":"critico"}, {"t":"Normal","s":"ok"}]'::jsonb),
  ('FRENOS', '5.9', 'Freno de estacionamiento (3-5 clics)', '[{"t":"Largo / Regular","s":"critico"}, {"t":"Muy corto / Regular","s":"critico"}, {"t":"Normal","s":"ok"}]'::jsonb),
  ('ENGRASE', '6.2', 'Engrase crucetas y cardanes', '[{"t":"FALTA ENGRASE/ Engrasar","s":"critico"}, {"t":"ENGRASADAS","s":"ok"}]'::jsonb),
  ('LUCES', '7.2', 'Carretera', '[{"t":"IZQUIERDA QUEMADA/Cambiar","s":"critico"}, {"t":"DERECHA QUEMADA/Cambiar","s":"critico"}, {"t":"AMBAS QUEMADAS","s":"critico"}, {"t":"BUENAS","s":"ok"}]'::jsonb),
  ('LUCES', '7.3', 'Neblineros', '[{"t":"IZQUIERDO QUEMADO/ Cambiar","s":"critico"}, {"t":"DERECHO QUEMADO/ Cambiar","s":"critico"}, {"t":"AMBOS NO ENCIENDE/ Revisión acabada","s":"critico"}, {"t":"BUENOS","s":"ok"}, {"t":"No aplica","s":"na"}, {"t":"No aplica / Evaluar instalación","s":"na"}]'::jsonb),
  ('LUCES', '7.4', 'Posición delanteras', '[{"t":"IZQUIERDA NO ENCIENDE/ Cambiar","s":"critico"}, {"t":"DERECHA NO ENCIENDE/ Cambiar","s":"critico"}, {"t":"AMBAS NO ENCIENDEN/ Revisión mas acabada","s":"critico"}, {"t":"BUENAS","s":"ok"}]'::jsonb),
  ('LUCES', '7.5', 'Posición traseras', '[{"t":"IZQUIERDA NO ENCIENDE/ Cambiar","s":"critico"}, {"t":"DERECHA NO ENCIENDE/ Cambiar","s":"critico"}, {"t":"AMBAS NO ENCIENDEN/ Revisión mas acabada","s":"critico"}, {"t":"BUENAS","s":"ok"}]'::jsonb),
  ('LUCES', '7.6', 'Patente', '[{"t":"IZQUIERDA NO ENCIENDE/ Cambiar","s":"critico"}, {"t":"DERECHA NO ENCIENDE/ Cambiar","s":"critico"}, {"t":"AMBAS NO ENCIENDEN/ Revisión mas acabada","s":"critico"}, {"t":"BUENAS","s":"ok"}]'::jsonb),
  ('LUCES', '7.7', 'Freno', '[{"t":"IZQUIERDA NO ENCIENDE/ Cambiar","s":"critico"}, {"t":"DERECHA NO ENCIENDE/ Cambiar","s":"critico"}, {"t":"AMBAS NO ENCIENDEN/ Revisión mas acabada","s":"critico"}, {"t":"BUENAS","s":"ok"}]'::jsonb),
  ('LUCES', '7.8', 'Tercera luz freno', '[{"t":"NO ENCIENDE / Revisión mas acabada","s":"critico"}, {"t":"AMPOLLETAS QUEMADAS/ Cambiar","s":"critico"}, {"t":"BUENA","s":"ok"}]'::jsonb),
  ('LUCES', '7.9', 'Reversa', '[{"t":"IZQUIERDA NO ENCIENDE/ Cambiar","s":"critico"}, {"t":"DERECHA NO ENCIENDE/ Cambiar","s":"critico"}, {"t":"AMBAS NO ENCIENDEN/ Revisión mas acabada","s":"critico"}, {"t":"BUENAS","s":"ok"}]'::jsonb),
  ('LUCES', '7.9.1', 'Intermitentes', '[{"t":"DEL IZQ NO ENCIENDE/ Cambiar","s":"critico"}, {"t":"DEL DER NO ENCIENDE/ Cambiar","s":"critico"}, {"t":"LADO IZQUIERDO NO ENCIENDE/Diagnosticar","s":"critico"}, {"t":"LADO DERECHO NO ENCIENDE /Diagnosticar","s":"critico"}, {"t":"TRAS IZQ NO ENCIENDE/Cambiar","s":"critico"}, {"t":"TRAS DER NO ENCIENDE/Cambiar","s":"critico"}, {"t":"BUENAS","s":"ok"}]'::jsonb),
  ('MOTOR', '8.2', 'Carga alternador (14 ± 2 V)', '[{"t":"CARGA -13 VOLTS /Revisión mas acabada","s":"critico"}, {"t":"CARGA +14.5 VOLTS/ Revisión mas acabada","s":"critico"}, {"t":"NORMAL ENTRE 13.8 A 14.2 VOLTS","s":"ok"}]'::jsonb),
  ('MOTOR', '8.3', 'Correa auxiliar', '[{"t":"PARTIDA/Cambiar","s":"critico"}, {"t":"ENVEJECIDA / Programar cambio","s":"pronto"}, {"t":"BUEN ESTADO","s":"ok"}]'::jsonb),
  ('MOTOR', '8.4', 'Ruidos', '[{"t":"SI/ Revisión mas acabada","s":"critico"}, {"t":"NO","s":"ok"}]'::jsonb),
  ('MOTOR', '8.5', 'Arranque', '[{"t":"DESDE EL TERCER ARRANQUE PARTE MAS LENTO/Diagnosticar","s":"critico"}, {"t":"NO DA ARRANQUE/Diagnosticar","s":"critico"}, {"t":"PARTE DEFICIENTE/ Mantención","s":"pronto"}, {"t":"PARTE BIEN","s":"ok"}]'::jsonb),
  ('MOTOR', '8.6', 'Soporte batería', '[{"t":"EN MAL ESTADO","s":"critico"}, {"t":"NO COINCIDE EL SOPORTE CON LA BATERIA","s":"critico"}, {"t":"BUEN ESTADO","s":"ok"}]'::jsonb),
  ('MOTOR', '8.7', 'Bornes de batería', '[{"t":"1 EN MAL ESTADO/Reemplazar","s":"critico"}, {"t":"AMBOS EN MAL ESTADO/ Cambiar","s":"critico"}, {"t":"SULFATADO/ Mantención","s":"pronto"}, {"t":"BUEN ESTADO","s":"ok"}]'::jsonb)
on conflict (codigo) do update
  set texto = excluded.texto, opciones = excluded.opciones, categoria = excluded.categoria;

-- El orden dentro de cada categoría sale del propio código (1.2 antes que 1.7)
update radar_criterios c set orden = s.n
from (select codigo, row_number() over (partition by categoria order by
        string_to_array(codigo, '.')::int[]) n from radar_criterios) s
where s.codigo = c.codigo;


-- ----------------------------------------------------------------------------
-- 2) Inspecciones RADAR y sus respuestas
-- ----------------------------------------------------------------------------
create table if not exists radar_inspecciones (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null default '00000000-0000-0000-0000-000000000001',
  trabajo_id    uuid references trabajos_taller(id) on delete cascade,
  vehiculo_id   uuid references vehiculos(id) on delete cascade,
  cliente_id    uuid references clientes(id) on delete set null,
  tecnico_id    uuid references usuarios(id) on delete set null,
  km            int,
  estado        text not null default 'en_proceso',   -- en_proceso | completada
  -- Respuesta del cliente al radar (campo ⭐ del formulario de ClickUp)
  aprobacion_cliente text,   -- aprobo_todo | aprobo_parcial | presupuesto_futuro | no_aprobo
  clickup_task_id text,
  iniciada_en   timestamptz default now(),
  completada_en timestamptz
);

create index if not exists ix_radar_insp_veh on radar_inspecciones(vehiculo_id, iniciada_en desc);
create index if not exists ix_radar_insp_trab on radar_inspecciones(trabajo_id);

create table if not exists radar_respuestas (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null default '00000000-0000-0000-0000-000000000001',
  inspeccion_id uuid not null references radar_inspecciones(id) on delete cascade,
  criterio_codigo text not null references radar_criterios(codigo) on delete cascade,
  opcion        text,          -- texto de la opción elegida
  severidad     text,          -- critico | pronto | ok | na
  observacion   text,
  respondida_en timestamptz default now(),
  unique (inspeccion_id, criterio_codigo)
);

create index if not exists ix_radar_resp_sev on radar_respuestas(inspeccion_id, severidad);


-- ----------------------------------------------------------------------------
-- 3) RLS — mismo criterio de la migración 56
-- ----------------------------------------------------------------------------
alter table radar_categorias  enable row level security;
alter table radar_criterios   enable row level security;
alter table radar_inspecciones enable row level security;
alter table radar_respuestas  enable row level security;

do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies where schemaname='public'
           and tablename in ('radar_categorias','radar_criterios','radar_inspecciones','radar_respuestas') loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- El catálogo lo lee todo el mundo; solo admin y jefe lo modifican.
create policy radar_cat_sel on radar_categorias for select using (true);
create policy radar_cat_wri on radar_categorias for all
  using (es_admin_o_jefe()) with check (es_admin_o_jefe());
create policy radar_cri_sel on radar_criterios for select using (true);
create policy radar_cri_wri on radar_criterios for all
  using (es_admin_o_jefe()) with check (es_admin_o_jefe());

-- Las inspecciones: las captura el técnico, las lee toda la empresa.
create policy radar_insp_sel on radar_inspecciones
  for select using (empresa_id = empresa_actual());
create policy radar_insp_ins on radar_inspecciones
  for insert with check (empresa_id = empresa_actual()
    and (es_admin() or es_taller() or es_asesor()));
create policy radar_insp_upd on radar_inspecciones
  for update using (empresa_id = empresa_actual()
    and (es_admin() or es_taller() or es_asesor()))
  with check (empresa_id = empresa_actual());
create policy radar_insp_del on radar_inspecciones
  for delete using (empresa_id = empresa_actual() and es_admin_o_jefe());

create policy radar_resp_sel on radar_respuestas
  for select using (empresa_id = empresa_actual());
create policy radar_resp_ins on radar_respuestas
  for insert with check (empresa_id = empresa_actual()
    and (es_admin() or es_taller() or es_asesor()));
create policy radar_resp_upd on radar_respuestas
  for update using (empresa_id = empresa_actual()
    and (es_admin() or es_taller() or es_asesor()))
  with check (empresa_id = empresa_actual());
create policy radar_resp_del on radar_respuestas
  for delete using (empresa_id = empresa_actual() and es_admin_o_jefe());


-- ----------------------------------------------------------------------------
-- 4) Vista de alertas por vehículo — lo que se muestra en el panel del vehículo
-- ----------------------------------------------------------------------------
-- Solo rojos y amarillos, con su observación y su antigüedad. Es la respuesta a
-- "¿qué le pasa a este auto?" sin tener que abrir la inspección completa.
create or replace view v_radar_alertas as
select
  i.vehiculo_id,
  i.id                as inspeccion_id,
  i.trabajo_id,
  i.iniciada_en,
  i.completada_en,
  i.estado            as estado_inspeccion,
  i.km,
  u.nombre            as tecnico,
  cat.codigo          as categoria_codigo,
  cat.nombre          as categoria,
  cat.orden           as categoria_orden,
  cr.codigo           as criterio_codigo,
  cr.texto            as criterio,
  r.opcion,
  r.severidad,
  r.observacion,
  -- ¿Sigue vigente? Una alerta de hace un año probablemente ya se resolvió.
  (current_date - i.iniciada_en::date) as dias_desde
from radar_respuestas r
join radar_inspecciones i on i.id = r.inspeccion_id
join radar_criterios cr   on cr.codigo = r.criterio_codigo
join radar_categorias cat on cat.codigo = cr.categoria
left join usuarios u      on u.id = i.tecnico_id
where r.severidad in ('critico','pronto');

comment on view v_radar_alertas is
  'Alertas rojas y amarillas del RADAR por vehículo, con observación y antigüedad. Base del panel del vehículo.';

-- Resumen por inspección: el semáforo de una sola mirada
create or replace view v_radar_resumen as
select
  i.id as inspeccion_id, i.vehiculo_id, i.trabajo_id, i.estado, i.iniciada_en,
  count(*) filter (where r.severidad = 'critico') as criticos,
  count(*) filter (where r.severidad = 'pronto')  as pronto,
  count(*) filter (where r.severidad = 'ok')      as ok,
  count(*) filter (where r.severidad = 'na')      as no_aplica,
  count(*)                                        as respondidos,
  (select count(*) from radar_criterios where activo) as total_criterios
from radar_inspecciones i
left join radar_respuestas r on r.inspeccion_id = i.id
group by i.id, i.vehiculo_id, i.trabajo_id, i.estado, i.iniciada_en;


-- ----------------------------------------------------------------------------
-- 5) Al completar una inspección, los hallazgos pasan al flujo existente
-- ----------------------------------------------------------------------------
-- Cada rojo o amarillo se convierte en `diagnosticos_taller`, que es la tabla
-- que ya alimenta el presupuesto y las oportunidades (migración 58). Así el
-- RADAR no queda como un módulo aislado: entra al circuito que ya existe.
create or replace function radar_volcar_hallazgos(p_inspeccion uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare v_trabajo uuid; v_tecnico uuid; n int := 0; r record;
begin
  select trabajo_id, tecnico_id into v_trabajo, v_tecnico
  from radar_inspecciones where id = p_inspeccion;
  if v_trabajo is null then return 0; end if;

  for r in
    select cr.texto, cat.nombre as categoria, resp.opcion, resp.severidad, resp.observacion
    from radar_respuestas resp
    join radar_criterios cr on cr.codigo = resp.criterio_codigo
    join radar_categorias cat on cat.codigo = cr.categoria
    where resp.inspeccion_id = p_inspeccion and resp.severidad in ('critico','pronto')
  loop
    -- No duplicar si ya se volcó antes
    if not exists (select 1 from diagnosticos_taller d
                   where d.trabajo_id = v_trabajo
                     and d.item = r.categoria || ' · ' || r.texto) then
      insert into diagnosticos_taller (trabajo_id, item, severidad, recomendacion, tecnico_id)
      values (v_trabajo, r.categoria || ' · ' || r.texto, r.severidad,
              coalesce(r.opcion, '') ||
              case when coalesce(r.observacion,'') <> '' then ' — ' || r.observacion else '' end,
              v_tecnico);
      n := n + 1;
    end if;
  end loop;

  perform registrar_evento('inspeccion', p_inspeccion, 'radar_completado',
    jsonb_build_object('hallazgos_volcados', n));
  return n;
end $$;


-- ----------------------------------------------------------------------------
-- 6) VERIFICACIÓN
-- ----------------------------------------------------------------------------
select cat.orden, cat.nombre, count(cr.id) as criterios
from radar_categorias cat
left join radar_criterios cr on cr.categoria = cat.codigo
group by cat.orden, cat.nombre order by cat.orden;

-- Debe dar 45
select count(*) as total_criterios from radar_criterios;

-- Reparto de severidades en el catálogo
select o->>'s' as severidad, count(*) as opciones
from radar_criterios, jsonb_array_elements(opciones) o
group by 1 order by 2 desc;
