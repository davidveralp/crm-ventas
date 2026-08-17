-- ============================================================================
-- Migración 56 — F1a · Helper `auth_rol()` y matriz de permisos por rol
-- ============================================================================
--
-- CIERRA C3 de la Fase 0, el único punto sustantivo que quedaba.
--
-- SITUACIÓN ACTUAL (verificada en 22_actualizacion_v18.sql)
-- Las tablas del módulo operativo tienen una sola política `for all`:
--     using (empresa_id = empresa_actual())
-- Es decir: cualquier usuario autenticado de la empresa puede LEER y ESCRIBIR
-- todo. Un técnico puede modificar montos de presupuestos; un asesor puede
-- reasignar tareas de taller. No es un problema teórico: son cuatro tablas con
-- datos de dinero y asignación de trabajo sin ninguna barrera por rol.
--
-- QUÉ HACE ESTA MIGRACIÓN
--   1. Agrega `auth_rol()` junto a los helpers existentes.
--   2. Reemplaza las políticas `_all` de las tablas del módulo operativo por
--      políticas separadas de lectura y escritura, según la matriz de §5.
--
-- QUÉ NO TOCA (a propósito)
--   Las políticas de `clientes`, `actividades` y `campanas`. Funcionan, están
--   probadas y la migración 41 ya resolvió un caso difícil ahí (lectura de
--   clientes con tarea de campaña asignada). Romperlas para uniformar no vale
--   la pena en esta fase.
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk), NO en "Didial OT".
-- Requiere la migración 55 (usuarios con sus roles reales) para poder probarse.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Helpers de rol
-- ----------------------------------------------------------------------------

create or replace function auth_rol()
returns text as $$
  select rol::text from usuarios where id = auth.uid();
$$ language sql stable security definer;

comment on function auth_rol() is
  'Rol del usuario autenticado, como texto. Complementa es_admin() y empresa_actual().';

-- Pertenencia a un grupo de roles. Evita repetir listas largas en cada política.
create or replace function auth_rol_en(p_roles text[])
returns boolean as $$
  select coalesce(auth_rol() = any(p_roles), false);
$$ language sql stable security definer;

-- Atajos por función de negocio. Nombrarlos así hace las políticas legibles
-- y permite cambiar la composición de un grupo en un solo lugar.
create or replace function es_asesor()
returns boolean as $$
  select auth_rol_en(array['vendedor','asesor_toyota','asesor_multimarca','postventa','supervisor']);
$$ language sql stable security definer;

create or replace function es_taller()
returns boolean as $$
  select auth_rol_en(array['jefe_taller','tecnico']);
$$ language sql stable security definer;

-- Coordinador de adquisiciones = "encargado de presupuestos" de la spec.
-- Se trata como categoría PROPIA y no como parte de es_taller(): participa del
-- flujo de taller y del comercial, pero no necesita ver la operación del box.
create or replace function es_adquisiciones()
returns boolean as $$
  select auth_rol_en(array['coordinador_adquisiciones','encargado_bodega','asistente_bodega']);
$$ language sql stable security definer;

create or replace function es_admin_o_jefe()
returns boolean as $$
  select es_admin() or auth_rol_en(array['jefe_taller','supervisor','asistente_administrativo']);
$$ language sql stable security definer;


-- ----------------------------------------------------------------------------
-- 2) MATRIZ DE PERMISOS
-- ----------------------------------------------------------------------------
-- Criterio general: la LECTURA dentro de la empresa es amplia (el taller es un
-- espacio de coordinación; ocultar información entre roles genera más problemas
-- que los que resuelve). La ESCRITURA es la que se restringe, y se restringe
-- según quién es responsable del dato.
--
--   Entidad               Lectura                     Escritura
--   -------------------   -------------------------   ---------------------------
--   trabajos_taller       toda la empresa             admin, jefe_taller, técnico,
--                                                     asesor (crea el ingreso)
--   tareas_taller         toda la empresa             admin, jefe_taller, técnico
--   presupuestos_taller   toda la empresa             admin, jefe_taller,
--                                                     adquisiciones (elabora),
--                                                     asesor (solicita)
--   notificaciones        solo las propias            el sistema las crea;
--                                                     el destinatario las marca leídas
-- ----------------------------------------------------------------------------

