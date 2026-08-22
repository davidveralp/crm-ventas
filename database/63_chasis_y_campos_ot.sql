-- ============================================================================
-- Migración 63 — Chasis (VIN) y demás campos de la OT en papel
-- ============================================================================
--
-- ERROR QUE CORRIGE
--   "Could not find the 'chasis' column of 'vehiculos' in the schema cache"
--   al registrar un ingreso con un vehículo nuevo.
--
-- CAUSA
--   La v79 agregó el campo Chasis al formulario y al documento impreso, y se
--   documentó que faltaba la columna... pero la migración nunca se escribió.
--   El insert lo enviaba igual, así que fallaba.
--
-- SE APROVECHA PARA CERRAR EL RESTO
--   La auditoría v76 comparó la OT en papel (Nº 13544) contra el modelo y
--   encontró tres datos que el documento de Dimasoft trae y el CRM no guardaba:
--     · Chasis (VIN)          → identificador universal del vehículo
--     · Cía. Aseguradora      → relevante para DyP y siniestros
--     · Dueño ≠ Cliente       → "REPARATUAUTO SPA" paga, "HANS DUARTE" es el
--                               dueño. Sin distinguirlos se pierde a quién llamar.
--   Se agregan los tres ahora, para no repetir este ciclo campo por campo.
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk).
-- ============================================================================

alter table public.vehiculos
  add column if not exists chasis        text,
  add column if not exists aseguradora   text,
  add column if not exists dueno_nombre  text,
  add column if not exists dueno_telefono text;

comment on column public.vehiculos.chasis is
  'Número de chasis / VIN. Identificador universal, no cambia aunque cambie la patente.';
comment on column public.vehiculos.aseguradora is
  'Compañía aseguradora. Relevante para siniestros y trabajos de DyP.';
comment on column public.vehiculos.dueno_nombre is
  'Dueño del vehículo cuando NO es el mismo que el cliente que paga (flotas, empresas, arriendo).';

-- El VIN es único por vehículo a nivel mundial. Índice único parcial: aplica
-- solo a los informados y bien formados (17 caracteres), así no bloquea las
-- fichas sin chasis, que hoy son casi todas.
create unique index if not exists vehiculos_chasis_uniq
  on public.vehiculos (upper(chasis))
  where chasis is not null and length(trim(chasis)) = 17;

create index if not exists vehiculos_aseguradora_idx
  on public.vehiculos (aseguradora) where aseguradora is not null;

-- Verificación: deben aparecer las cuatro
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'vehiculos'
  and column_name in ('chasis','aseguradora','dueno_nombre','dueno_telefono')
order by column_name;

-- Recarga la caché de esquema de PostgREST, que es la que produce el mensaje
-- "in the schema cache". Evita tener que reiniciar el proyecto.
notify pgrst, 'reload schema';
