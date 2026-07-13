-- =====================================================================
-- PANEL OPERATIVO · ACTUALIZACIÓN v17
-- Guarda la configuración del panel operativo en empresa_config (clave
-- 'dashboard'): hoja espejo Dashboard_Data, metas, técnicos y comisión.
-- Así los parámetros se editan por datos, no tocando código.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- =====================================================================

insert into empresa_config (empresa_id, clave, valor) values
 ('00000000-0000-0000-0000-000000000001', 'dashboard', '{
   "sheet_id": "1UTgOhJ5fffCfx3RdArmFD-2z3WOCnUNMyfhKu9w59KQ",
   "gid": "174121810",
   "meta_toyota": 15000000,
   "meta_multimarca": 25000000,
   "meta_ticket": 150000,
   "max_garantias": 5,
   "refresh_min": 15,
   "comision_pct": 0.05,
   "tecnicos_comision": ["Felipe", "Ignacio", "Shelmy"],
   "tecnicos_dyp": ["Wilson", "Gabriel"]
 }'::jsonb)
on conflict (empresa_id, clave) do update set valor = excluded.valor;

-- Requisito en el Google Sheet: la pestaña Dashboard_Data debe estar
-- compartida como "Cualquiera con el enlace · Lector" (sin datos personales).
