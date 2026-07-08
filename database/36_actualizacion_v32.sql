-- =====================================================================
-- ACTUALIZACIÓN v32 · Roles de asesores y reparto de cartera multimarca
-- ---------------------------------------------------------------------
-- Ejecutar en el proyecto crm-ventas. Requiere que los 4 roles nuevos ya
-- existan (PASO 1 de la migración 33). Ajusta por NOMBRE de usuario; si
-- algún nombre difiere, edítalo aquí antes de correr.
-- =====================================================================

-- ---- 1) Roles específicos por asesor -----------------------------------
update usuarios set rol = 'asesor_toyota'
 where empresa_id = '00000000-0000-0000-0000-000000000001' and lower(nombre) like '%diego%leyton%';
update usuarios set rol = 'asesor_multimarca'
 where empresa_id = '00000000-0000-0000-0000-000000000001'
   and (lower(nombre) like '%david%rivera%' or lower(nombre) like '%matias%ponce%' or lower(nombre) like '%matías%ponce%');

-- Ángel Yáñez ya no está activo (reemplazado por Matías)
update usuarios set activo = false
 where empresa_id = '00000000-0000-0000-0000-000000000001'
   and (lower(nombre) like '%angel%yanez%' or lower(nombre) like '%ángel%yáñez%' or lower(nombre) like '%angel%yáñez%');

-- ---- 2) Reparto 50/50 de la cartera MULTIMARCA sin dueño válido ---------
-- "Multimarca" = clientes cuya marca principal NO es Toyota. Se reparten
-- los que no tienen vendedor, o cuyo vendedor quedó inactivo (ej. Ángel).
-- 50/50 determinístico por el orden del id (mitad a David, mitad a Matías).
with asesores as (
  select
    (select id from usuarios where empresa_id = '00000000-0000-0000-0000-000000000001'
       and lower(nombre) like '%david%rivera%' limit 1) as david,
    (select id from usuarios where empresa_id = '00000000-0000-0000-0000-000000000001'
       and (lower(nombre) like '%matias%ponce%' or lower(nombre) like '%matías%ponce%') limit 1) as matias
),
candidatos as (
  select c.id,
         row_number() over (order by c.id) as rn
    from clientes c
    left join usuarios u on u.id = c.vendedor_id
   where c.empresa_id = '00000000-0000-0000-0000-000000000001'
     and upper(coalesce(c.marca_principal, '')) <> 'TOYOTA'
     and (c.vendedor_id is null or u.activo = false)
)
update clientes c set vendedor_id = case when (cand.rn % 2) = 1 then a.david else a.matias end
  from candidatos cand cross join asesores a
 where c.id = cand.id;

-- ---- Diagnóstico -------------------------------------------------------
select u.nombre, u.rol, count(c.id) as clientes_asignados
  from usuarios u
  left join clientes c on c.vendedor_id = u.id
 where u.empresa_id = '00000000-0000-0000-0000-000000000001'
   and u.rol in ('asesor_toyota', 'asesor_multimarca')
 group by u.nombre, u.rol
 order by u.rol, u.nombre;
