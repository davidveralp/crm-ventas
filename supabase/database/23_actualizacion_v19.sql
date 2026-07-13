-- =====================================================================
-- CONTROL DE OT · ACTUALIZACIÓN v19
-- 1) Tabla para que los asesores clasifiquen las OT faltantes de la hoja
--    Control_OTs (en taller / pendiente de ingreso / otro motivo).
-- 2) Config con la ubicación de la hoja Control_OTs.
-- 3) Recalcula la facturación histórica de cada cliente desde las OT
--    reales (tabla servicios), para que la ficha calce con la suma.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- =====================================================================

-- ---- 1) Clasificación de OT faltantes -------------------------------
create table if not exists control_ot_revision (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null default empresa_actual(),
  ot_numero     text not null,
  motivo        text,     -- en_taller | pendiente_ingreso | otro
  nota          text,
  revisado_por  uuid references usuarios(id) on delete set null,
  actualizado_en timestamptz default now(),
  unique (empresa_id, ot_numero)
);
alter table control_ot_revision enable row level security;
drop policy if exists cor_all on control_ot_revision;
create policy cor_all on control_ot_revision for all
  using (empresa_id = empresa_actual()) with check (empresa_id = empresa_actual());

-- ---- 2) Ubicación de la hoja Control_OTs ----------------------------
-- ⚠️ Reemplaza GID_CONTROL_OTS por el gid real de la pestaña Control_OTs
-- (lo ves en la URL del Sheet: ...#gid=XXXXXXXX). La pestaña debe estar
-- compartida como "Cualquiera con el enlace · Lector".
insert into empresa_config (empresa_id, clave, valor) values
 ('00000000-0000-0000-0000-000000000001', 'control_ots', '{
   "sheet_id": "1UTgOhJ5fffCfx3RdArmFD-2z3WOCnUNMyfhKu9w59KQ",
   "gid": "GID_CONTROL_OTS"
 }'::jsonb)
on conflict (empresa_id, clave) do update set valor = excluded.valor;

-- ---- 3) Facturación histórica = suma real de OT por cliente ---------
-- Corrige los casos donde facturacion_total no calza con la suma de OTs.
update clientes c
set facturacion_total = s.suma
from (
  select cliente_id, sum(coalesce(monto, 0)) as suma
  from servicios
  where cliente_id is not null
  group by cliente_id
) s
where s.cliente_id = c.id
  and coalesce(c.facturacion_total, 0) is distinct from s.suma;

-- Nota: los clientes SIN ninguna OT vinculada conservan su facturación
-- importada. Si prefieres dejarla en 0 para ellos, ejecuta también:
-- update clientes set facturacion_total = 0
-- where id not in (select distinct cliente_id from servicios where cliente_id is not null);

-- Listo. Refresca el CRM tras ejecutar.
