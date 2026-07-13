-- =====================================================================
-- LIMPIEZA · Elimina clientes de PRUEBA y todo lo asociado
-- ---------------------------------------------------------------------
-- Criterio: clientes cuyo nombre O apellidos contengan "prueba" (sin
-- distinguir mayúsculas/tildes). Se borra en cascada: presupuestos de
-- taller, trabajos de taller, historial de servicios (OT), presupuestos
-- comerciales, tareas de campaña, actividades (agenda y gestiones),
-- vehículos y finalmente la ficha del cliente.
--
-- Ejecutar en el proyecto crm-ventas. Revisa el PASO 1 (diagnóstico)
-- antes de correr el PASO 2 (borrado real).
-- =====================================================================

-- ---- PASO 1 · DIAGNÓSTICO (solo lectura, ejecuta esto primero) --------
with obj as (
  select id, nombre, apellidos from clientes
   where coalesce(nombre,'') ilike '%prueba%'
      or coalesce(apellidos,'') ilike '%prueba%'
)
select
  (select count(*) from obj)                                              as clientes_a_borrar,
  (select count(*) from vehiculos where cliente_id in (select id from obj))         as vehiculos,
  (select count(*) from trabajos_taller where cliente_id in (select id from obj))   as trabajos_taller,
  (select count(*) from presupuestos_taller
     where cliente_id in (select id from obj)
        or trabajo_id in (select id from trabajos_taller where cliente_id in (select id from obj)))
                                                                                     as presupuestos_taller,
  (select count(*) from presupuestos where cliente_id in (select id from obj))      as presupuestos_comerciales,
  (select count(*) from tareas_campana where cliente_id in (select id from obj))    as tareas_campana,
  (select count(*) from actividades where cliente_id in (select id from obj))       as actividades_agenda_gestiones,
  (select count(*) from servicios where cliente_id in (select id from obj))         as historial_servicios_ot;

-- Lista nominal (revisa que sean efectivamente pruebas antes de continuar)
select id, nombre, apellidos from clientes
 where coalesce(nombre,'') ilike '%prueba%'
    or coalesce(apellidos,'') ilike '%prueba%'
 order by nombre;

-- =====================================================================
-- ---- PASO 2 · BORRADO REAL (ejecuta solo si el diagnóstico luce bien) -
-- =====================================================================
do $$
declare
  v_clientes uuid[];
begin
  select array_agg(id) into v_clientes from clientes
   where coalesce(nombre,'') ilike '%prueba%'
      or coalesce(apellidos,'') ilike '%prueba%';

  if v_clientes is null then
    raise notice 'No se encontraron clientes de prueba. Nada que borrar.';
    return;
  end if;

  -- 1) Presupuestos de taller (por cliente_id directo o por trabajo_id)
  delete from presupuestos_taller
   where cliente_id = any(v_clientes)
      or trabajo_id in (select id from trabajos_taller where cliente_id = any(v_clientes));

  -- 2) Trabajos de taller
  delete from trabajos_taller where cliente_id = any(v_clientes);

  -- 3) Historial de servicios (OT sincronizadas) de esos clientes
  delete from servicios where cliente_id = any(v_clientes);

  -- 4) Cliente (cascada automática: vehiculos, presupuestos comerciales,
  --    tareas_campana, actividades — todas con on delete cascade)
  delete from clientes where id = any(v_clientes);

  raise notice 'Limpieza completada: % cliente(s) de prueba eliminados.', array_length(v_clientes, 1);
end $$;

-- ---- Verificación final (debe dar 0 en todo) ---------------------------
select count(*) as clientes_prueba_restantes from clientes
 where coalesce(nombre,'') ilike '%prueba%'
    or coalesce(apellidos,'') ilike '%prueba%';
