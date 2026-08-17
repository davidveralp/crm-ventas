-- ============================================================================
-- Migración 55 — Usuarios de operación: jefe de taller y coordinador de adquisiciones
-- ============================================================================
--
-- CIERRA Q3 de la Fase 0. Equipo confirmado:
--
--   admin                       David Vera · Jessica Díaz
--   asesor_toyota               Diego Leyton
--   asesor_multimarca           David Rivera · Matías Ponce
--   jefe_taller                 Andrés Aracena          ← crear
--   coordinador_adquisiciones   Víctor Tello            ← crear
--                               (= "encargado de presupuestos" de la spec)
--   tecnico                     Gabriel Cayo · Javier Guzmán · Felipe ·
--                               Sergio · Pablo Donoso
--
-- Con esto los CINCO roles que pide la especificación quedan cubiertos por
-- personas reales, que es el prerrequisito para probar la matriz de permisos
-- (C3) y el circuito de notificaciones N6-N9.
--
-- ⚠️ ORDEN OBLIGATORIO
-- `usuarios.id` referencia `auth.users(id)`. Primero hay que crear cada persona
-- en Supabase → Authentication → Users → Add user (con su correo real y una
-- contraseña temporal). Recién después se ejecuta este script, que toma el id
-- que Supabase generó y crea el perfil.
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk), NO en "Didial OT".
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Antes de nada: ¿quién existe ya?
-- ----------------------------------------------------------------------------
select u.nombre, u.email, u.rol::text, u.activo
from usuarios u
order by u.rol::text, u.nombre;

-- Cuentas de Authentication que todavía no tienen perfil en `usuarios`
select a.id, a.email, a.created_at
from auth.users a
left join usuarios u on u.id = a.id
where u.id is null
order by a.created_at desc;


-- ----------------------------------------------------------------------------
-- 2) Crear los perfiles
-- ----------------------------------------------------------------------------
-- ⚠️ REEMPLAZAR los correos de ejemplo por los reales antes de ejecutar.
--    Si el correo no existe en auth.users, esa fila simplemente no se inserta
--    (el join no encuentra nada) y no se produce error: por eso el paso 4
--    verifica el resultado.

insert into usuarios (id, empresa_id, nombre, email, rol, activo)
select a.id,
       '00000000-0000-0000-0000-000000000001',
       v.nombre, a.email, v.rol::rol_usuario, true
from (values
  ('CORREO_ANDRES@didial.cl', 'Andrés Aracena', 'jefe_taller'),
  ('CORREO_VICTOR@didial.cl', 'Víctor Tello',   'coordinador_adquisiciones')
) as v(email, nombre, rol)
join auth.users a on lower(a.email) = lower(v.email)
on conflict (id) do update
  set nombre = excluded.nombre,
      rol    = excluded.rol,
      activo = true;


-- ----------------------------------------------------------------------------
-- 3) Técnicos (opcional en esta etapa)
-- ----------------------------------------------------------------------------
-- Los técnicos solo necesitan cuenta si van a inspeccionar DENTRO de la app
-- (decisión D2 de la Fase 0). Si se opta por la alternativa intermedia —tablet
-- fijo en recepción— pueden esperar.
--
-- insert into usuarios (id, empresa_id, nombre, email, rol, activo)
-- select a.id, '00000000-0000-0000-0000-000000000001',
--        v.nombre, a.email, 'tecnico'::rol_usuario, true
-- from (values
--   ('CORREO@didial.cl', 'Gabriel Cayo'),
--   ('CORREO@didial.cl', 'Javier Guzmán'),
--   ('CORREO@didial.cl', 'Pablo Donoso')
-- ) as v(email, nombre)
-- join auth.users a on lower(a.email) = lower(v.email)
-- on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol;


-- ----------------------------------------------------------------------------
-- 4) Verificación: los cinco roles de la spec deben tener a alguien
-- ----------------------------------------------------------------------------
with requeridos(rol) as (
  values ('admin'), ('asesor_toyota'), ('asesor_multimarca'),
         ('jefe_taller'), ('coordinador_adquisiciones'), ('tecnico')
)
select r.rol,
       count(u.id)                                  as personas,
       coalesce(string_agg(u.nombre, ', '), '—')    as quienes,
       case when count(u.id) = 0 then 'FALTA' else 'ok' end as estado
from requeridos r
left join usuarios u on u.rol::text = r.rol and coalesce(u.activo, true)
group by r.rol
order by r.rol;


-- ----------------------------------------------------------------------------
-- 5) Nota sobre la ficha de cliente de Andrés Aracena
-- ----------------------------------------------------------------------------
-- Existe un cliente "Andres Aracena" (id fba1feae-…, tipo "Interno", Suzuki)
-- cargado en 06_carga_clientes.sql. NO es un error ni un duplicado del usuario:
-- son cosas distintas. `clientes` es quien trae un vehículo a atender;
-- `usuarios` es quien opera el sistema. La misma persona puede ser ambas, y
-- el tipo "Interno" ya la distingue en los análisis comerciales.
select id, nombre, tipo_cliente, telefono
from clientes
where nombre ilike '%aracena%' or nombre ilike '%tello%';
