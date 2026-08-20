-- ============================================================================
-- Migración 61 — Marca de ficha de cliente incompleta
-- ============================================================================
--
-- CONTEXTO
-- El panel "Nuevo cliente" (v79) permite crear una ficha SIN vehículo asociado,
-- para el caso del cliente que no trae auto. Esas fichas se marcan como
-- incompletas para poder encontrarlas después y completarlas, en vez de que
-- se pierdan entre las 1.549 existentes.
--
-- Sin esta migración, el modo "Solo cliente" del panel falla con
-- 'column clientes.ficha_incompleta does not exist'.
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk).
-- ============================================================================

alter table public.clientes
  add column if not exists ficha_incompleta boolean not null default false;

comment on column public.clientes.ficha_incompleta is
  'Ficha creada sin vehículo asociado. Se limpia sola al registrarle uno (trigger de abajo).';

create index if not exists clientes_ficha_incompleta_idx
  on public.clientes (empresa_id) where ficha_incompleta;

-- Al asociarle un vehículo, la ficha deja de estar incompleta. Es preferible a
-- pedirle al usuario que desmarque una casilla que probablemente olvidará.
create or replace function trg_cliente_completa()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cliente_id is not null then
    update clientes set ficha_incompleta = false
    where id = new.cliente_id and ficha_incompleta;
  end if;
  return new;
end $$;

drop trigger if exists tg_veh_completa_cliente on vehiculos;
create trigger tg_veh_completa_cliente
  after insert on vehiculos
  for each row execute function trg_cliente_completa();

-- Regularizar lo existente: cualquier ficha con vehículo no está incompleta.
update clientes c set ficha_incompleta = false
where ficha_incompleta
  and exists (select 1 from vehiculos v where v.cliente_id = c.id);

-- Verificación
select count(*) filter (where ficha_incompleta) as incompletas,
       count(*)                                  as total
from clientes;
