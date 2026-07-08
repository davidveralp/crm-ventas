-- =====================================================================
-- ACTUALIZACIÓN v27 · Roles nuevos, segmento en la base de precios
-- ---------------------------------------------------------------------
-- ⚠️ PASO 1 — EJECUTAR ESTE BLOQUE SOLO, EN UNA EJECUCIÓN SEPARADA
-- (regla de enums de Postgres: ALTER TYPE ... ADD VALUE no puede convivir
-- con otras sentencias en la misma transacción; error 55P04 si no).
alter type rol_usuario add value if not exists 'asistente_administrativo';
alter type rol_usuario add value if not exists 'asistente_bodega';
alter type rol_usuario add value if not exists 'asesor_multimarca';
alter type rol_usuario add value if not exists 'asesor_toyota';
-- (el rol "solo Vendedor" ya existe: 'vendedor')

-- =====================================================================
-- ⚠️ PASO 2 — EJECUTAR DESPUÉS, EN OTRA EJECUCIÓN
-- =====================================================================
-- Segmento de negocio en la base de precios (Taller Mecánico / Servicio
-- Rápido / DyP): alimenta la lista de servicios de Nueva OT y Solicitar
-- servicio directamente desde la planilla de precios.
alter table precios_base add column if not exists segmento text;

-- Backfill desde las notas (el sync anterior guardaba el segmento ahí)
update precios_base set segmento = 'Taller Mecánico' where segmento is null and notas like 'Taller Mecánico%';
update precios_base set segmento = 'Servicio Rápido' where segmento is null and notas like 'Servicio Rápido%';
update precios_base set segmento = 'DyP'             where segmento is null and notas like 'DyP%';

select count(*) filter (where segmento is not null) as con_segmento,
       count(*) as total from precios_base;
