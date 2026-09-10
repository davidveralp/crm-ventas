-- ============================================================================
-- Migración 71 — Correlativos de OT y de presupuesto
-- ============================================================================
--
-- DOS CAMBIOS
--
-- 1. El número de OT se asigna AL INGRESAR, no al cerrar.
--    Antes se generaba en el cierre, lo que dejaba al vehículo sin número
--    mientras estaba en el taller: no se podía referenciar por teléfono, ni
--    escribirlo en el papel de ingreso, ni buscarlo. Ahora nace con la OT.
--
-- 2. Los presupuestos llevan su propio correlativo, distinto del de la OT.
--    Un vehículo puede tener varias cotizaciones sobre una misma OT, así que
--    numerarlos igual sería ambiguo. Cada presupuesto queda asociado a su OT y
--    a su patente.
--
-- NUMERACIÓN
-- La secuencia de OT parte en 13736, continuando la de Dimasoft.
-- La de presupuestos parte en 1, con prefijo P para distinguirla a simple vista.
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Correlativo de OT desde 13736
-- ----------------------------------------------------------------------------
-- La secuencia de la migración 68 partía en 13600. Se reposiciona.
-- setval con `true` deja el próximo nextval en 13736.
do $$
begin
  if exists (select 1 from pg_class where relname = 'ot_correlativo') then
    -- Solo se adelanta si la secuencia va por debajo: nunca se retrocede,
    -- porque eso repetiría números ya emitidos.
    if (select last_value from ot_correlativo) < 13736 then
      perform setval('ot_correlativo', 13735, true);
    end if;
  else
    create sequence ot_correlativo start 13736;
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 2) Correlativo de presupuestos
-- ----------------------------------------------------------------------------
create sequence if not exists presupuesto_correlativo start 1;

alter table public.presupuestos_taller
  add column if not exists numero    text,
  add column if not exists ot_numero text,
  add column if not exists patente   text;

create unique index if not exists presup_numero_uniq
  on public.presupuestos_taller (numero) where numero is not null;
create index if not exists presup_ot_idx
  on public.presupuestos_taller (ot_numero) where ot_numero is not null;

comment on column public.presupuestos_taller.numero is
  'Correlativo propio del presupuesto, formato P-00001. Distinto del de la OT porque una OT puede tener varias cotizaciones.';
comment on column public.presupuestos_taller.ot_numero is
  'OT a la que pertenece. Permite encontrar todas las cotizaciones de una atención.';

create or replace function siguiente_presupuesto_numero()
returns text
language sql volatile security definer set search_path = public as $$
  select 'P-' || lpad(nextval('presupuesto_correlativo')::text, 5, '0');
$$;

-- El presupuesto hereda la OT y la patente de su trabajo o vehículo.
create or replace function trg_presupuesto_numerar()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ot text; v_pat text;
begin
  if new.numero is null then
    new.numero := siguiente_presupuesto_numero();
  end if;

  if new.trabajo_id is not null then
    select t.ot_numero, v.patente into v_ot, v_pat
    from trabajos_taller t left join vehiculos v on v.id = t.vehiculo_id
    where t.id = new.trabajo_id;
  elsif new.vehiculo_id is not null then
    select patente into v_pat from vehiculos where id = new.vehiculo_id;
  end if;

  new.ot_numero := coalesce(new.ot_numero, v_ot);
  new.patente   := coalesce(new.patente, v_pat);
  return new;
end $$;

drop trigger if exists tg_presupuesto_numerar on presupuestos_taller;
create trigger tg_presupuesto_numerar
  before insert on presupuestos_taller
  for each row execute function trg_presupuesto_numerar();


-- ----------------------------------------------------------------------------
-- 3) El trabajo recibe su número al crearse
-- ----------------------------------------------------------------------------
create or replace function trg_trabajo_numerar()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ot_numero is null then
    new.ot_numero := nextval('ot_correlativo')::text;
  end if;
  return new;
end $$;

drop trigger if exists tg_trabajo_numerar on trabajos_taller;
create trigger tg_trabajo_numerar
  before insert on trabajos_taller
  for each row execute function trg_trabajo_numerar();


-- Verificación
select last_value as proxima_ot from ot_correlativo;
select last_value as proximo_presupuesto from presupuesto_correlativo;

notify pgrst, 'reload schema';
