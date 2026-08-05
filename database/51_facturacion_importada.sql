-- ============================================================================
-- Migración 51 — Fichas con facturación importada y sin OTs en `servicios`
-- ============================================================================
--
-- ⚠️⚠️ ADVERTENCIA PRINCIPAL ⚠️⚠️
-- La consulta de verificación de la migración 50 devolvió 27 fichas con
-- `guardado > 0` y `real = 0`. **NO se deben poner esos totales en cero.**
-- Suman $10.746.186 de facturación histórica REAL.
--
-- POR QUÉ APARECEN ASÍ
-- La carga inicial del CRM (`06_carga_clientes.sql`) insertó en `clientes` y en
-- `vehiculos`, con `facturacion_total` ya agregado desde la planilla, pero
-- NO creó filas en `servicios`. Se verificó que los nombres de esa lista
-- ("Rafel Valderrama", "Grs", "Fernnda Vega", "Katterine Rodriguez",
-- "Felioe Pavez") están todos en ese archivo de carga.
--
-- Es decir: su facturación es histórica y válida, pero no tiene OTs que la
-- respalden fila por fila. Por eso `sum(servicios.monto)` da 0.
--
-- El UPDATE del bloque 6 de la migración 50 NO las tocó: hace join contra
-- `servicios`, así que las fichas sin OTs quedan fuera del UPDATE. La consulta
-- de verificación sí las lista, porque compara todo contra todo. Ese
-- comportamiento es correcto, pero se presta a confusión: la migración 50
-- debió distinguir "desincronizado" de "sin OTs registradas".
--
-- CONSECUENCIA PARA EL CASO INIA
-- INIA NO aparece en esa lista de 27, o sea que sus $4.102.050 sí calzan con
-- sus `servicios`. Su facturación faltante está entonces en otro lugar:
-- OTs huérfanas, otra ficha duplicada, o una ficha heredada de la carga inicial.
-- Los bloques de abajo permiten determinar cuál.
--
-- Además, la lista de 27 confirma el problema de duplicados por escritura:
--   "Rafel Valderrama"  $1.633.868  +  "Rafael Valderrama" $220.400 = $1.854.268
--   "Katterine Rodriguez" $792.800  +  "Katerine"          $330.000 = $1.122.800
-- Y nombres truncados de la importación: "Grs", "Mariano Ag", "Maria Elen",
-- "Eduardo Jose", "Pia Jenro".
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Clasificar TODAS las fichas según de dónde viene su facturación
-- ----------------------------------------------------------------------------
-- Distingue las tres situaciones que la migración 50 mezclaba en una sola lista.

with s as (
  select cliente_id, sum(coalesce(monto,0)) suma, count(*) n
  from servicios where cliente_id is not null group by cliente_id
)
select
  case
    when coalesce(s.n,0) = 0 and coalesce(c.facturacion_total,0) > 0
      then 'A · Histórica importada, sin OTs en servicios'
    when coalesce(s.n,0) = 0 and coalesce(c.facturacion_total,0) = 0
      then 'B · Ficha sin actividad'
    when coalesce(c.facturacion_total,0) is distinct from coalesce(s.suma,0)
      then 'C · Desincronizada (corregible con recálculo)'
    else 'D · Correcta'
  end as situacion,
  count(*)                                  as fichas,
  sum(coalesce(c.facturacion_total,0))      as facturacion_guardada,
  sum(coalesce(s.suma,0))                   as facturacion_en_servicios
from clientes c
left join s on s.cliente_id = c.id
group by 1
order by 1;


-- ----------------------------------------------------------------------------
-- 2) Las 27 fichas del grupo A: ¿tienen vehículos y patentes que permitan
--    reconstruir sus OTs desde la base de la planilla?
-- ----------------------------------------------------------------------------
select
  c.id, c.nombre, c.telefono, c.email,
  c.facturacion_total          as facturacion_importada,
  c.num_ot                     as ot_declaradas,
  c.ultima_visita,
  count(v.id)                  as vehiculos_registrados,
  string_agg(v.patente, ', ')  as patentes
from clientes c
left join vehiculos v on v.cliente_id = c.id
left join servicios sv on sv.cliente_id = c.id
where sv.id is null
  and coalesce(c.facturacion_total,0) > 0
group by c.id, c.nombre, c.telefono, c.email, c.facturacion_total, c.num_ot, c.ultima_visita
order by c.facturacion_total desc;


-- ----------------------------------------------------------------------------
-- 3) ¿Existen OTs en `servicios` para las patentes de esas fichas,
--    pero colgando de OTRA ficha o de ninguna?
-- ----------------------------------------------------------------------------
-- Este es el cruce que reconecta la facturación importada con las OTs reales.
-- Si devuelve filas, esas OTs pertenecen al cliente de la columna
-- `ficha_importada` y hoy están sumando en otro lado (o en ninguno).

with importadas as (
  select c.id, c.nombre
  from clientes c
  left join servicios sv on sv.cliente_id = c.id
  where sv.id is null and coalesce(c.facturacion_total,0) > 0
),
pat as (
  select i.id as cliente_importado, i.nombre as ficha_importada,
         upper(regexp_replace(coalesce(v.patente,''),'[^A-Za-z0-9]','','g')) as pnorm
  from importadas i
  join vehiculos v on v.cliente_id = i.id
  where coalesce(v.patente,'') <> ''
)
select
  p.ficha_importada,
  p.pnorm                                   as patente,
  count(sv.id)                              as ot_encontradas,
  sum(coalesce(sv.monto,0))                 as monto,
  string_agg(distinct coalesce(c2.nombre,'(sin ficha)'), ' | ') as hoy_suman_en
