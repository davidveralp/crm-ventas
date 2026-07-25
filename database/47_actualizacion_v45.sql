-- =====================================================================
-- ACTUALIZACIÓN v45 · Inspección de ingreso (previa a Nueva OT)
-- ---------------------------------------------------------------------
-- Idempotente. Requiere migraciones 1–46.
-- =====================================================================

create table if not exists inspecciones_ingreso (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null default '00000000-0000-0000-0000-000000000001',
  cliente_id          uuid references clientes(id) on delete set null,
  vehiculo_id         uuid references vehiculos(id) on delete set null,
  ot_numero           text,                     -- se completa al generar la OT al final del asistente
  km                  int,
  fecha               date default current_date,
  fecha_probable_entrega date,
  ingreso_grua        boolean default false,
  trabajo_a_realizar  text,
  observaciones_cliente text,
  observaciones_asesor  text,
  luces_advertencia   jsonb default '[]'::jsonb,   -- ["check_engine","abs",...]
  inventario          jsonb default '{}'::jsonb,   -- {"gatos":true,"triangulos":false,...}
  nivel_combustible   int default 4,               -- 0 (E) .. 8 (F), octavos de estanque
  tipo_silueta        text,                        -- sedan|camioneta|moto|camion_europeo|camion_americano|furgon|tractor
  danos               jsonb default '[]'::jsonb,   -- [{numero,x,y,descripcion}]
  checklist           jsonb default '[]'::jsonb,   -- [{item,estado}]  estado: x | na | ok
  fotos               jsonb default '[]'::jsonb,   -- [{url,nombre}]
  firma_url           text,
  estado              text default 'borrador',     -- borrador | completada
  creado_por          uuid references usuarios(id) on delete set null,
  creado_en           timestamptz default now()
);
alter table inspecciones_ingreso enable row level security;
do $$ begin
  create policy ii_tenant on inspecciones_ingreso for all
    using (empresa_id = '00000000-0000-0000-0000-000000000001')
    with check (empresa_id = '00000000-0000-0000-0000-000000000001');
exception when duplicate_object then null; end $$;

select 'v45 ok' as resultado;

-- =====================================================================
-- STORAGE · Fotos y firma de la inspección
-- ---------------------------------------------------------------------
-- El bucket "inspecciones" se crea a mano UNA VEZ en el dashboard:
-- Supabase → Storage → New bucket → nombre "inspecciones" → Public: NO
-- (privado; se sirve con URLs firmadas que el propio código genera).
-- Estas políticas van DESPUÉS de crear el bucket (si el bucket aún no
-- existe, este bloque no falla, pero tampoco hace nada útil todavía).
-- =====================================================================
do $$ begin
  create policy inspecciones_storage_all on storage.objects for all
    using (bucket_id = 'inspecciones') with check (bucket_id = 'inspecciones');
exception when duplicate_object then null; end $$;
