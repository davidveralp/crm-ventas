-- =====================================================================
-- ACTUALIZACIÓN v21 · Ficha de cliente, presupuestos y base de precios
-- 1) Clientes: nombres y apellidos separados (aplica de aquí en adelante).
-- 2) Vehículos: tipo de vehículo (AUTO / SUV / PICK UP / VAN-FURGÓN-CAMIÓN)
--    para cruzar con la base de precios.
-- 3) Servicios: boleta/factura asociada a la OT (respaldo de garantía).
-- 4) Catálogo de tareas predefinidas por servicio (ej: MAN X PAUTA).
-- 5) Base de precios (servicios, precios fijos e insumos) — el seed de
--    datos va en 26_seed_precios_v21.sql.
-- 6) Función de sincronización Sheet -> CRM para datos de contacto y
--    vehículo (completa vacíos, no pisa datos ya cargados en el CRM).
-- Idempotente. Ejecutar en el SQL Editor de Supabase ANTES del seed 26.
-- =====================================================================

-- ---- 1) Nombres y apellidos separados --------------------------------
alter table clientes add column if not exists apellidos text;

-- ---- 2) Tipo de vehículo ---------------------------------------------
alter table vehiculos add column if not exists tipo_vehiculo text; -- AUTO | SUV | PICK UP | VAN/FURGON/CAMION

-- ---- 3) Documento (boleta/factura) en el historial de servicios ------
alter table servicios add column if not exists tipo_documento text;  -- Boleta | Factura | Sin Documento
alter table servicios add column if not exists nro_documento  text;

-- ---- 4) Tareas predefinidas por servicio ------------------------------
create table if not exists tareas_servicio (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  servicio    text not null,     -- nombre EXACTO del catálogo de servicios de la OT (ej: 'MAN X PAUTA')
  titulo      text not null,
  orden       int  default 0,
  creado_en   timestamptz default now()
);
create index if not exists ix_tareas_servicio on tareas_servicio(empresa_id, servicio);
alter table tareas_servicio enable row level security;
drop policy if exists tareas_servicio_all on tareas_servicio;
create policy tareas_servicio_all on tareas_servicio for all
  using (empresa_id = empresa_actual()) with check (empresa_id = empresa_actual());

-- Seed: MANTENCIÓN POR PAUTA (32 tareas, documento oficial de Didial)
delete from tareas_servicio
 where empresa_id = '00000000-0000-0000-0000-000000000001' and servicio = 'MAN X PAUTA';
insert into tareas_servicio (empresa_id, servicio, titulo, orden)
select '00000000-0000-0000-0000-000000000001', 'MAN X PAUTA', t, o from (values
  ('Cambio de aceite de motor y filtro', 1),
  ('Cambio de filtro de aire', 2),
  ('Cambio filtro aire acondicionado', 3),
  ('Cambio de líquido de frenos', 4),
  ('Cambio de aceite de caja de cambios', 5),
  ('Cambio de aceite diferencial delantero', 6),
  ('Cambio de aceite diferencial trasero', 7),
  ('Cambio de aceite de dirección', 8),
  ('Cambio de refrigerante', 9),
  ('Alineación', 10),
  ('Scanner', 11),
  ('Revisión y relleno de niveles', 12),
  ('Revisión de estado líquido de frenos', 13),
  ('Revisión de correas de accesorios y ajuste', 14),
  ('Revisión de carga de batería y alternador', 15),
  ('Revisión de funcionamiento de aire acondicionado', 16),
  ('Revisión de plumillas y eyectores lanza agua', 17),
  ('Revisión de funcionamiento de bocina', 18),
  ('Revisión de ampolletas y cambio si es necesario', 19),
  ('Revisión de nivel de aceite transmisión y demás aceites', 20),
  ('Revisión de posibles fugas', 21),
  ('Revisión de tren delantero y reapriete si es necesario', 22),
  ('Revisión de suspensión delantera', 23),
  ('Revisión de tren trasero', 24),
  ('Revisión de suspensión trasera', 25),
  ('Revisión de crucetas, cardán y puntos de engrase', 26),
  ('Mantención de frenos delanteros — indicar vida útil', 27),
  ('Mantención de frenos traseros — indicar vida útil', 28),
  ('Rotación de neumáticos y balanceo 4 ruedas', 29),
  ('Revisión del funcionamiento del sistema de embrague', 30),
  ('Limpieza exterior del vehículo (sin costo)', 31)
) as v(t, o);

