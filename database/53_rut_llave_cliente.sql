-- ============================================================================
-- Migración 53 — RUT como llave de identidad del cliente
-- ============================================================================
--
-- CONTEXTO
-- Las migraciones 50 y 51 detectan y fusionan duplicados que YA existen, usando
-- teléfono, correo y parecido de nombre. Son criterios de rescate: sirven para
-- limpiar el pasado, pero no impiden que el problema se repita, porque la
-- identidad del cliente sigue siendo el texto libre del nombre.
--
-- El RUT es la llave real. Ya se capturaba en el CRM (`clientes.rut`, agregado
-- en la migración 09) pero NO existía en la planilla de OT, así que nunca
-- viajaba de vuelta ni servía para cruzar. Las columnas `RUT` y `Dirección`
-- ya fueron creadas en Hoja 1; esta migración las aprovecha del lado del CRM.
--
-- Ejecutar en crm-ventas (ehpstxrzsjwcevcafxgk), NO en "Didial OT".
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) RUT normalizado + dígito verificador calculado (módulo 11)
-- ----------------------------------------------------------------------------
-- `rut_norm`: solo dígitos y K, en mayúscula, sin puntos ni guion.
-- Con esto "12.345.678-9", "123456789" y "12345678-9" son el mismo valor.

alter table public.clientes
  add column if not exists rut_norm text
  generated always as (
    upper(regexp_replace(coalesce(rut, ''), '[^0-9kK]', '', 'g'))
  ) stored;

create index if not exists clientes_rut_norm_idx
  on public.clientes (rut_norm) where rut_norm <> '';

-- Función de dígito verificador chileno (módulo 11).
-- Recibe el RUT ya normalizado y devuelve el DV que le corresponde al cuerpo.
create or replace function public.rut_dv(p_rut text)
returns text
language plpgsql
immutable
as $$
declare
  cuerpo text;
  suma int := 0;
  mult int := 2;
  i int;
  resto int;
begin
  cuerpo := regexp_replace(upper(coalesce(p_rut, '')), '[^0-9K]', '', 'g');
  if length(cuerpo) < 2 then return null; end if;
  -- se descarta el último carácter: es el DV que viene informado
  cuerpo := left(cuerpo, length(cuerpo) - 1);
  if cuerpo !~ '^[0-9]+$' then return null; end if;

  for i in reverse length(cuerpo)..1 loop
    suma := suma + (substr(cuerpo, i, 1))::int * mult;
    mult := case when mult = 7 then 2 else mult + 1 end;
  end loop;

  resto := 11 - (suma % 11);
  return case resto when 11 then '0' when 10 then 'K' else resto::text end;
end;
$$;

-- Validez del RUT: compara el DV informado con el calculado.
alter table public.clientes
  add column if not exists rut_valido boolean
  generated always as (
    case
      when coalesce(rut, '') = '' then null
      else upper(right(regexp_replace(coalesce(rut,''), '[^0-9kK]', '', 'g'), 1))
           = public.rut_dv(regexp_replace(coalesce(rut,''), '[^0-9kK]', '', 'g'))
    end
  ) stored;


-- ----------------------------------------------------------------------------
-- 2) DIAGNÓSTICO — estado del RUT en la cartera
-- ----------------------------------------------------------------------------
select
  count(*)                                             as fichas,
  count(*) filter (where coalesce(rut,'') <> '')       as con_rut,
  count(*) filter (where rut_valido is true)           as rut_valido,
  count(*) filter (where rut_valido is false)          as rut_invalido,
  round(100.0 * count(*) filter (where coalesce(rut,'') <> '') / nullif(count(*),0), 1) as pct_cobertura
from public.clientes;

-- RUTs mal digitados: existen pero no pasan módulo 11. Corregir a mano.
select id, nombre, rut, public.rut_dv(rut_norm) as dv_correcto
from public.clientes
where rut_valido is false
order by coalesce(facturacion_total, 0) desc
limit 50;


-- ----------------------------------------------------------------------------
-- 3) DUPLICADOS POR RUT — la evidencia más fuerte que existe
-- ----------------------------------------------------------------------------
-- A diferencia del teléfono (que se comparte entre familiares) o del nombre
-- (que se escribe de mil formas), el RUT identifica al cliente sin ambigüedad.
-- Estos grupos se pueden fusionar con mucha más confianza que los de la
-- migración 50, pero igual conviene mirarlos antes de ejecutar.

select
  c.rut_norm,
  count(*)                                                          as fichas,
  array_agg(c.id order by coalesce(c.facturacion_total,0) desc)     as ids,
  array_agg(c.nombre order by coalesce(c.facturacion_total,0) desc) as nombres,
  sum(coalesce(c.facturacion_total, 0))                             as facturacion_combinada
from public.clientes c
where c.rut_norm <> '' and length(c.rut_norm) >= 8
group by c.rut_norm
having count(*) > 1
order by facturacion_combinada desc;

-- Fusión asistida de TODOS los grupos que comparten RUT.
-- Conserva la ficha de mayor facturación y preserva la histórica importada.
-- ⚠️ Revisar antes la consulta de arriba. Descomentar para ejecutar.
/*
do $$
declare g record; principal uuid; secundarias uuid[];
begin
  for g in
    select rut_norm, array_agg(id order by coalesce(facturacion_total,0) desc) as ids
    from clientes
    where rut_norm <> '' and length(rut_norm) >= 8
    group by rut_norm having count(*) > 1
  loop
    principal := g.ids[1];
    secundarias := g.ids[2:array_length(g.ids,1)];
    perform public.fusionar_clientes_preservando(principal, secundarias);
    raise notice 'RUT % → ficha % (fusionadas %)', g.rut_norm, principal, array_length(secundarias,1);
  end loop;
end $$;
*/


-- ----------------------------------------------------------------------------
-- 4) PREVENCIÓN — que no se creen dos fichas con el mismo RUT
-- ----------------------------------------------------------------------------
-- Índice único parcial: aplica solo a los RUT informados y bien formados.
-- Las fichas sin RUT no se ven afectadas (siguen permitidas), así que no rompe
-- el flujo actual donde el RUT es opcional.
--
-- ⚠️ Crear DESPUÉS de fusionar los duplicados del punto 3, o fallará.

-- create unique index if not exists clientes_rut_norm_uniq
--   on public.clientes (empresa_id, rut_norm)
--   where rut_norm <> '' and length(rut_norm) >= 8;


-- ----------------------------------------------------------------------------
-- 5) Verificación
-- ----------------------------------------------------------------------------
-- El DV debe calcular bien para RUTs conocidos.
-- Se pasa el RUT completo (cuerpo + DV informado); la función devuelve el DV
-- que le corresponde al cuerpo. Verificado contra cálculo independiente.
select
  public.rut_dv('111111111') as debe_dar_1,   -- 11.111.111-1
  public.rut_dv('123456785') as debe_dar_5,   -- 12.345.678-5
  public.rut_dv('222222222') as debe_dar_2,   -- 22.222.222-2
  public.rut_dv('168875495') as debe_dar_5;   -- 16.887.549-5

select column_name, is_generated
from information_schema.columns
where table_schema='public' and table_name='clientes'
  and column_name in ('rut_norm','rut_valido');
