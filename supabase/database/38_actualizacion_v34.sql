-- =====================================================================
-- ACTUALIZACIÓN v34 · Color de vehículo (para el PDF oficial de presupuesto)
-- Idempotente. Requiere migraciones 1–37.
-- =====================================================================
alter table vehiculos add column if not exists color text;
select 'v34 ok' as resultado;
