-- =====================================================================
-- DIDIAL CRM · ACTUALIZACIÓN v9
-- 1) Hora de la próxima gestión (agendamiento con hora)
-- 2) Roles adicionales para usuarios
-- Ejecutar en el SQL Editor de Supabase. Es seguro re-ejecutarlo.
-- NOTA: si las líneas ALTER TYPE dan error por transacción, córrelas solas.
-- =====================================================================

-- ---- 1. Hora del agendamiento -------------------------------------
alter table actividades add column if not exists proxima_hora time;

-- ---- 2. Roles adicionales -----------------------------------------
-- (Permiso elevado solo lo tiene 'admin'; el resto opera como estándar.)
alter type rol_usuario add value if not exists 'supervisor';
alter type rol_usuario add value if not exists 'postventa';

-- Listo. Refresca el CRM tras ejecutar.
