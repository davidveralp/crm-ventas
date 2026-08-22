-- ============================================================================
-- Migración 64 — Estado "agenda" y progreso de ClickUp
-- ============================================================================
--
-- VERIFICACIÓN REALIZADA CONTRA CLICKUP (lista "Vehiculos en Taller", 18 tarjetas)
--
-- Estados configurados en ClickUp vs. los que conocía el CRM:
--
--   ClickUp                      CRM                    Estado
--   ---------------------------  ---------------------  --------------------
--   agenda                       (no existía)           ⚠ FALTABA — y es el
--                                                         más usado: 7 de 18
--   por designar                 por_designar           ok
--   en reparación                en_reparacion          ok
--   en rep. servicio externo     servicio_externo       ok
--   compra de repuestos          compra_repuestos       ok
--   pintura/desabolladura        pintura_dyp            ok
--   prueba en ruta               prueba_ruta            ok
--   retroceso                    retroceso              ok
--   lavado                       lavado                 ok
--   alineacion                   alineacion             ok
--   listo para entrega           listo_entrega          ok
--   complete                     completada             ok
--   (sin equivalente)            revision               solo CRM
--   (sin equivalente)            esperando_aprobacion   solo CRM
--
-- CONSECUENCIA DEL FALTANTE
-- Las 7 tarjetas en "agenda" llegaban al webhook, no encontraban equivalente y
-- el cambio de estado se descartaba en silencio. El CRM las mostraba con el
-- estado anterior, o no las mostraba.
--
-- CAMPOS DE CLICKUP QUE NO SE APROVECHABAN
--   · Progreso (automatic_progress) — ClickUp lo calcula a partir de subtareas
--     y listas de control. Ej.: la tarjeta de la Hilux OT13323 va en 28,6%.
--   · Sugerencias (texto corto).
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk).
-- ============================================================================

alter table public.trabajos_taller
  add column if not exists progreso_clickup    int,
  add column if not exists sugerencias_clickup text;

comment on column public.trabajos_taller.progreso_clickup is
  'Porcentaje 0-100 calculado por ClickUp desde subtareas y listas de control. Solo lectura: el CRM no lo escribe hacia ClickUp.';
comment on column public.trabajos_taller.sugerencias_clickup is
  'Campo Sugerencias de la tarjeta de ClickUp.';

-- Rango válido. NOT VALID para no bloquear filas históricas.
alter table public.trabajos_taller drop constraint if exists tt_progreso_chk;
alter table public.trabajos_taller
  add constraint tt_progreso_chk
  check (progreso_clickup is null or (progreso_clickup between 0 and 100)) not valid;

-- Verificación
select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='trabajos_taller'
  and column_name in ('progreso_clickup','sugerencias_clickup')
order by column_name;

-- Reparto actual de estados, para contrastar con ClickUp después de sincronizar
select estado, count(*) from trabajos_taller group by estado order by count(*) desc;

notify pgrst, 'reload schema';
