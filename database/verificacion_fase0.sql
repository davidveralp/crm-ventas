-- ============================================================================
-- Fase 0 · Consultas de verificación (solo lectura, no modifican nada)
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk)
-- ============================================================================
-- Responde Q2 y el criterio de "listo para F1a" del documento de Fase 0.
-- Varias colisiones del documento (C1, C2, C5) ya están resueltas en el
-- esquema actual: el documento fue escrito contra un respaldo en la migración
-- 07, y el proyecto va en la 54.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Q2 · ¿Reemplazar `presupuestos` o renombrarla?
-- ----------------------------------------------------------------------------
-- Ojo: probablemente la pregunta esté mal planteada. `presupuestos_taller`
-- (migración 22) ya ES el documento valorizado con ítems que la spec propone
-- crear. `presupuestos` es el seguimiento comercial. Conviven a propósito.
select
  (select count(*) from presupuestos)                      as presupuestos_comercial,
  (select count(*) from presupuestos where estado <> 'borrador') as comercial_no_borrador,
  (select count(*) from presupuestos_taller)               as presupuestos_taller,
  (select count(*) from presupuestos_taller
     where jsonb_array_length(coalesce(items,'[]'::jsonb)) > 0) as taller_con_items;

-- Distribución de estados, para ver si el historial comercial importa
select 'comercial' as tabla, estado::text, count(*)
from presupuestos group by estado
union all
select 'taller', estado, count(*)
from presupuestos_taller group by estado
order by 1, 3 desc;


-- ----------------------------------------------------------------------------
-- C5 · Patentes duplicadas (prerrequisito del índice único)
-- ----------------------------------------------------------------------------
-- Usa `patente_norm` (migración 49), que ya normaliza sin separadores.
-- El caso grave es el segundo: misma patente en clientes DISTINTOS.
select
  patente_norm,
  count(*)                                as fichas,
  count(distinct cliente_id)              as clientes_distintos,
  array_agg(distinct patente)             as formatos_escritos,
  array_agg(id)                           as vehiculo_ids
from vehiculos
where coalesce(patente_norm,'') <> ''
group by patente_norm
having count(*) > 1
order by count(distinct cliente_id) desc, count(*) desc;

-- Resumen: cuántos duplicados hay y de qué tipo
with d as (
  select patente_norm, count(*) n, count(distinct cliente_id) nc
  from vehiculos where coalesce(patente_norm,'') <> ''
  group by patente_norm having count(*) > 1
)
select
  count(*)                        as patentes_duplicadas,
  sum(n) - count(*)               as fichas_sobrantes,
  count(*) filter (where nc > 1)  as con_clientes_distintos_GRAVE
from d;


-- ----------------------------------------------------------------------------
-- Q3 · Usuarios reales por rol (para probar permisos y alertas)
-- ----------------------------------------------------------------------------
select rol::text, count(*) as usuarios, array_agg(nombre order by nombre) as personas
from usuarios
where coalesce(activo, true)
group by rol
order by count(*) desc;

-- Valores disponibles hoy en el enum. La spec necesita cinco roles;
-- solo falta 'encargado_presupuestos'.
select enumlabel as rol_disponible
from pg_enum e join pg_type t on t.oid = e.enumtypid
where t.typname = 'rol_usuario'
order by e.enumsortorder;


-- ----------------------------------------------------------------------------
-- C3 · Estado actual de RLS (qué hay que reescribir y qué no tocar)
-- ----------------------------------------------------------------------------
select tablename, count(*) as politicas, array_agg(policyname order by policyname) as nombres
from pg_policies
where schemaname = 'public'
group by tablename
order by tablename;

-- Helpers existentes. La spec pide agregar auth_rol() junto a estos.
select p.proname as funcion, pg_get_function_result(p.oid) as retorna
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('empresa_actual','es_admin','auth_rol','rut_dv','fusionar_clientes','fusionar_clientes_preservando')
order by p.proname;


-- ----------------------------------------------------------------------------
-- Volumen general (dimensionar el trabajo real)
-- ----------------------------------------------------------------------------
select 'clientes' t, count(*) n from clientes
union all select 'vehiculos', count(*) from vehiculos
union all select 'ordenes_trabajo', count(*) from ordenes_trabajo
union all select 'servicios', count(*) from servicios
union all select 'trabajos_taller', count(*) from trabajos_taller
union all select 'presupuestos_taller', count(*) from presupuestos_taller
union all select 'inspecciones_ingreso', count(*) from inspecciones_ingreso
order by n desc;

-- Cobertura de RUT: determina si el RUT ya sirve como llave o falta capturarlo
select
  count(*)                                        as clientes,
  count(*) filter (where coalesce(rut,'') <> '')  as con_rut,
  count(*) filter (where rut_valido is true)      as rut_valido,
  count(*) filter (where rut_valido is false)     as rut_invalido
from clientes;
