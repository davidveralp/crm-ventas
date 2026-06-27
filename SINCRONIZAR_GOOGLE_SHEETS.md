-- =====================================================================
-- DIDIAL CRM · ACTUALIZACIÓN v6
-- Agrega "Tipo de servicio" solicitado, para saber qué necesita el
-- cliente, armar presupuestos y alimentar los análisis.
-- Ejecutar en el SQL Editor de Supabase. Es seguro re-ejecutarlo.
-- =====================================================================

alter table actividades  add column if not exists tipo_servicio text;
alter table presupuestos add column if not exists tipo_servicio text;

create index if not exists idx_actividades_tiposerv on actividades(tipo_servicio);

-- Listo. Refresca el CRM tras ejecutar.
