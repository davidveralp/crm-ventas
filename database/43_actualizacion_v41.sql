-- =====================================================================
-- ACTUALIZACIÓN v41 · Listas de control tipo checklist en Taller
-- ---------------------------------------------------------------------
-- Los requerimientos de reparación (Repuestos, Lubricantes e Insumos)
-- pasan de texto plano a objetos {texto, hecho, tecnico_id} — casilla
-- marcable + responsable asignado por ítem, como en la referencia de
-- ClickUp. Se agrega una tercera categoría: Servicio Externo.
-- Idempotente. Requiere migraciones 1–42.
-- =====================================================================

alter table trabajos_taller add column if not exists servicio_externo_requerido jsonb default '[]'::jsonb;

-- Convierte los ítems existentes (strings planos) al nuevo formato objeto,
-- sin tocar los que ya fueran objetos (reejecutar es seguro).
update trabajos_taller
   set repuestos_requeridos = (
     select coalesce(jsonb_agg(
       case when jsonb_typeof(elem) = 'string'
            then jsonb_build_object('texto', trim(both '"' from elem::text), 'hecho', false, 'tecnico_id', null)
            else elem end
     ), '[]'::jsonb)
     from jsonb_array_elements(repuestos_requeridos) elem
   )
 where repuestos_requeridos is not null and jsonb_array_length(repuestos_requeridos) > 0;

update trabajos_taller
   set insumos_requeridos = (
     select coalesce(jsonb_agg(
       case when jsonb_typeof(elem) = 'string'
            then jsonb_build_object('texto', trim(both '"' from elem::text), 'hecho', false, 'tecnico_id', null)
            else elem end
     ), '[]'::jsonb)
     from jsonb_array_elements(insumos_requeridos) elem
   )
 where insumos_requeridos is not null and jsonb_array_length(insumos_requeridos) > 0;

select 'v41 ok' as resultado;
