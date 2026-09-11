-- ============================================================================
-- Migración 75 — Borrado de fichas para administración
-- ============================================================================
--
-- POR QUÉ CON CUIDADO
-- Borrar un cliente o un vehículo arrastra su historial: OTs, inspecciones,
-- presupuestos y encuestas cuelgan de ellos. Un borrado accidental no se
-- recupera.
--
-- Por eso el borrado es LÓGICO, no físico: la ficha se marca como eliminada y
-- desaparece de las listas, pero el historial queda intacto y se puede
-- restaurar. Solo admin puede hacerlo.
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk).
-- ============================================================================

alter table public.vehiculos
  add column if not exists eliminado_en  timestamptz,
  add column if not exists eliminado_por uuid references usuarios(id) on delete set null,
  add column if not exists motivo_baja   text;

alter table public.clientes
  add column if not exists eliminado_en  timestamptz,
  add column if not exists eliminado_por uuid references usuarios(id) on delete set null,
  add column if not exists motivo_baja   text;

comment on column public.vehiculos.eliminado_en is
  'Borrado lógico. La ficha desaparece de las listas pero el historial se conserva y se puede restaurar.';

create index if not exists vehiculos_activos_idx on public.vehiculos (empresa_id) where eliminado_en is null;
create index if not exists clientes_activos_idx  on public.clientes (empresa_id) where eliminado_en is null;

/* Marca la ficha como eliminada. Solo admin.
   Devuelve cuántos registros quedan asociados, para poder advertirlo. */
create or replace function eliminar_ficha(
  p_tabla text, p_id uuid, p_motivo text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_dep jsonb;
begin
  if not es_admin() then
    raise exception 'Solo administración puede eliminar fichas';
  end if;

  if p_tabla = 'vehiculos' then
    select jsonb_build_object(
      'ordenes',      (select count(*) from trabajos_taller where vehiculo_id = p_id),
      'inspecciones', (select count(*) from inspecciones_ingreso where vehiculo_id = p_id),
      'presupuestos', (select count(*) from presupuestos_taller where vehiculo_id = p_id)
    ) into v_dep;
    update vehiculos set eliminado_en = now(), eliminado_por = auth.uid(), motivo_baja = p_motivo
    where id = p_id;

  elsif p_tabla = 'clientes' then
    select jsonb_build_object(
      'vehiculos', (select count(*) from vehiculos where cliente_id = p_id and eliminado_en is null),
      'ordenes',   (select count(*) from trabajos_taller where cliente_id = p_id)
    ) into v_dep;
    update clientes set eliminado_en = now(), eliminado_por = auth.uid(), motivo_baja = p_motivo
    where id = p_id;
  else
    raise exception 'Tabla no permitida: %', p_tabla;
  end if;

  return jsonb_build_object('ok', true, 'dependencias', v_dep);
end $$;

create or replace function restaurar_ficha(p_tabla text, p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo administración puede restaurar'; end if;
  if p_tabla = 'vehiculos' then
    update vehiculos set eliminado_en = null, eliminado_por = null, motivo_baja = null where id = p_id;
  elsif p_tabla = 'clientes' then
    update clientes set eliminado_en = null, eliminado_por = null, motivo_baja = null where id = p_id;
  else raise exception 'Tabla no permitida'; end if;
  return true;
end $$;

-- Borrado de un trabajo (tarjeta del panel). Este sí es físico: una OT mal
-- creada no aporta historial. El detalle se va en cascada.
create or replace function eliminar_trabajo(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin_o_jefe() then
    raise exception 'Solo administración o jefatura puede eliminar órdenes';
  end if;
  if exists (select 1 from trabajos_taller where id = p_id and cierre_estado = 'cerrado') then
    raise exception 'No se puede eliminar una OT cerrada. Anúlala en su lugar.';
  end if;
  delete from trabajos_taller where id = p_id;
  return true;
end $$;

select routine_name from information_schema.routines
where routine_schema='public'
  and routine_name in ('eliminar_ficha','restaurar_ficha','eliminar_trabajo');

notify pgrst, 'reload schema';
