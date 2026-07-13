-- =====================================================================
-- DIDIAL CRM · POLÍTICAS DE SEGURIDAD POR FILAS (RLS)
-- =====================================================================
-- Regla general:
--   · Cada usuario solo ve datos de SU empresa (aislamiento multi-empresa).
--   · ADMIN ve y edita todo dentro de su empresa.
--   · VENDEDOR ve y edita solo los clientes/actividades asignados a él.
-- =====================================================================

-- Activar RLS en todas las tablas
alter table empresas         enable row level security;
alter table usuarios         enable row level security;
alter table pipeline_estados enable row level security;
alter table clientes         enable row level security;
alter table vehiculos        enable row level security;
alter table actividades      enable row level security;
alter table campanas         enable row level security;
alter table auditoria        enable row level security;

-- ---------------------------------------------------------------------
-- EMPRESAS
-- ---------------------------------------------------------------------
drop policy if exists empresas_select on empresas;
create policy empresas_select on empresas
  for select using (id = empresa_actual());

-- ---------------------------------------------------------------------
-- USUARIOS
-- ---------------------------------------------------------------------
drop policy if exists usuarios_select on usuarios;
create policy usuarios_select on usuarios
  for select using (empresa_id = empresa_actual());

drop policy if exists usuarios_admin_all on usuarios;
create policy usuarios_admin_all on usuarios
  for all using (empresa_id = empresa_actual() and es_admin())
  with check (empresa_id = empresa_actual() and es_admin());

-- ---------------------------------------------------------------------
-- PIPELINE_ESTADOS
-- ---------------------------------------------------------------------
drop policy if exists estados_select on pipeline_estados;
create policy estados_select on pipeline_estados
  for select using (empresa_id = empresa_actual());

drop policy if exists estados_admin on pipeline_estados;
create policy estados_admin on pipeline_estados
  for all using (empresa_id = empresa_actual() and es_admin())
  with check (empresa_id = empresa_actual() and es_admin());

-- ---------------------------------------------------------------------
-- CLIENTES
--   Vendedor: solo los suyos.  Admin: todos los de la empresa.
-- ---------------------------------------------------------------------
drop policy if exists clientes_select on clientes;
create policy clientes_select on clientes
  for select using (
    empresa_id = empresa_actual()
    and (es_admin() or vendedor_id = auth.uid())
  );

drop policy if exists clientes_insert on clientes;
create policy clientes_insert on clientes
  for insert with check (empresa_id = empresa_actual());

drop policy if exists clientes_update on clientes;
create policy clientes_update on clientes
  for update using (
    empresa_id = empresa_actual()
    and (es_admin() or vendedor_id = auth.uid())
  );

drop policy if exists clientes_delete on clientes;
create policy clientes_delete on clientes
  for delete using (empresa_id = empresa_actual() and es_admin());

-- ---------------------------------------------------------------------
-- VEHÍCULOS  (heredan el acceso del cliente vía empresa + admin/vendedor)
-- ---------------------------------------------------------------------
drop policy if exists vehiculos_select on vehiculos;
create policy vehiculos_select on vehiculos
  for select using (
    empresa_id = empresa_actual()
    and (es_admin() or exists (
      select 1 from clientes c
      where c.id = vehiculos.cliente_id and c.vendedor_id = auth.uid()
    ))
  );

drop policy if exists vehiculos_write on vehiculos;
create policy vehiculos_write on vehiculos
  for all using (empresa_id = empresa_actual())
  with check (empresa_id = empresa_actual());

-- ---------------------------------------------------------------------
-- ACTIVIDADES
-- ---------------------------------------------------------------------
drop policy if exists actividades_select on actividades;
create policy actividades_select on actividades
  for select using (
    empresa_id = empresa_actual()
    and (es_admin() or vendedor_id = auth.uid())
  );

drop policy if exists actividades_insert on actividades;
create policy actividades_insert on actividades
  for insert with check (empresa_id = empresa_actual());

drop policy if exists actividades_update on actividades;
create policy actividades_update on actividades
  for update using (
    empresa_id = empresa_actual()
    and (es_admin() or vendedor_id = auth.uid())
  );

drop policy if exists actividades_delete on actividades;
create policy actividades_delete on actividades
  for delete using (
    empresa_id = empresa_actual()
    and (es_admin() or vendedor_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- CAMPAÑAS  (toda la empresa las ve; admin las gestiona)
-- ---------------------------------------------------------------------
drop policy if exists campanas_select on campanas;
create policy campanas_select on campanas
  for select using (empresa_id = empresa_actual());

drop policy if exists campanas_admin on campanas;
create policy campanas_admin on campanas
  for all using (empresa_id = empresa_actual() and es_admin())
  with check (empresa_id = empresa_actual() and es_admin());

-- ---------------------------------------------------------------------
-- AUDITORÍA  (solo lectura; la escribe el trigger)
-- ---------------------------------------------------------------------
drop policy if exists auditoria_select on auditoria;
create policy auditoria_select on auditoria
  for select using (empresa_id = empresa_actual());
