-- =====================================================================
-- DIDIAL CRM · ACTUALIZACIÓN v5
-- Agrega el RUT del cliente (viaja al formulario de OT como "documento").
-- Ejecutar en el SQL Editor de Supabase. Es seguro re-ejecutarlo.
-- =====================================================================

alter table clientes add column if not exists rut text;

-- Listo. Refresca el CRM tras ejecutar.