-- ---- 5) Base de precios ----------------------------------------------
-- tipo = 'servicio' (MO por tipo de vehículo + rango eco/premium de
-- repuestos), 'fijo' (precio único) o 'insumo'.
create table if not exists precios_base (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  tipo          text not null default 'servicio',  -- servicio | fijo | insumo
  categoria     text,
  codigo        text,
  nombre        text not null,
  tipo_vehiculo text,             -- AUTO | SUV | PICK UP | VAN/FURGON/CAMION (null en fijos/insumos)
  horas_mo      numeric,
  valor_mo      numeric,          -- MO con IVA incluido (servicios)
  rep_eco       numeric,          -- referencia repuestos económicos
  rep_premium   numeric,          -- referencia repuestos premium
  insumos       numeric,          -- insumos asociados al servicio
  precio        numeric,          -- precio único (fijos e insumos)
  notas         text,
  actualizado_en timestamptz default now()
);
create index if not exists ix_precios_codigo on precios_base(empresa_id, codigo);
create index if not exists ix_precios_nombre on precios_base(empresa_id, nombre);
alter table precios_base enable row level security;
drop policy if exists precios_base_all on precios_base;
create policy precios_base_all on precios_base for all
  using (empresa_id = empresa_actual()) with check (empresa_id = empresa_actual());

-- ---- 6) Sincronización Sheet -> CRM (contacto y vehículo) -------------
-- La llama el Apps Script (service_role) después de subir los servicios.
-- Política de conflictos: la planilla SOLO COMPLETA campos vacíos del CRM
-- (no pisa lo que ya editaste en el CRM). El CRM -> planilla sí escribe
-- siempre, al momento de editar. km_ultimo sí se actualiza si es mayor.
create or replace function crm_aplicar_datos_ot(p_empresa uuid, filas jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  for r in select * from jsonb_array_elements(filas) loop
    -- Vehículo por patente normalizada
    update vehiculos v set
      marca  = coalesce(nullif(v.marca,  ''), nullif(r->>'marca',  '')),
      modelo = coalesce(nullif(v.modelo, ''), nullif(r->>'modelo', '')),
      anio   = coalesce(v.anio, nullif(r->>'anio', '')::int),
      km_ultimo = greatest(coalesce(v.km_ultimo, 0), coalesce(nullif(r->>'km','')::int, 0))
    where v.empresa_id = p_empresa
      and r->>'patente' is not null
      and regexp_replace(upper(v.patente), '[^A-Z0-9]', '', 'g')
        = regexp_replace(upper(r->>'patente'), '[^A-Z0-9]', '', 'g');

    -- Cliente dueño de esa patente: completa contacto vacío
    update clientes c set
      telefono  = coalesce(nullif(c.telefono,  ''), nullif(r->>'telefono',  '')),
      email     = coalesce(nullif(c.email,     ''), nullif(r->>'email',     '')),
      direccion = coalesce(nullif(c.direccion, ''), nullif(r->>'direccion', '')),
      ciudad    = coalesce(nullif(c.ciudad,    ''), nullif(r->>'ciudad',    ''))
    from vehiculos v
    where v.cliente_id = c.id and c.empresa_id = p_empresa
      and r->>'patente' is not null
      and regexp_replace(upper(v.patente), '[^A-Z0-9]', '', 'g')
        = regexp_replace(upper(r->>'patente'), '[^A-Z0-9]', '', 'g');
  end loop;
end $$;
revoke all on function crm_aplicar_datos_ot(uuid, jsonb) from public, anon, authenticated;

-- ---- 7) Re-vincular servicios con vehículo/cliente por patente --------
update servicios s set
  vehiculo_id = v.id,
  cliente_id  = coalesce(s.cliente_id, v.cliente_id)
from vehiculos v
where s.vehiculo_id is null
  and s.patente is not null and v.patente is not null
  and s.empresa_id = v.empresa_id
  and regexp_replace(upper(v.patente), '[^A-Z0-9]', '', 'g')
    = regexp_replace(upper(s.patente), '[^A-Z0-9]', '', 'g');

-- ---- 8) URL del Apps Script de actualización (CRM -> planilla) --------
-- Después de desplegar integraciones/crm_actualizar_ot.gs como Web App,
-- guarda aquí su URL (reemplaza el valor):
insert into empresa_config (empresa_id, clave, valor) values
 ('00000000-0000-0000-0000-000000000001', 'sheet_update_url', '""'::jsonb)
on conflict (empresa_id, clave) do nothing;

-- Listo. Ahora ejecuta 26_seed_precios_v21.sql.
