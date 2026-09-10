-- ============================================================================
-- Migración 74 — Diagnóstico: ¿por qué no llegan las notificaciones?
-- ============================================================================
--
-- Las notificaciones se envían con `rol_destino` y la campanita las lee con
--     .or(usuario_id.eq.<yo>, rol_destino.eq.<mi rol>)
--
-- Es decir: si NADIE tiene el rol `coordinador_adquisiciones`, el aviso se
-- guarda pero no lo ve nadie. Se crea, existe en la tabla, y desaparece.
--
-- Este script no cambia nada: solo muestra si el problema es ese.
-- ============================================================================

-- 1. ¿Quién tiene cada rol?
select rol::text as rol, count(*) as personas,
       string_agg(nombre, ', ' order by nombre) as quienes
from usuarios where coalesce(activo, true)
group by rol::text order by rol::text;

-- 2. ¿Existe alguien en los roles a los que el sistema envía avisos?
with esperados(rol) as (
  values ('coordinador_adquisiciones'), ('jefe_taller'), ('admin'),
         ('asesor_toyota'), ('asesor_multimarca'), ('asistente_administrativo')
)
select e.rol,
       count(u.id) as personas,
       case when count(u.id) = 0 then '⚠ NADIE VE ESTOS AVISOS' else 'ok' end as estado
from esperados e
left join usuarios u on u.rol::text = e.rol and coalesce(u.activo, true)
group by e.rol order by count(u.id), e.rol;

-- 3. Notificaciones enviadas a roles sin nadie asignado
select n.rol_destino, count(*) as avisos_perdidos,
       max(n.creada_en) as ultimo
from notificaciones n
where n.rol_destino is not null
  and not exists (
    select 1 from usuarios u
    where u.rol::text = n.rol_destino and coalesce(u.activo, true))
group by n.rol_destino
order by count(*) desc;

-- 4. Últimas notificaciones, para ver si se están creando
select creada_en, rol_destino, usuario_id, titulo
from notificaciones order by creada_en desc limit 10;
