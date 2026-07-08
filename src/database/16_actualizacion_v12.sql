-- =====================================================================
-- DIDIAL CRM · ACTUALIZACIÓN v12
-- Email marketing con tracking: cada envío y cada evento de Brevo
-- (entregado, abierto, clic, rebote, no suscrito) quedan registrados
-- para alimentar la reportería.
-- Ejecutar en el SQL Editor de Supabase. Es seguro re-ejecutarlo.
-- =====================================================================

-- ---- Tanda de envío (un "blast" de email) -------------------------
create table if not exists email_blasts (
  id          uuid primary key default uuid_generate_v4(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  campana_id  uuid references campanas(id) on delete set null,
  asunto      text not null,
  cuerpo      text,
  segmento    text,
  total       int default 0,
  enviados    int default 0,
  creado_por  uuid references usuarios(id) on delete set null,
  creado_en   timestamptz default now()
);

-- ---- Un registro por destinatario (para medir su estado) ----------
create table if not exists email_envios (
  id            uuid primary key default uuid_generate_v4(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  blast_id      uuid references email_blasts(id) on delete cascade,
  cliente_id    uuid references clientes(id) on delete set null,
  email         text,
  message_id    text,
  estado        text default 'enviado',
  actualizado_en timestamptz default now()
);
create index if not exists idx_email_envios_blast on email_envios(blast_id);
create index if not exists idx_email_envios_msg   on email_envios(message_id);

-- ---- RLS: lectura por empresa (las escrituras van por las funciones)
alter table email_blasts enable row level security;
alter table email_envios enable row level security;
drop policy if exists email_blasts_sel on email_blasts;
create policy email_blasts_sel on email_blasts for select using (empresa_id = empresa_actual());
drop policy if exists email_envios_sel on email_envios;
create policy email_envios_sel on email_envios for select using (empresa_id = empresa_actual());

-- Listo. Refresca el CRM tras ejecutar.
