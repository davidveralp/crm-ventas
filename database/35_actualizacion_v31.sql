-- =====================================================================
-- ACTUALIZACIÓN v31 · Solicitud de presupuesto desde la ficha del cliente
-- ---------------------------------------------------------------------
-- El asesor solicita un presupuesto al encargado directamente desde la
-- ficha (por vehículo): describe lo que necesita y puede pre-cargar
-- servicios de la base de precios. La solicitud aterriza en el módulo
-- Presupuestos → pestaña COMERCIAL, en estado 'borrador', lista para que
-- el encargado la cotice y gestione.
--   - items: servicios pre-cargados por el asesor (jsonb)
--   - solicitado_por: quién pidió el presupuesto
--   - origen: 'solicitud_ficha' para distinguirla de las del pipeline
-- Idempotente. Requiere migraciones 1–34.
-- =====================================================================

alter table presupuestos add column if not exists items          jsonb default '[]'::jsonb;
alter table presupuestos add column if not exists solicitado_por  uuid references usuarios(id) on delete set null;
alter table presupuestos add column if not exists origen          text;

select 'v31 ok' as resultado;
