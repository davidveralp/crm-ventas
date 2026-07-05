-- =====================================================================
-- ACTUALIZACIÓN v24 · Revisión técnica con requerimientos de repuestos e
-- insumos, decisión del presupuesto en manos del asesor
-- ---------------------------------------------------------------------
-- 1) El técnico, al evaluar la revisión, registra UNO A UNO los repuestos
--    y los insumos requeridos para la reparación. Estos requerimientos se
--    informan al encargado de presupuestos (prellenan la cotización).
-- 2) La decisión aprobado / aprobado parcial / rechazado la registra SOLO
--    el asesor durante la negociación con el cliente (cambio de frontend;
--    esta migración no toca datos de presupuestos).
-- Idempotente. Requiere migraciones 1–29.
-- =====================================================================

alter table trabajos_taller add column if not exists repuestos_requeridos jsonb default '[]'::jsonb;
alter table trabajos_taller add column if not exists insumos_requeridos   jsonb default '[]'::jsonb;

-- Diagnóstico
select 'v24 ok' as resultado;