from pat p
join servicios sv
  on upper(regexp_replace(coalesce(sv.patente,''),'[^A-Za-z0-9]','','g')) = p.pnorm
left join clientes c2 on c2.id = sv.cliente_id
where sv.cliente_id is distinct from p.cliente_importado
group by p.ficha_importada, p.pnorm
order by monto desc;


-- ----------------------------------------------------------------------------
-- 4) Pares candidatos a fusión dentro del grupo A (mismo cliente, dos fichas)
-- ----------------------------------------------------------------------------
-- Casos ya identificados a ojo: Rafel/Rafael Valderrama, Katterine/Katerine.
-- Esta consulta los encuentra a todos por parecido de nombre o teléfono.

with importadas as (
  select c.*
  from clientes c
  left join servicios sv on sv.cliente_id = c.id
  where sv.id is null and coalesce(c.facturacion_total,0) > 0
)
select
  a.id as id_a, a.nombre as nombre_a, a.facturacion_total as fact_a,
  b.id as id_b, b.nombre as nombre_b, b.facturacion_total as fact_b,
  a.facturacion_total + b.facturacion_total as fact_combinada,
  round(similarity(a.nombre_norm, b.nombre_norm)::numeric, 2) as parecido,
  case when a.telefono_norm = b.telefono_norm and coalesce(a.telefono_norm,'') <> ''
       then 'mismo teléfono' else 'solo nombre' end as evidencia
from importadas a
join clientes b
  on a.id < b.id
 and a.empresa_id = b.empresa_id
 and (similarity(a.nombre_norm, b.nombre_norm) > 0.55
      or (coalesce(a.telefono_norm,'') <> '' and a.telefono_norm = b.telefono_norm))
order by fact_combinada desc;


-- ----------------------------------------------------------------------------
-- 5) Fusión que PRESERVA la facturación importada
-- ----------------------------------------------------------------------------
-- `fusionar_clientes()` de la migración 50 recalcula el total desde `servicios`,
-- lo que en el grupo A dejaría el total en 0 y BORRARÍA la histórica importada.
-- Esta variante suma la facturación importada de las fichas secundarias en vez
-- de descartarla.
--
-- Uso:
--   select fusionar_clientes_preservando('uuid-principal', array['uuid-sec']::uuid[]);

create or replace function public.fusionar_clientes_preservando(
  p_principal uuid,
  p_secundarios uuid[]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_importada_sec numeric;
  v_importada_pri numeric;
  v_servicios numeric;
  v_ot int;
begin
  -- Facturación que NO está respaldada por servicios, en principal y secundarias
  select coalesce(sum(c.facturacion_total),0) into v_importada_sec
  from clientes c
  left join servicios sv on sv.cliente_id = c.id
  where c.id = any(p_secundarios) and sv.id is null;

  select coalesce(c.facturacion_total,0) into v_importada_pri
  from clientes c
  left join servicios sv on sv.cliente_id = c.id
  where c.id = p_principal and sv.id is null;

  -- Fusión estándar (repunta todo y recalcula desde servicios)
  r := fusionar_clientes(p_principal, p_secundarios);

  -- Reincorporar la facturación histórica importada que la fusión descartó
  select coalesce(sum(coalesce(monto,0)),0), count(*) into v_servicios, v_ot
  from servicios where cliente_id = p_principal;

  update clientes set
    facturacion_total = v_servicios + v_importada_sec + v_importada_pri,
    num_ot            = greatest(v_ot, coalesce(num_ot,0)),
    ticket_promedio   = case when greatest(v_ot,1) > 0
                             then round((v_servicios + v_importada_sec + v_importada_pri) / greatest(v_ot,1))
                             else 0 end
  where id = p_principal;

  return r || jsonb_build_object(
    'facturacion_en_servicios',  v_servicios,
    'facturacion_importada',     v_importada_sec + v_importada_pri,
    'facturacion_total_final',   v_servicios + v_importada_sec + v_importada_pri
  );
end;
$$;


-- ----------------------------------------------------------------------------
-- 6) RECÁLCULO CORREGIDO (reemplaza al bloque 6 de la migración 50)
-- ----------------------------------------------------------------------------
-- Igual que el anterior, pero explícitamente EXCLUYE las fichas sin OTs en
-- `servicios`, para no arrasar con la facturación histórica importada.

update clientes c set
  facturacion_total = s.suma,
  num_ot            = s.n,
  ultima_visita     = s.ult,
  ticket_promedio   = case when s.n > 0 then round(s.suma / s.n) else 0 end
from (
  select cliente_id, sum(coalesce(monto,0)) suma, count(*) n, max(fecha) ult
  from servicios where cliente_id is not null group by cliente_id
) s
where s.cliente_id = c.id
  and (coalesce(c.facturacion_total,0) is distinct from s.suma
       or coalesce(c.num_ot,0) is distinct from s.n);

-- Verificación corregida: solo lista fichas que SÍ tienen OTs y no calzan.
-- Debe devolver 0 filas. Las fichas del grupo A ya no aparecen aquí.
select c.id, c.nombre,
       coalesce(c.facturacion_total,0) as guardado,
       s.suma                          as real,
       s.n                             as ot
from clientes c
join (
  select cliente_id, sum(coalesce(monto,0)) suma, count(*) n
  from servicios where cliente_id is not null group by cliente_id
) s on s.cliente_id = c.id
where coalesce(c.facturacion_total,0) is distinct from s.suma
order by abs(coalesce(c.facturacion_total,0) - s.suma) desc;
