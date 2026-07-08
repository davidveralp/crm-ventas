-- =====================================================================
-- DIDIAL CRM · ACTUALIZACIÓN v11
-- 1) Motivo de cierre en gestiones
-- 2) Estados de campaña: finalizada + archivada (ciclo de vida completo)
-- Ejecutar en el SQL Editor de Supabase. Es seguro re-ejecutarlo.
-- NOTA: si las líneas ALTER TYPE dan error por transacción, córrelas solas.
-- =====================================================================

-- ---- 1. Motivo de cierre de la gestión ----------------------------
alter table gestiones add column if not exists motivo_cierre text;

-- ---- 2. Nuevos estados de campaña ---------------------------------
alter type estado_campana add value if not exists 'finalizada';
alter type estado_campana add value if not exists 'archivada';

-- Migra las campañas marcadas como 'completada' al nuevo 'finalizada'
-- (Ejecutar en una corrida posterior si el ALTER TYPE anterior fue en esta misma.)
update campanas set estado = 'finalizada' where estado = 'completada';

-- Listo. Refresca el CRM tras ejecutar.
