-- =====================================================================
-- DIDIAL CRM · VINCULACIÓN DE USUARIOS
-- =====================================================================
-- EJECUTAR DESPUÉS de haber creado los usuarios en
-- Supabase > Authentication > Users (botón "Add user" > "Create new user").
--
-- Crea estos 4 usuarios en Auth con una contraseña temporal cada uno:
--   administracion@didial.cl       (David Vera   · ADMIN)
--   asesordidial@hotmail.com       (Diego Leyton · VENDEDOR)
--   vendedordidial@outlook.com     (Ángel Yáñez  · VENDEDOR)
--   lubricentrodidial@hotmail.com  (David Rivera · VENDEDOR)
--
-- Este script toma el id que Supabase generó para cada email y crea
-- su perfil en la tabla usuarios. Se puede re-ejecutar sin problema.
-- =====================================================================

insert into usuarios (id, empresa_id, nombre, email, rol, activo)
select u.id,
       '00000000-0000-0000-0000-000000000001',
       v.nombre, v.email, v.rol::rol_usuario, true
from (values
  ('administracion@didial.cl',      'David Vera',   'admin'),
  ('asesordidial@hotmail.com',      'Diego Leyton', 'vendedor'),
  ('vendedordidial@outlook.com',    'Ángel Yáñez',  'vendedor'),
  ('lubricentrodidial@hotmail.com', 'David Rivera', 'vendedor')
) as v(email, nombre, rol)
join auth.users u on lower(u.email) = lower(v.email)
on conflict (id) do update
  set nombre = excluded.nombre,
      rol    = excluded.rol,
      activo = true;

-- Verificación: deberías ver 4 filas
select nombre, email, rol, activo from usuarios order by rol, nombre;
