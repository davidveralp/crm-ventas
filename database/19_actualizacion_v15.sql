-- =====================================================================
-- MÓDULO OT · ACTUALIZACIÓN v15
-- Tabla ordenes_trabajo: registro completo de la OT con las mismas
-- columnas que la app de registro (Sheet A→AU). El CRM sigue escribiendo
-- también en "servicios" (subconjunto) para el historial y los triggers.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- =====================================================================

create table if not exists ordenes_trabajo (
  id                     uuid primary key default gen_random_uuid(),
  empresa_id             uuid not null default empresa_actual(),
  vehiculo_id            uuid references vehiculos(id) on delete set null,
  cliente_id             uuid references clientes(id) on delete set null,
  -- A,B,E..J  Ingreso y vehículo
  ot_numero              text,
  fecha                  date,
  patente                text,
  marca                  text,
  modelo                 text,
  cilindrada             text,
  anio                   text,
  km                     integer,
  -- K..O  Cliente
  tipo_cliente           text,
  propietario            text,
  telefono               text,
  email                  text,
  ciudad                 text,
  -- P..S  Asesor y técnicos
  asesor                 text,
  tipo_ingreso           text,
  tecnico_principal      text,
  tecnicos_secundarios   text,
  -- T..Z  Montos
  monto_repuestos        bigint default 0,
  monto_lubricantes      bigint default 0,
  monto_mano_obra        bigint default 0,
  monto_servicio_externo bigint default 0,
  desc_servicio_externo  text,
  descuento              bigint default 0,
  total_reparacion       bigint default 0,
  -- AA..AC  Clasificación
  tipo_servicio_1        text,
  tipo_servicio_2        text,
  unidades_negocio       text,
  -- AD..AG  Estado y documento
  estado_vehiculo        text,
  fecha_entrega          date,
  tipo_documento         text,
  nro_documento          text,
  -- AH..AI  Sucursal
  sucursal               text,
  email_asesor           text,
  -- AJ..AO  Encuesta
  encuesta_aplica        text,
  enc_p1                 text,
  enc_p2                 text,
  enc_p3                 text,
  enc_p4                 text,
  enc_conocio            text,
  -- AP..AS  Presupuesto
  presup_solicito        text,
  presup_numero          text,
  presup_aprueba         text,
  presup_detalle         text,
  -- AT..AU  Dirección
  direccion              text,
  direccion_ref          text,
  -- Auditoría
  creado_en              timestamptz default now(),
  creado_por             uuid default auth.uid()
);

create index if not exists ix_ot_empresa  on ordenes_trabajo(empresa_id);
create index if not exists ix_ot_patente  on ordenes_trabajo(empresa_id, patente);
create index if not exists ix_ot_numero   on ordenes_trabajo(empresa_id, ot_numero);

alter table ordenes_trabajo enable row level security;

drop policy if exists ot_sel on ordenes_trabajo;
create policy ot_sel on ordenes_trabajo for select
  using (empresa_id = empresa_actual());

drop policy if exists ot_ins on ordenes_trabajo;
create policy ot_ins on ordenes_trabajo for insert
  with check (empresa_id = empresa_actual());

drop policy if exists ot_upd on ordenes_trabajo;
create policy ot_upd on ordenes_trabajo for update
  using (empresa_id = empresa_actual()) with check (empresa_id = empresa_actual());

drop policy if exists ot_del on ordenes_trabajo;
create policy ot_del on ordenes_trabajo for delete
  using (empresa_id = empresa_actual()
    and exists (select 1 from usuarios u where u.id = auth.uid()
                and u.rol = 'admin' and u.empresa_id = empresa_actual()));

-- Listo. Refresca el CRM tras ejecutar.
