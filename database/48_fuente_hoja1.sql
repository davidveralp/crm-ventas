-- Migración 48 — Panel operativo: cambiar la fuente de datos de Dashboard_Data a Hoja 1
--
-- CONTEXTO
-- El panel leía la pestaña Dashboard_Data (gid 174121810), que tiene solo 19 columnas
-- y NO incluye "Centro de Ingreso" (col. BH), "Monto Servicio Externo" (col. W)
-- ni las versiones brutas de repuestos/lubricantes/mano de obra.
-- Hoja 1 (gid 0, 60 columnas) es superconjunto de todo lo que el panel ya usaba.
--
-- Ejecutar en el proyecto crm-ventas (ehpstxrzsjwcevcafxgk), NO en "Didial OT".

-- 1) Ver la configuración actual antes de tocar nada
select empresa_id, clave, valor
from empresa_config
where clave = 'dashboard';

-- 2) Cambiar el gid a Hoja 1, conservando el resto de la configuración (metas, etc.)
update empresa_config
set valor = jsonb_set(
      jsonb_set(valor::jsonb, '{gid}', '"0"'::jsonb, true),
      '{sheet_id}', '"1UTgOhJ5fffCfx3RdArmFD-2z3WOCnUNMyfhKu9w59KQ"'::jsonb, true
    )
where clave = 'dashboard'
  and empresa_id = '00000000-0000-0000-0000-000000000001';

-- 3) Verificar
select empresa_id, valor->>'sheet_id' as sheet_id, valor->>'gid' as gid
from empresa_config
where clave = 'dashboard';

-- NOTA: si el paso 1 no devuelve ninguna fila, no hay que hacer nada:
-- el panel usa los valores por defecto del código, que ya apuntan a gid 0.
