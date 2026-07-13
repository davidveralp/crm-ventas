-- =====================================================================
-- ACTUALIZACIÓN v35 · "Eliminar ficha" arrastra Taller y Presupuestos
-- + Limpieza única de las pruebas actuales en esos dos módulos
-- ---------------------------------------------------------------------
-- 1) Corrige las FK de trabajos_taller.cliente_id y presupuestos_taller.
--    cliente_id (hoy "on delete set null") a "on delete cascade", para
--    que eliminar una ficha borre también sus trabajos de taller y
--    presupuestos de taller. El resto de tablas relacionadas (vehiculos,
--    presupuestos comerciales, tareas_campana, actividades) YA cascadea
--    correctamente — no se tocan.
-- 2) Limpieza única: vacía TODO lo existente hoy en trabajos_taller,
--    presupuestos_taller y presupuestos (comercial) — son pruebas. NO
--    toca clientes, vehículos, ni facturas_repuestos/repuestos_facturados
--    (se dejan intactos por si ya hay sincronización real).
-- Idempotente en el sentido de que reejecutarla no genera error; el
-- borrado del paso 2 solo tiene efecto la primera vez (después no habrá
-- filas que borrar).
-- =====================================================================

-- ---- 1) Arreglar las FK a CASCADE (búsqueda dinámica del nombre real) --
do $$
declare
  con text;
begin
  select tc.constraint_name into con
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
   where tc.table_name = 'trabajos_taller' and kcu.column_name = 'cliente_id'
     and tc.constraint_type = 'FOREIGN KEY' limit 1;
  if con is not null then
    execute format('alter table trabajos_taller drop constraint %I', con);
  end if;
  alter table trabajos_taller
    add constraint trabajos_taller_cliente_id_fkey
    foreign key (cliente_id) references clientes(id) on delete cascade;
end $$;

do $$
declare
  con text;
begin
  select tc.constraint_name into con
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
   where tc.table_name = 'presupuestos_taller' and kcu.column_name = 'cliente_id'
     and tc.constraint_type = 'FOREIGN KEY' limit 1;
  if con is not null then
    execute format('alter table presupuestos_taller drop constraint %I', con);
  end if;
  alter table presupuestos_taller
    add constraint presupuestos_taller_cliente_id_fkey
    foreign key (cliente_id) references clientes(id) on delete cascade;
end $$;

-- ---- 2) Limpieza única de las pruebas actuales -------------------------
-- Orden: presupuestos_taller antes que trabajos_taller (por si alguno
-- referenciara un trabajo_id que se borra después).
delete from presupuestos_taller;
delete from trabajos_taller;
delete from presupuestos;   -- pipeline comercial (incluye las solicitudes de la ficha)

-- ---- Verificación -------------------------------------------------------
select
  (select count(*) from trabajos_taller)     as trabajos_taller_restantes,
  (select count(*) from presupuestos_taller) as presupuestos_taller_restantes,
  (select count(*) from presupuestos)        as presupuestos_comerciales_restantes,
  (select count(*) from clientes)            as clientes_intactos,
  (select count(*) from vehiculos)           as vehiculos_intactos,
  (select count(*) from facturas_repuestos)  as facturas_intactas;
