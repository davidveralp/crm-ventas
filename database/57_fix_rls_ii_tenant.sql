-- ============================================================================
-- Migración 57 — CORRECCIÓN de la 56: política `ii_tenant` sobreviviente
-- ============================================================================
--
-- PROBLEMA
-- Tras ejecutar la migración 56, la verificación devolvió:
--
--     inspecciones_ingreso | ii_tenant | ALL     ← no debería estar
--     inspecciones_ingreso | inspecciones_ins | INSERT
--     inspecciones_ingreso | inspecciones_sel | SELECT
--     inspecciones_ingreso | inspecciones_upd | UPDATE
--
-- CAUSA
-- La migración 47 creó la política con el nombre `ii_tenant`, no
-- `inspecciones_ingreso_all`. La 56 intentaba eliminarla por el nombre
-- equivocado, así que el DROP no encontró nada y la política sobrevivió.
--
-- POR QUÉ IMPORTA (no es cosmético)
-- En PostgreSQL las políticas PERMISIVAS del mismo comando se combinan con OR.
-- Mientras `ii_tenant` exista como `for all using (empresa_id = empresa_actual())`,
-- basta con cumplir ESA condición para escribir: las tres políticas por rol
-- quedan decorativas. Cualquier usuario de la empresa —incluido un técnico sin
-- permiso, o un asistente de bodega— podría seguir creando y modificando
-- inspecciones.
--
-- Las otras cuatro tablas quedaron correctas: allí el nombre generado por la
-- migración 22 sí era `<tabla>_all` y el DROP funcionó.
--
-- LECCIÓN APLICADA ABAJO
-- No se eliminan políticas por nombre adivinado. Se recorre `pg_policies` y se
-- eliminan TODAS las de la tabla antes de recrear, que es la única forma de
-- garantizar que no sobreviva ninguna.
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Eliminar toda política existente en las cinco tablas y recrear la matriz
-- ----------------------------------------------------------------------------
-- Idempotente: se puede ejecutar de nuevo sin efectos secundarios.

do $$
declare
  r record;
  tablas text[] := array['trabajos_taller','tareas_taller','presupuestos_taller',
                         'notificaciones','inspecciones_ingreso'];
  t text;
begin
  foreach t in array tablas loop
    if not exists (select 1 from information_schema.tables
                   where table_schema='public' and table_name=t) then
      raise notice 'Tabla % no existe, se omite', t;
      continue;
    end if;
    -- Barrido completo: cualquier política, con cualquier nombre
    for r in select policyname from pg_policies
             where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I', r.policyname, t);
      raise notice 'Eliminada política % de %', r.policyname, t;
    end loop;
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 2) Recrear la matriz completa (idéntica a la migración 56)
-- ----------------------------------------------------------------------------

-- ---- trabajos_taller -------------------------------------------------------
create policy trabajos_taller_sel on trabajos_taller
  for select using (empresa_id = empresa_actual());
create policy trabajos_taller_ins on trabajos_taller
  for insert with check (empresa_id = empresa_actual()
    and (es_admin() or es_taller() or es_asesor()));
create policy trabajos_taller_upd on trabajos_taller
  for update using (empresa_id = empresa_actual()
    and (es_admin() or es_taller() or es_asesor()))
  with check (empresa_id = empresa_actual());
create policy trabajos_taller_del on trabajos_taller
  for delete using (empresa_id = empresa_actual() and es_admin_o_jefe());

-- ---- tareas_taller ---------------------------------------------------------
create policy tareas_taller_sel on tareas_taller
  for select using (empresa_id = empresa_actual());
create policy tareas_taller_ins on tareas_taller
  for insert with check (empresa_id = empresa_actual()
    and (es_admin() or es_taller()));
create policy tareas_taller_upd on tareas_taller
  for update using (empresa_id = empresa_actual()
    and (es_admin() or es_taller()))
  with check (empresa_id = empresa_actual());
create policy tareas_taller_del on tareas_taller
  for delete using (empresa_id = empresa_actual() and es_admin_o_jefe());

-- ---- presupuestos_taller ---------------------------------------------------
-- El técnico NO escribe aquí: no fija montos ni cambia estados comerciales.
create policy presupuestos_taller_sel on presupuestos_taller
  for select using (empresa_id = empresa_actual());
create policy presupuestos_taller_ins on presupuestos_taller
  for insert with check (empresa_id = empresa_actual()
    and (es_admin() or es_asesor() or auth_rol_en(array['jefe_taller']) or es_adquisiciones()));
create policy presupuestos_taller_upd on presupuestos_taller
  for update using (empresa_id = empresa_actual()
    and (es_admin() or es_asesor() or auth_rol_en(array['jefe_taller']) or es_adquisiciones()))
  with check (empresa_id = empresa_actual());
create policy presupuestos_taller_del on presupuestos_taller
  for delete using (empresa_id = empresa_actual() and es_admin());

-- ---- notificaciones --------------------------------------------------------
-- Cubre las dos formas de dirigir un aviso: usuario_id y rol_destino.
create policy notificaciones_sel on notificaciones
  for select using (empresa_id = empresa_actual()
    and (usuario_id = auth.uid() or rol_destino = auth_rol()
         or (usuario_id is null and rol_destino is null) or es_admin()));
create policy notificaciones_ins on notificaciones
  for insert with check (empresa_id = empresa_actual());
create policy notificaciones_upd on notificaciones
  for update using (empresa_id = empresa_actual()
    and (usuario_id = auth.uid() or rol_destino = auth_rol() or es_admin()))
  with check (empresa_id = empresa_actual());
create policy notificaciones_del on notificaciones
  for delete using (empresa_id = empresa_actual()
    and (usuario_id = auth.uid() or es_admin()));

-- ---- inspecciones_ingreso --------------------------------------------------
create policy inspecciones_sel on inspecciones_ingreso
  for select using (empresa_id = empresa_actual());
create policy inspecciones_ins on inspecciones_ingreso
  for insert with check (empresa_id = empresa_actual()
    and (es_admin() or es_taller() or es_asesor()));
create policy inspecciones_upd on inspecciones_ingreso
  for update using (empresa_id = empresa_actual()
    and (es_admin() or es_taller() or es_asesor()))
  with check (empresa_id = empresa_actual());
create policy inspecciones_del on inspecciones_ingreso
  for delete using (empresa_id = empresa_actual() and es_admin_o_jefe());


-- ----------------------------------------------------------------------------
-- 3) VERIFICACIÓN — debe devolver CERO filas
-- ----------------------------------------------------------------------------
-- Cualquier política ALL sobreviviente anula la matriz por OR.
select tablename, policyname, cmd, permissive
from pg_policies
where schemaname='public' and cmd='ALL'
  and tablename in ('trabajos_taller','tareas_taller','presupuestos_taller',
                    'notificaciones','inspecciones_ingreso');

-- Estado final esperado: 4 políticas por tabla (SELECT/INSERT/UPDATE/DELETE),
-- 20 en total, ninguna con cmd = ALL.
select tablename, count(*) as politicas,
       string_agg(cmd, ', ' order by cmd) as comandos
from pg_policies
where schemaname='public'
  and tablename in ('trabajos_taller','tareas_taller','presupuestos_taller',
                    'notificaciones','inspecciones_ingreso')
group by tablename
order by tablename;

-- Control global: ¿queda alguna otra tabla del proyecto con política ALL que
-- convenga revisar más adelante? (No se toca ahora: `clientes`, `actividades`
-- y `campanas` quedan fuera de esta fase a propósito.)
select tablename, policyname
from pg_policies
where schemaname='public' and cmd='ALL'
order by tablename, policyname;
