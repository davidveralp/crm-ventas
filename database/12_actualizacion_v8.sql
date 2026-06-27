-- =====================================================================
-- DIDIAL CRM · ACTUALIZACIÓN v8
-- Vinculación AUTOMÁTICA de servicios (historial de OT) con vehículos,
-- por patente, en ambos sentidos. Reemplaza el paso manual de "vincular".
-- Ejecutar en el SQL Editor de Supabase. Es seguro re-ejecutarlo.
-- =====================================================================

-- ---- 1. Al insertar/actualizar un SERVICIO: busca su vehículo --------
create or replace function fn_vincular_servicio()
returns trigger as $$
declare
  v_id uuid;
  c_id uuid;
begin
  if new.patente is not null then
    select v.id, v.cliente_id into v_id, c_id
    from vehiculos v
    where regexp_replace(upper(v.patente), '[^A-Z0-9]', '', 'g')
        = regexp_replace(upper(new.patente), '[^A-Z0-9]', '', 'g')
    limit 1;
    if found then
      new.vehiculo_id := v_id;
      new.cliente_id  := coalesce(new.cliente_id, c_id);
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_vincular_servicio on servicios;
create trigger trg_vincular_servicio
  before insert or update on servicios
  for each row execute function fn_vincular_servicio();

-- ---- 2. Al crear/editar un VEHÍCULO: engancha sus servicios huérfanos -
create or replace function fn_vincular_servicios_de_vehiculo()
returns trigger as $$
begin
  update servicios s
    set vehiculo_id = new.id,
        cliente_id  = coalesce(s.cliente_id, new.cliente_id)
  where s.vehiculo_id is null
    and s.patente is not null
    and new.patente is not null
    and regexp_replace(upper(new.patente), '[^A-Z0-9]', '', 'g')
      = regexp_replace(upper(s.patente), '[^A-Z0-9]', '', 'g');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_vincular_servicios_veh on vehiculos;
create trigger trg_vincular_servicios_veh
  after insert or update of patente on vehiculos
  for each row execute function fn_vincular_servicios_de_vehiculo();

-- ---- 3. Enganche inicial de lo que ya está cargado ------------------
update servicios s
  set vehiculo_id = v.id,
      cliente_id  = coalesce(s.cliente_id, v.cliente_id)
from vehiculos v
where s.vehiculo_id is null
  and s.patente is not null
  and regexp_replace(upper(v.patente), '[^A-Z0-9]', '', 'g')
    = regexp_replace(upper(s.patente), '[^A-Z0-9]', '', 'g');

-- Listo. Desde ahora la vinculación es automática en ambos sentidos.
