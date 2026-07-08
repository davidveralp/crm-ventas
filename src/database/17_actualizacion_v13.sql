-- =====================================================================
-- DIDIAL CRM → PLATAFORMA VPAI · ACTUALIZACIÓN v13 (capa de config)
-- Mueve a DATOS por empresa lo que hoy vive en código: branding, planes,
-- features activables, catálogos y plantillas. Incluye tiene_feature()
-- y gating de RLS. Idempotente y con defaults seguros (grandfather):
-- una empresa SIN plan asignado mantiene TODOS los módulos activos.
-- Ejecutar en el SQL Editor de Supabase.
-- =====================================================================

-- ---- 1. Planes y features -----------------------------------------
create table if not exists planes (
  id uuid primary key default uuid_generate_v4(),
  clave text unique not null,
  nombre text not null,
  precio numeric default 0,
  activo boolean default true
);
create table if not exists features (
  id uuid primary key default uuid_generate_v4(),
  clave text unique not null,
  nombre text not null
);
create table if not exists plan_features (
  plan_id uuid references planes(id) on delete cascade,
  feature_id uuid references features(id) on delete cascade,
  primary key (plan_id, feature_id)
);
create table if not exists empresa_features (
  empresa_id uuid references empresas(id) on delete cascade,
  feature_id uuid references features(id) on delete cascade,
  habilitado boolean default true,
  primary key (empresa_id, feature_id)
);

alter table empresas add column if not exists plan_id uuid references planes(id);
alter table empresas add column if not exists estado_suscripcion text default 'activa';
alter table empresas add column if not exists remitente_nombre text;
alter table empresas add column if not exists remitente_email text;

-- ---- 2. Branding y configuración general --------------------------
create table if not exists empresa_branding (
  empresa_id uuid primary key references empresas(id) on delete cascade,
  nombre_comercial text,
  logo_url text,
  login_titulo text,
  login_bajada text,
  colores jsonb default '{}'::jsonb
);
create table if not exists empresa_config (
  empresa_id uuid references empresas(id) on delete cascade,
  clave text,
  valor jsonb,
  primary key (empresa_id, clave)
);

-- ---- 3. Catálogos por empresa (infraestructura para la Fase 1) -----
create table if not exists cat_tipos_servicio (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references empresas(id) on delete cascade,
  clave text, nombre text, activo boolean default true, orden int default 0
);
create table if not exists cat_segmentos (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references empresas(id) on delete cascade,
  clave text, nombre text, color text, orden int default 0
);
create table if not exists cat_estados_gestion (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references empresas(id) on delete cascade,
  clave text, nombre text, color text, orden int default 0,
  es_cierre boolean default false, es_ganada boolean default false
);
create table if not exists cat_tipos_agenda (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references empresas(id) on delete cascade,
  clave text, nombre text, color text, orden int default 0
);
create table if not exists plantillas_email (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references empresas(id) on delete cascade,
  clave text, asunto text, cuerpo_html text, variables jsonb, activa boolean default true
);

-- ---- 4. tiene_feature(): autoridad de gating en la capa de datos ---
create or replace function tiene_feature(p_feature text)
returns boolean language sql stable security definer as $$
  select case
    when (select plan_id from empresas where id = empresa_actual()) is null then true  -- grandfather
    else coalesce(
      (select ef.habilitado from empresa_features ef
         join features f on f.id = ef.feature_id
        where ef.empresa_id = empresa_actual() and f.clave = p_feature),
      exists (select 1 from empresas e
         join plan_features pf on pf.plan_id = e.plan_id
         join features f on f.id = pf.feature_id
        where e.id = empresa_actual() and f.clave = p_feature),
      false)
  end;
$$;

-- Lista de features activos del tenant (para el frontend)
create or replace function features_empresa()
returns setof text language sql stable security definer as $$
  select f.clave from features f where tiene_feature(f.clave);
$$;

-- ---- 5. RLS de las tablas nuevas (lectura por empresa) ------------
do $$
declare t text;
begin
  foreach t in array array['empresa_branding','empresa_config','cat_tipos_servicio',
    'cat_segmentos','cat_estados_gestion','cat_tipos_agenda','plantillas_email','empresa_features'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_sel on %I', t, t);
    execute format('create policy %I_sel on %I for select using (empresa_id = empresa_actual())', t, t);
  end loop;
end $$;
-- planes/features/plan_features son catálogos globales: lectura para todos
alter table planes enable row level security;
alter table features enable row level security;
alter table plan_features enable row level security;
drop policy if exists planes_sel on planes;       create policy planes_sel on planes for select using (true);
drop policy if exists features_sel on features;    create policy features_sel on features for select using (true);
drop policy if exists planfeat_sel on plan_features; create policy planfeat_sel on plan_features for select using (true);

-- ---- 6. Ejemplo de gating por plan (módulo marketing) -------------
drop policy if exists email_blasts_sel on email_blasts;
create policy email_blasts_sel on email_blasts for select
  using (empresa_id = empresa_actual() and tiene_feature('marketing'));
drop policy if exists email_envios_sel on email_envios;
create policy email_envios_sel on email_envios for select
  using (empresa_id = empresa_actual() and tiene_feature('marketing'));

-- =====================================================================
-- SEED: planes, features y Didial como tenant Enterprise
-- =====================================================================
insert into planes (clave, nombre) values
  ('starter','Starter'), ('professional','Professional'), ('enterprise','Enterprise')
on conflict (clave) do nothing;

insert into features (clave, nombre) values
  ('crm','CRM y clientes'), ('agenda','Calendario y agenda'), ('ot','Órdenes de trabajo'),
  ('campanas','Campañas'), ('marketing','Email marketing'), ('informes','Informes')
on conflict (clave) do nothing;

-- Starter: CRM + agenda
insert into plan_features (plan_id, feature_id)
select p.id, f.id from planes p, features f
where p.clave='starter' and f.clave in ('crm','agenda')
on conflict do nothing;
-- Professional: + OT, campañas, informes
insert into plan_features (plan_id, feature_id)
select p.id, f.id from planes p, features f
where p.clave='professional' and f.clave in ('crm','agenda','ot','campanas','informes')
on conflict do nothing;
-- Enterprise: todo
insert into plan_features (plan_id, feature_id)
select p.id, f.id from planes p, features f
where p.clave='enterprise'
on conflict do nothing;

-- Didial = Enterprise (incluye marketing, por eso el gating no lo afecta)
update empresas
  set plan_id = (select id from planes where clave='enterprise'),
      remitente_nombre = coalesce(remitente_nombre, 'DIDIAL Servicio Automotriz'),
      remitente_email  = coalesce(remitente_email, 'administracion@didial.cl')
where id = '00000000-0000-0000-0000-000000000001';

-- Branding de Didial (el frontend lo lee en runtime)
insert into empresa_branding (empresa_id, nombre_comercial, login_titulo, colores)
values ('00000000-0000-0000-0000-000000000001', 'DIDIAL',
        'CRM de ventas y postventa del taller.',
        '{"deep":"#1C4357","red":"#E73C32","sky":"#7FB3C7","ink":"#0A0B0C"}'::jsonb)
on conflict (empresa_id) do nothing;

-- Listo. Refresca el CRM tras ejecutar.
