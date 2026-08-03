-- Migración 49 — Columna `patente_norm` en vehiculos (requerida por v53)
--
-- CONTEXTO
-- Los archivos Presupuestos.jsx, Clientes.jsx, NuevaOT.jsx, FacturasRepuestos.jsx,
-- InspeccionIngreso.jsx y BandejaClickUp.jsx pasaron a buscar contra `patente_norm`
-- en lugar de `patente`. Antes la búsqueda tenía que intentar dos formatos (con y sin
-- espacios) porque la patente se guardaba de ambas formas; `patente_norm` guarda
-- siempre la versión sin separadores y en mayúsculas, lo que permite una sola consulta
-- y además puede indexarse.
--
-- ⚠️ SIN ESTA MIGRACIÓN EL CÓDIGO FALLA: las consultas devolverán el error
--    'column vehiculos.patente_norm does not exist' y la búsqueda de vehículos
--    dejará de funcionar en los seis módulos.
--
-- Ejecutar en el proyecto crm-ventas (ehpstxrzsjwcevcafxgk), NO en "Didial OT".

-- 1) Columna generada: se calcula sola a partir de `patente` y no se puede
--    desincronizar. Equivale a patenteLimpia() del frontend:
--    quita todo lo que no sea letra o número y pasa a mayúsculas.
alter table public.vehiculos
  add column if not exists patente_norm text
  generated always as (upper(regexp_replace(coalesce(patente, ''), '[^A-Za-z0-9]', '', 'g'))) stored;

-- 2) Índice para que el ilike '%...%' no haga scan completo.
--    gin_trgm_ops soporta búsquedas por subcadena (el patrón parte con %).
create extension if not exists pg_trgm;

create index if not exists vehiculos_patente_norm_trgm_idx
  on public.vehiculos using gin (patente_norm gin_trgm_ops);

-- 3) Verificación: ambas columnas deben verse pobladas y coherentes.
select patente, patente_norm
from public.vehiculos
where patente is not null and patente <> ''
limit 20;

-- 4) Control de duplicados que el formato inconsistente podía estar ocultando:
--    dos fichas de vehículo con la misma patente escrita distinto.
select patente_norm, count(*) as fichas, array_agg(patente) as formatos
from public.vehiculos
where patente_norm <> ''
group by patente_norm
having count(*) > 1
order by count(*) desc;

-- NOTA: si la consulta 4 devuelve filas, hay vehículos duplicados en la base.
-- No se borran automáticamente: revisar caso a caso, porque cada ficha puede
-- tener OTs, presupuestos e inspecciones asociadas.
