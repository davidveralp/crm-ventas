-- ============================================================================
-- Migración 76 — Numerar las OT que quedaron sin número
-- ============================================================================
--
-- SÍNTOMA: órdenes que muestran "OT s/n".
--
-- CAUSA POSIBLE 1: la migración 71 no se ejecutó, así que el trigger que asigna
--   el correlativo no existe. Este script lo crea de nuevo, por si acaso.
-- CAUSA POSIBLE 2: la orden se creó antes de la 71. Este script las numera.
--
-- Las existentes se numeran POR ORDEN DE CREACIÓN, para que el correlativo
-- respete la cronología real y no el orden en que Postgres las devuelva.
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk).
-- ============================================================================

-- 1. La secuencia y el trigger, por si la 71 no se ejecutó
create sequence if not exists ot_correlativo start 13736;

do $$
begin
  if (select last_value from ot_correlativo) < 13736 then
    perform setval('ot_correlativo', 13735, true);
  end if;
end $$;

alter table public.trabajos_taller add column if not exists ot_numero text;

create unique index if not exists trabajos_ot_numero_uniq
  on public.trabajos_taller (ot_numero) where ot_numero is not null;

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


-- 2. Numerar las que quedaron sin número, respetando el orden cronológico
do $$
declare r record;
begin
  for r in
    select id from trabajos_taller where ot_numero is null order by creado_en
  loop
    update trabajos_taller
    set ot_numero = nextval('ot_correlativo')::text
    where id = r.id;
  end loop;
end $$;


-- Verificación
select count(*) filter (where ot_numero is null) as sin_numero,
       count(*)                                   as total,
       min(ot_numero::int)                        as primera,
       max(ot_numero::int)                        as ultima
from trabajos_taller where ot_numero ~ '^[0-9]+$' or ot_numero is null;

select last_value as proxima_ot from ot_correlativo;

notify pgrst, 'reload schema';
