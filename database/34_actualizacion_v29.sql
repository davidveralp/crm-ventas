-- =====================================================================
-- ACTUALIZACIÓN v29 · Campañas personalizadas desde el CRM
-- ---------------------------------------------------------------------
-- 1) audiencia_campana v3: nuevo criterio tipo 'personalizada' — clientes
--    con algún servicio en un RANGO DE FECHAS, con filtros opcionales de
--    tipo de servicio (mantención/reparación), mínimo de visitas
--    históricas y monto histórico mínimo.
-- 2) Seed de la campaña solicitada: fidelización de los servicios
--    realizados entre el 01-06-2026 y el 06-07-2026, canal TAREAS para
--    asesores (llamada/WhatsApp personal).
-- Idempotente. Requiere migraciones 1–33. La función conserva su firma y
-- columnas de retorno (create or replace directo, sin drop).
-- =====================================================================

create or replace function audiencia_campana(p_campana uuid)
returns table (cliente_id uuid, nombre text, apellidos text, email text,
               telefono text, ultima_visita date, visitas_12m bigint, facturacion numeric,
               marca text, modelo text, ultimo_servicio text,
               contacto_email text, contacto_fono text)
language sql stable as $fn$
with cfg as (
  select c.empresa_id, coalesce(c.criterio, '{}'::jsonb) cr from campanas c where c.id = p_campana
),
base as (
  select c.id, c.nombre, c.apellidos, c.email, c.telefono,
         coalesce(c.facturacion_total, 0) fact,
         max(s.fecha) ult_visita,
         max(s.fecha) filter (where upper(coalesce(s.tipo_servicio,'')) like 'MAN%'
                                 or upper(coalesce(s.tipo_servicio_2,'')) like 'MAN%') ult_mant,
         count(*) filter (where s.fecha > current_date - 365) visitas_12m,
         count(*) visitas_tot
    from clientes c
    join servicios s on s.cliente_id = c.id and s.fecha is not null
   where c.empresa_id = (select empresa_id from cfg)
   group by c.id
),
ult as (
  select distinct on (s.cliente_id) s.cliente_id, s.tipo_servicio, v.marca, v.modelo
    from servicios s
    left join vehiculos v on v.id = s.vehiculo_id
   where s.fecha is not null
   order by s.cliente_id, s.fecha desc
)
select b.id, b.nombre, b.apellidos, b.email, b.telefono, b.ult_visita, b.visitas_12m, b.fact,
       u.marca, u.modelo, u.tipo_servicio,
       case when upper(coalesce(u.marca,'')) = 'TOYOTA' then 'serviciotoyota@didial.cl'  else 'serviciotecnico@didial.cl' end,
       case when upper(coalesce(u.marca,'')) = 'TOYOTA' then '+56 9 3740 1051'           else '+56 9 8974 8626'            end
  from base b
  left join ult u on u.cliente_id = b.id
  cross join cfg
 where (
   -- v29: para canal tareas no se exige email; para email sí
   (cfg.cr->>'canal' = 'tareas' and coalesce(b.telefono, b.email) is not null)
   or (coalesce(cfg.cr->>'canal', 'email') <> 'tareas' and b.email is not null and position('@' in b.email) > 1)
 )
 and case cfg.cr->>'tipo'
   when 'personalizada' then
        exists (
          select 1 from servicios s2
           where s2.cliente_id = b.id and s2.fecha is not null
             and s2.fecha >= coalesce((cfg.cr->>'fecha_desde')::date, '1900-01-01'::date)
             and s2.fecha <= coalesce((cfg.cr->>'fecha_hasta')::date, current_date)
             and case coalesce(cfg.cr->>'tipo_servicio', 'todos')
               when 'mantencion' then (upper(coalesce(s2.tipo_servicio,'')) like 'MAN%' or upper(coalesce(s2.tipo_servicio_2,'')) like 'MAN%')
               when 'reparacion' then not (upper(coalesce(s2.tipo_servicio,'')) like 'MAN%' or upper(coalesce(s2.tipo_servicio_2,'')) like 'MAN%')
               else true
             end
        )
        and b.visitas_tot >= coalesce((cfg.cr->>'min_visitas')::int, 0)
        and b.fact >= coalesce((cfg.cr->>'monto_min')::numeric, 0)
   when 'mant_proxima' then
        b.ult_mant is not null
        and b.ult_mant between current_date - coalesce((cfg.cr->>'dias_max')::int, 180)
                           and current_date - coalesce((cfg.cr->>'dias_min')::int, 150)
        and b.ult_mant = b.ult_visita
   when 'mant_vencida' then
        b.ult_mant is not null
        and b.ult_mant between current_date - coalesce((cfg.cr->>'dias_max')::int, 365)
                           and current_date - coalesce((cfg.cr->>'dias_min')::int, 181)
        and b.ult_mant = b.ult_visita
   when 'fidelizacion_reparacion' then
        b.ult_visita between current_date - coalesce((cfg.cr->>'dias_max')::int, 180)
                         and current_date - coalesce((cfg.cr->>'dias_min')::int, 60)
        and (b.ult_mant is null or b.ult_mant < b.ult_visita)
   when 'fidelizados' then
        b.visitas_12m >= coalesce((cfg.cr->>'min_visitas_12m')::int, 3)
   when 'recupero_importante' then
        b.ult_visita < current_date - coalesce((cfg.cr->>'dias_min')::int, 365)
        and (b.visitas_tot >= coalesce((cfg.cr->>'min_visitas')::int, 3)
             or b.fact >= coalesce((cfg.cr->>'monto_min')::numeric, 500000))
   when 'recupero_masivo' then
        b.ult_visita < current_date - coalesce((cfg.cr->>'dias_min')::int, 365)
        and b.visitas_tot < coalesce((cfg.cr->>'min_visitas')::int, 3)
        and b.fact < coalesce((cfg.cr->>'monto_min')::numeric, 500000)
   else false
 end
 order by b.ult_visita desc nulls last
$fn$;

-- ---- Seed: campaña de fidelización junio – 6 de julio (canal tareas) ----
insert into campanas (empresa_id, nombre, descripcion, estado, prioridad, canal, criterio)
select '00000000-0000-0000-0000-000000000001',
       'Fidelización · Servicios Junio – 6 Julio 2026',
       'Contacto personal (llamada/WhatsApp del asesor) a todos los clientes con algún servicio entre el 01-06-2026 y el 06-07-2026: ¿cómo ha respondido el vehículo?, ¿quedó conforme?, recordar que estamos disponibles.',
       'activa', 1, null,
       '{"tipo":"personalizada","canal":"tareas","fecha_desde":"2026-06-01","fecha_hasta":"2026-07-06","tipo_servicio":"todos"}'::jsonb
where not exists (
  select 1 from campanas
   where empresa_id = '00000000-0000-0000-0000-000000000001'
     and criterio->>'tipo' = 'personalizada'
     and criterio->>'fecha_desde' = '2026-06-01'
     and criterio->>'fecha_hasta' = '2026-07-06'
);

-- Diagnóstico: cuántos clientes entran en la campaña recién creada
select count(*) as audiencia_junio_julio
  from audiencia_campana((select id from campanas
    where empresa_id = '00000000-0000-0000-0000-000000000001'
      and criterio->>'fecha_desde' = '2026-06-01' limit 1));
