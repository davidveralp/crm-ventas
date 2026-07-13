-- =====================================================================
-- ACTUALIZACIÓN v25 · Motivo de anulación de OT
-- (los demás cambios de v25 son de frontend e integración: vista limitada
-- para asesores, ticket 80mm, validación de duplicados en Nueva OT,
-- Control OT sin patente, segmento fijo en nuevo cliente, y el nuevo
-- Apps Script integraciones/sincronizar_precios.gs para mantener la base
-- de precios viva desde la planilla).
-- Idempotente. Requiere migraciones 1–30.
-- =====================================================================

alter table ordenes_trabajo add column if not exists motivo_anulacion text;

select 'v25 ok' as resultado;
