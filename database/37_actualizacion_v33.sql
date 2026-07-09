-- =====================================================================
-- ACTUALIZACIÓN v33 · Captura de facturas de repuestos + presupuestos
-- sin solicitud + bandeja de asignación
-- ---------------------------------------------------------------------
-- Flujo: la planilla de facturas (AppSheet→Drive→Vision→Sheet) se
-- sincroniza al CRM. La VALIDACIÓN y la alerta de confianza se hacen en
-- el CRM (no en la planilla). El encargado de presupuestos asigna cada
-- unidad de repuesto a una PATENTE, le pone precio de venta (con margen
-- sugerido por categoría), y arma el presupuesto en el módulo.
-- Idempotente. Requiere migraciones 1–36.
-- =====================================================================

-- ---- 1) Cabeceras de factura -------------------------------------------
create table if not exists facturas_repuestos (
  id            text primary key,          -- id_factura de la planilla
  empresa_id    uuid not null default '00000000-0000-0000-0000-000000000001',
  tipo_doc      text,
  folio         text,
  rut_emisor    text,
  razon_social  text,
  fecha_emision date,
  neto          numeric,
  iva           numeric,
  exento        numeric,
  total         numeric,
  patente_sugerida text,                   -- patente_candidata/validada de la planilla
  ot_sugerida      text,
  confianza     text,                      -- ALTA | MEDIA | BAJA
  alertas       text,
  estado_crm    text default 'por_validar',-- por_validar | validada | descartada
  validada_por  uuid references usuarios(id) on delete set null,
  validada_en   timestamptz,
  creada_en     timestamptz default now()
);
alter table facturas_repuestos enable row level security;
do $$ begin
  create policy fr_tenant on facturas_repuestos for all
    using (empresa_id = '00000000-0000-0000-0000-000000000001')
    with check (empresa_id = '00000000-0000-0000-0000-000000000001');
exception when duplicate_object then null; end $$;

-- ---- 2) Detalle: cada unidad se asigna a una patente/presupuesto --------
create table if not exists repuestos_facturados (
  id             text primary key,         -- id_factura || '-' || nro_linea
  empresa_id     uuid not null default '00000000-0000-0000-0000-000000000001',
  id_factura     text references facturas_repuestos(id) on delete cascade,
  nro_linea      int,
  codigo         text,
  descripcion    text,
  cantidad       numeric default 1,
  costo_unitario numeric default 0,        -- precio_unitario de la planilla
  descuento      numeric default 0,
  total_linea    numeric default 0,
  -- asignación (la hace el encargado en el CRM; cantidad parcial permitida)
  cantidad_asignada numeric default 0,
  estado_asig    text default 'pendiente', -- pendiente | parcial | asignado
  creado_en      timestamptz default now()
);
alter table repuestos_facturados enable row level security;
do $$ begin
  create policy rf_tenant on repuestos_facturados for all
    using (empresa_id = '00000000-0000-0000-0000-000000000001')
    with check (empresa_id = '00000000-0000-0000-0000-000000000001');
exception when duplicate_object then null; end $$;

create index if not exists idx_rf_estado on repuestos_facturados(estado_asig);
create index if not exists idx_rf_factura on repuestos_facturados(id_factura);

-- ---- 3) Presupuestos sin solicitud (reusa presupuestos_taller) ---------
-- origen ya admite 'taller' | 'rapida'; se agrega 'sin_solicitud'. La
-- columna existe desde v23; no hay cambios de esquema, solo un valor nuevo.

-- ---- 4) Márgenes por categoría de repuesto (config editable) -----------
create table if not exists margenes_repuestos (
  empresa_id uuid not null default '00000000-0000-0000-0000-000000000001',
  categoria  text not null,
  margen_pct numeric not null default 30,
  primary key (empresa_id, categoria)
);
alter table margenes_repuestos enable row level security;
do $$ begin
  create policy mr_tenant on margenes_repuestos for all
    using (empresa_id = '00000000-0000-0000-0000-000000000001')
    with check (empresa_id = '00000000-0000-0000-0000-000000000001');
exception when duplicate_object then null; end $$;

-- margen por defecto (categoría '_default_') + algunos ejemplos editables
insert into margenes_repuestos (empresa_id, categoria, margen_pct) values
  ('00000000-0000-0000-0000-000000000001', '_default_', 30),
  ('00000000-0000-0000-0000-000000000001', 'Frenos', 35),
  ('00000000-0000-0000-0000-000000000001', 'Filtros', 40),
  ('00000000-0000-0000-0000-000000000001', 'Suspensión', 30),
  ('00000000-0000-0000-0000-000000000001', 'Lubricantes', 25)
on conflict (empresa_id, categoria) do nothing;

select 'v33 ok' as resultado,
  (select count(*) from facturas_repuestos) as facturas,
  (select count(*) from repuestos_facturados) as lineas;