-- ---- trabajos_taller -------------------------------------------------------
drop policy if exists trabajos_taller_all    on trabajos_taller;
drop policy if exists trabajos_taller_sel    on trabajos_taller;
drop policy if exists trabajos_taller_ins    on trabajos_taller;
drop policy if exists trabajos_taller_upd    on trabajos_taller;
drop policy if exists trabajos_taller_del    on trabajos_taller;

create policy trabajos_taller_sel on trabajos_taller
  for select using (empresa_id = empresa_actual());

create policy trabajos_taller_ins on trabajos_taller
  for insert with check (
    empresa_id = empresa_actual()
    and (es_admin() or es_taller() or es_asesor())
  );

create policy trabajos_taller_upd on trabajos_taller
  for update using (
    empresa_id = empresa_actual()
    and (es_admin() or es_taller() or es_asesor())
  ) with check (empresa_id = empresa_actual());

-- Borrar es distinto de editar: solo admin y jefe de taller.
create policy trabajos_taller_del on trabajos_taller
  for delete using (empresa_id = empresa_actual() and es_admin_o_jefe());


-- ---- tareas_taller ---------------------------------------------------------
drop policy if exists tareas_taller_all on tareas_taller;
drop policy if exists tareas_taller_sel on tareas_taller;
drop policy if exists tareas_taller_ins on tareas_taller;
drop policy if exists tareas_taller_upd on tareas_taller;
drop policy if exists tareas_taller_del on tareas_taller;

create policy tareas_taller_sel on tareas_taller
  for select using (empresa_id = empresa_actual());

-- El técnico marca sus ítems de la lista de control: necesita insert y update.
create policy tareas_taller_ins on tareas_taller
  for insert with check (
    empresa_id = empresa_actual() and (es_admin() or es_taller())
  );

create policy tareas_taller_upd on tareas_taller
  for update using (
    empresa_id = empresa_actual() and (es_admin() or es_taller())
  ) with check (empresa_id = empresa_actual());

create policy tareas_taller_del on tareas_taller
  for delete using (empresa_id = empresa_actual() and es_admin_o_jefe());


-- ---- presupuestos_taller ---------------------------------------------------
-- La tabla con dinero. Es la que más importa.
drop policy if exists presupuestos_taller_all on presupuestos_taller;
drop policy if exists presupuestos_taller_sel on presupuestos_taller;
drop policy if exists presupuestos_taller_ins on presupuestos_taller;
drop policy if exists presupuestos_taller_upd on presupuestos_taller;
drop policy if exists presupuestos_taller_del on presupuestos_taller;

create policy presupuestos_taller_sel on presupuestos_taller
  for select using (empresa_id = empresa_actual());

-- Quién puede crear una solicitud de presupuesto: el asesor la pide, el jefe
-- de taller la origina desde la revisión, adquisiciones la elabora.
create policy presupuestos_taller_ins on presupuestos_taller
  for insert with check (
    empresa_id = empresa_actual()
    and (es_admin() or es_asesor() or auth_rol_en(array['jefe_taller']) or es_adquisiciones())
  );

-- El TÉCNICO queda fuera de la escritura: no fija montos ni cambia estados
-- comerciales. Es el cambio de fondo respecto de la política anterior.
create policy presupuestos_taller_upd on presupuestos_taller
  for update using (
    empresa_id = empresa_actual()
    and (es_admin() or es_asesor() or auth_rol_en(array['jefe_taller']) or es_adquisiciones())
  ) with check (empresa_id = empresa_actual());

create policy presupuestos_taller_del on presupuestos_taller
  for delete using (empresa_id = empresa_actual() and es_admin());


