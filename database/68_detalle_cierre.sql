-- ============================================================================
-- Migración 68 — Detalle de la salida y correlativo de OT
-- ============================================================================
--
-- POR QUÉ
-- El cierre guardaba montos agregados: "repuestos $85.000". Con eso no se puede
-- responder qué repuesto se usó ni a qué precio, que es lo que se necesita para
-- el margen por línea, el consumo de bodega y para explicarle el cobro al
-- cliente. Ahora cada línea queda detallada.
--
-- CORRELATIVO
-- El número de OT debe ser único y sin saltos. Se resuelve con una secuencia de
-- Postgres, no contando filas: dos cierres simultáneos contando filas sacarían
-- el mismo número.
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Detalle por línea
-- ----------------------------------------------------------------------------
create table if not exists ot_detalle (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null default '00000000-0000-0000-0000-000000000001',
  trabajo_id   uuid not null references trabajos_taller(id) on delete cascade,

  tipo         text not null,   -- repuesto | servicio | insumo | servicio_externo
  codigo       text,            -- código de repuesto, cuando exista
  detalle      text not null,
  cantidad     numeric(10,2) not null default 1,
  precio_unit  numeric(12,0) not null default 0,
  -- Total de la línea calculado por la base: si lo enviara el frontend, un
  -- error de redondeo o una edición a medias dejaría el documento descuadrado.
  total        numeric(12,0) generated always as (round(cantidad * precio_unit)) stored,

  -- Costo para el margen. Opcional: no siempre se conoce al cerrar.
  costo_unit   numeric(12,0),

  orden        int default 0,
  creado_en    timestamptz default now()
);

comment on table ot_detalle is
  'Líneas de la OT al cerrar: qué repuesto, servicio, insumo o servicio externo se usó y a qué precio.';

create index if not exists ot_detalle_trabajo_idx on ot_detalle (trabajo_id, tipo, orden);

alter table ot_detalle enable row level security;
drop policy if exists ot_detalle_sel on ot_detalle;
drop policy if exists ot_detalle_ins on ot_detalle;
drop policy if exists ot_detalle_upd on ot_detalle;
drop policy if exists ot_detalle_del on ot_detalle;
create policy ot_detalle_sel on ot_detalle for select using (empresa_id = empresa_actual());
create policy ot_detalle_ins on ot_detalle for insert with check (empresa_id = empresa_actual()
  and (es_admin() or es_asesor() or es_adquisiciones() or auth_rol_en(array['jefe_taller'])));
create policy ot_detalle_upd on ot_detalle for update using (empresa_id = empresa_actual()
  and (es_admin() or es_asesor() or es_adquisiciones() or auth_rol_en(array['jefe_taller'])))
  with check (empresa_id = empresa_actual());
create policy ot_detalle_del on ot_detalle for delete using (empresa_id = empresa_actual()
  and (es_admin() or es_asesor() or auth_rol_en(array['jefe_taller'])));


-- ----------------------------------------------------------------------------
-- 2) Correlativo de OT
-- ----------------------------------------------------------------------------
alter table public.trabajos_taller
  add column if not exists ot_numero text;

create unique index if not exists trabajos_ot_numero_uniq
  on public.trabajos_taller (ot_numero) where ot_numero is not null;

-- Secuencia: garantiza unicidad aunque dos asesores cierren a la vez.
-- Se parte en 13600 para continuar la numeración de Dimasoft (la OT 13544 es
-- de agosto de 2026), evitando choques con las ya emitidas.
create sequence if not exists ot_correlativo start 13600;

create or replace function siguiente_ot_numero()
returns text
language sql volatile security definer set search_path = public as $$
  select nextval('ot_correlativo')::text;
$$;

comment on function siguiente_ot_numero() is
  'Correlativo único de OT. Usa una secuencia y no un conteo: contar filas daría el mismo número a dos cierres simultáneos.';


-- ----------------------------------------------------------------------------
-- 3) El total del trabajo se recalcula desde el detalle
-- ----------------------------------------------------------------------------
-- Evita que los montos de cabecera y el detalle se contradigan.
create or replace function recalcular_total_ot(p_trabajo uuid)
returns numeric
language plpgsql security definer set search_path = public as $$
declare v_rep numeric := 0; v_srv numeric := 0; v_ins numeric := 0; v_ext numeric := 0; v_desc numeric := 0;
begin
  select coalesce(sum(total) filter (where tipo = 'repuesto'), 0),
         coalesce(sum(total) filter (where tipo = 'servicio'), 0),
         coalesce(sum(total) filter (where tipo = 'insumo'), 0),
         coalesce(sum(total) filter (where tipo = 'servicio_externo'), 0)
    into v_rep, v_srv, v_ins, v_ext
  from ot_detalle where trabajo_id = p_trabajo;

  select coalesce(descuento, 0) into v_desc from trabajos_taller where id = p_trabajo;

  update trabajos_taller set
    monto_repuestos = v_rep, monto_mano_obra = v_srv,
    monto_lubricantes = v_ins, monto_servicio_ext = v_ext,
    monto_total = v_rep + v_srv + v_ins + v_ext - v_desc
  where id = p_trabajo;

  return v_rep + v_srv + v_ins + v_ext - v_desc;
end $$;


-- Verificación
select table_name from information_schema.tables
where table_schema='public' and table_name='ot_detalle';

select last_value from ot_correlativo;

notify pgrst, 'reload schema';