-- ---- notificaciones --------------------------------------------------------
-- Cada usuario ve SOLO las suyas. Con la política anterior (`for all` por
-- empresa) cualquiera leía las notificaciones de los demás.
--
-- La tabla admite dos formas de dirigir un aviso: `usuario_id` (destinatario
-- directo) o `rol_destino` (todos los de un rol, con `leida_por` como jsonb de
-- quiénes ya la vieron). La política debe cubrir AMBAS, o los avisos dirigidos
-- por rol —que son los del circuito N6-N9— quedarían invisibles.
drop policy if exists notificaciones_all on notificaciones;
drop policy if exists notificaciones_sel on notificaciones;
drop policy if exists notificaciones_ins on notificaciones;
drop policy if exists notificaciones_upd on notificaciones;
drop policy if exists notificaciones_del on notificaciones;

create policy notificaciones_sel on notificaciones
  for select using (
    empresa_id = empresa_actual()
    and (
      usuario_id = auth.uid()                    -- dirigida a mí
      or rol_destino = auth_rol()                -- dirigida a mi rol
      or (usuario_id is null and rol_destino is null)  -- difusión general
      or es_admin()
    )
  );

-- Cualquier usuario autenticado puede generar una notificación dirigida a otro:
-- así funciona el circuito N6-N9 (el jefe avisa al coordinador, el coordinador
-- avisa al asesor). El emisor no necesita permiso especial sobre el receptor.
create policy notificaciones_ins on notificaciones
  for insert with check (empresa_id = empresa_actual());

-- Marcar como leída. Incluye las de `rol_destino`, porque marcarlas implica
-- un update sobre `leida_por` hecho por alguien que no es `usuario_id`.
create policy notificaciones_upd on notificaciones
  for update using (
    empresa_id = empresa_actual()
    and (usuario_id = auth.uid() or rol_destino = auth_rol() or es_admin())
  ) with check (empresa_id = empresa_actual());

create policy notificaciones_del on notificaciones
  for delete using (
    empresa_id = empresa_actual() and (usuario_id = auth.uid() or es_admin())
  );


-- ---- inspecciones_ingreso --------------------------------------------------
-- Se incluye porque es la base de F4 y hoy depende de las políticas genéricas
-- de la migración 47.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='inspecciones_ingreso') then
    execute 'alter table inspecciones_ingreso enable row level security';
    execute 'drop policy if exists inspecciones_ingreso_all on inspecciones_ingreso';
    execute 'drop policy if exists inspecciones_sel on inspecciones_ingreso';
    execute 'drop policy if exists inspecciones_ins on inspecciones_ingreso';
    execute 'drop policy if exists inspecciones_upd on inspecciones_ingreso';
    execute 'create policy inspecciones_sel on inspecciones_ingreso
               for select using (empresa_id = empresa_actual())';
    -- El técnico y el asesor capturan la inspección en la recepción del vehículo
    execute 'create policy inspecciones_ins on inspecciones_ingreso
               for insert with check (empresa_id = empresa_actual()
                 and (es_admin() or es_taller() or es_asesor()))';
    execute 'create policy inspecciones_upd on inspecciones_ingreso
               for update using (empresa_id = empresa_actual()
                 and (es_admin() or es_taller() or es_asesor()))
               with check (empresa_id = empresa_actual())';
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 3) VERIFICACIÓN
-- ----------------------------------------------------------------------------

-- Los helpers deben existir
select p.proname as funcion
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname in ('empresa_actual','es_admin','auth_rol','auth_rol_en',
                    'es_asesor','es_taller','es_adquisiciones','es_admin_o_jefe')
order by p.proname;

-- Políticas resultantes: no debe quedar ninguna llamada `%_all` en estas tablas
select tablename, policyname, cmd
from pg_policies
where schemaname='public'
  and tablename in ('trabajos_taller','tareas_taller','presupuestos_taller',
                    'notificaciones','inspecciones_ingreso')
order by tablename, cmd, policyname;

-- Control: ninguna política `for all` sobrevive en el módulo operativo
select tablename, policyname
from pg_policies
where schemaname='public' and cmd='ALL'
  and tablename in ('trabajos_taller','tareas_taller','presupuestos_taller','notificaciones');

-- Prueba manual sugerida: iniciar sesión como Víctor Tello y como un técnico,
-- e intentar editar un presupuesto. El técnico debe recibir un error de
-- permisos; Víctor debe poder. Sin esa prueba, la matriz no está verificada.
