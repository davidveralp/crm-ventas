-- ============================================================================
-- Migración 50 — Clientes duplicados: detección, fusión y recálculo de facturación
-- ============================================================================
--
-- PROBLEMA VERIFICADO
-- El indicador "Facturación histórica" de la ficha del cliente es
-- `clientes.facturacion_total`, que se calcula como:
--     sum(servicios.monto) where servicios.cliente_id = <ficha>
--
-- Por lo tanto una OT queda FUERA del total cuando:
--   (a) su `cliente_id` es NULL — nunca se vinculó a una ficha, o
--   (b) su `cliente_id` apunta a OTRA ficha del mismo cliente real.
--
-- El caso (b) ocurre porque la identidad del cliente en la base de OT es el
-- texto libre de la columna "Propietario", sin RUT. Caso comprobado en la
-- planilla: el mismo cliente, con el mismo correo WILSON.ROJAS@INIA.CL,
-- aparece escrito al menos como "INIA" y como "INS. INV. AGROPECUARIA",
-- generando fichas separadas que se reparten la facturación.
-- (Otros ejemplos del mismo fenómeno en la base: erratas de tipeo como
--  "UNVERSIONES GASTRONIMICAS SPA" o "RAFEL VALDERRAMA".)
--
-- ⚠️ ESTE ARCHIVO NO FUSIONA NADA AUTOMÁTICAMENTE.
--    Los pasos 1 a 4 son de DIAGNÓSTICO: se ejecutan y se leen.
--    El paso 5 instala una función de fusión que se invoca a mano, caso a caso,
--    después de confirmar visualmente que las fichas son el mismo cliente.
--    Fusionar por parecido de nombre sin revisión humana puede unir a dos
--    personas distintas y es irreversible.
--
-- Ejecutar en el proyecto crm-ventas (ehpstxrzsjwcevcafxgk), NO en "Didial OT".
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Columnas normalizadas para poder comparar identidades
-- ----------------------------------------------------------------------------
-- Sin acentos, sin puntuación, sin espacios múltiples y en mayúsculas.
-- Es lo que permite ver que "INS. INV. AGROPECUARIA" e "INS INV AGROPECUARIA"
-- son la misma cadena, o que dos teléfonos con y sin +569 son el mismo número.

create extension if not exists unaccent;
create extension if not exists pg_trgm;

alter table public.clientes
  add column if not exists nombre_norm text
  generated always as (
    upper(regexp_replace(
      regexp_replace(coalesce(nombre, '') || ' ' || coalesce(apellidos, ''),
                     '[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ ]', ' ', 'g'),
      '\s+', ' ', 'g'))
  ) stored;

-- Teléfono reducido a sus últimos 8 dígitos.
-- Se usan 8 y no 9 a propósito: en la base conviven "+569 92764347",
-- "992764347", "56992764347" y "92764347" (este último sin el 9 inicial).
-- Con 9 dígitos el cuarto formato no agrupa con los otros tres; con 8 sí.
-- Contrapartida: dos números que solo difieran en el primer dígito se verían
-- como iguales, por eso este criterio alimenta un DIAGNÓSTICO y no una fusión
-- automática.
alter table public.clientes
  add column if not exists telefono_norm text
  generated always as (
    right(regexp_replace(coalesce(telefono, ''), '[^0-9]', '', 'g'), 8)
  ) stored;

alter table public.clientes
  add column if not exists email_norm text
  generated always as (lower(btrim(coalesce(email, '')))) stored;

create index if not exists clientes_nombre_norm_trgm_idx
  on public.clientes using gin (nombre_norm gin_trgm_ops);
create index if not exists clientes_telefono_norm_idx
  on public.clientes (telefono_norm) where telefono_norm <> '';
create index if not exists clientes_email_norm_idx
  on public.clientes (email_norm) where email_norm <> '';


-- ----------------------------------------------------------------------------
-- 2) DIAGNÓSTICO A — dinero que hoy NO está sumado en ninguna ficha
-- ----------------------------------------------------------------------------
-- Son OTs huérfanas: existen en `servicios` pero sin cliente_id.
-- Este monto no aparece en la facturación histórica de nadie.

select
  count(*)                        as ot_sin_cliente,
  sum(coalesce(monto, 0))         as monto_no_asignado,
  min(fecha)                      as desde,
  max(fecha)                      as hasta
from public.servicios
where cliente_id is null;

-- Detalle, para poder vincularlas desde el módulo Control de OT
select id, fecha, patente, monto, descripcion
from public.servicios
where cliente_id is null
order by monto desc nulls last
limit 100;


-- ----------------------------------------------------------------------------
-- 3) DIAGNÓSTICO B — fichas duplicadas por teléfono o correo
-- ----------------------------------------------------------------------------
-- Coincidencia FUERTE: mismo teléfono o mismo correo en fichas distintas.
-- Es el criterio más confiable; el nombre puede estar escrito de mil maneras
-- pero el teléfono y el correo suelen ser del mismo contacto real.

with dup as (
  select telefono_norm as clave, 'teléfono' as tipo, count(*) as fichas
  from public.clientes
  where coalesce(telefono_norm, '') <> '' and length(telefono_norm) = 8
  group by telefono_norm having count(*) > 1
  union all
  select email_norm, 'correo', count(*)
  from public.clientes
  where coalesce(email_norm, '') <> '' and email_norm like '%@%'
  group by email_norm having count(*) > 1
)
select
  d.tipo, d.clave, d.fichas,
  array_agg(c.id order by coalesce(c.facturacion_total,0) desc)     as ids,
  array_agg(c.nombre order by coalesce(c.facturacion_total,0) desc) as nombres,
  sum(coalesce(c.facturacion_total, 0))                             as facturacion_sumada
from dup d
join public.clientes c
  on (d.tipo = 'teléfono' and c.telefono_norm = d.clave)
  or (d.tipo = 'correo'   and c.email_norm   = d.clave)
group by d.tipo, d.clave, d.fichas
order by facturacion_sumada desc;


-- ----------------------------------------------------------------------------
-- 4) DIAGNÓSTICO C — fichas duplicadas por parecido de nombre
-- ----------------------------------------------------------------------------
-- Coincidencia DÉBIL: nombres similares (similitud de trigramas > 0,55).
-- Sirve para encontrar erratas y abreviaturas ("INIA" / "INS. INV. AGROPECUARIA")
-- pero produce falsos positivos: dos hermanos, o una empresa y su filial.
-- REVISAR UNA A UNA antes de fusionar.

select
  a.id           as id_a,   a.nombre as nombre_a,
  coalesce(a.facturacion_total,0) as fact_a,
  b.id           as id_b,   b.nombre as nombre_b,
  coalesce(b.facturacion_total,0) as fact_b,
  round(similarity(a.nombre_norm, b.nombre_norm)::numeric, 2) as parecido,
  coalesce(a.facturacion_total,0) + coalesce(b.facturacion_total,0) as fact_total
from public.clientes a
join public.clientes b
  on a.id < b.id
 and a.empresa_id = b.empresa_id
 and a.nombre_norm <> ''
 and similarity(a.nombre_norm, b.nombre_norm) > 0.55
order by fact_total desc
limit 200;


-- ----------------------------------------------------------------------------
-- 5) HERRAMIENTA DE FUSIÓN (no se ejecuta sola)
-- ----------------------------------------------------------------------------
-- Repunta TODO lo que cuelga de las fichas secundarias hacia la principal,
-- borra las secundarias y recalcula los totales de la principal.
--
-- Uso:
--   select fusionar_clientes(
--     'uuid-de-la-ficha-que-se-conserva',
--     array['uuid-secundaria-1','uuid-secundaria-2']::uuid[]
--   );
--
-- Devuelve un resumen de cuántos registros se movieron por tabla.

create or replace function public.fusionar_clientes(
  p_principal uuid,
  p_secundarios uuid[]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb := '{}'::jsonb;
  n int;
  v_total numeric;
  v_ot int;
  v_ult date;
begin
  if p_principal = any(p_secundarios) then
    raise exception 'La ficha principal no puede estar también en la lista de secundarias';
  end if;
  if not exists (select 1 from clientes where id = p_principal) then
    raise exception 'La ficha principal % no existe', p_principal;
  end if;

  -- Repuntar cada tabla que cuelga del cliente
  update servicios            set cliente_id = p_principal where cliente_id = any(p_secundarios);
  get diagnostics n = row_count; r := r || jsonb_build_object('servicios', n);

  update vehiculos            set cliente_id = p_principal where cliente_id = any(p_secundarios);
  get diagnostics n = row_count; r := r || jsonb_build_object('vehiculos', n);

  update presupuestos         set cliente_id = p_principal where cliente_id = any(p_secundarios);
  get diagnostics n = row_count; r := r || jsonb_build_object('presupuestos', n);

  update trabajos_taller      set cliente_id = p_principal where cliente_id = any(p_secundarios);
  get diagnostics n = row_count; r := r || jsonb_build_object('trabajos_taller', n);

  update presupuestos_taller  set cliente_id = p_principal where cliente_id = any(p_secundarios);
  get diagnostics n = row_count; r := r || jsonb_build_object('presupuestos_taller', n);

  update gestiones            set cliente_id = p_principal where cliente_id = any(p_secundarios);
  get diagnostics n = row_count; r := r || jsonb_build_object('gestiones', n);

  update actividades          set cliente_id = p_principal where cliente_id = any(p_secundarios);
  get diagnostics n = row_count; r := r || jsonb_build_object('actividades', n);

  update inspecciones_ingreso set cliente_id = p_principal where cliente_id = any(p_secundarios);
  get diagnostics n = row_count; r := r || jsonb_build_object('inspecciones_ingreso', n);

  -- tareas_campana: una misma campaña no puede tener dos tareas del mismo cliente.
  -- Se borran las que colisionarían y luego se repuntan las demás.
  delete from tareas_campana t
  where t.cliente_id = any(p_secundarios)
    and exists (select 1 from tareas_campana p
                where p.cliente_id = p_principal and p.campana_id = t.campana_id);
  update tareas_campana set cliente_id = p_principal where cliente_id = any(p_secundarios);
  get diagnostics n = row_count; r := r || jsonb_build_object('tareas_campana', n);

  -- Completar datos vacíos de la principal con los de las secundarias
  update clientes p set
    telefono = coalesce(nullif(p.telefono,''), (select nullif(s.telefono,'') from clientes s where s.id = any(p_secundarios) and nullif(s.telefono,'') is not null limit 1)),
    email    = coalesce(nullif(p.email,''),    (select nullif(s.email,'')    from clientes s where s.id = any(p_secundarios) and nullif(s.email,'')    is not null limit 1)),
    rut      = coalesce(nullif(p.rut,''),      (select nullif(s.rut,'')      from clientes s where s.id = any(p_secundarios) and nullif(s.rut,'')      is not null limit 1)),
    ciudad   = coalesce(nullif(p.ciudad,''),   (select nullif(s.ciudad,'')   from clientes s where s.id = any(p_secundarios) and nullif(s.ciudad,'')   is not null limit 1))
  where p.id = p_principal;

  -- Borrar las fichas secundarias, ya vacías
  delete from clientes where id = any(p_secundarios);
  get diagnostics n = row_count; r := r || jsonb_build_object('fichas_eliminadas', n);

  -- Recalcular los totales de la ficha principal
  select coalesce(sum(coalesce(monto,0)),0), count(*), max(fecha)
    into v_total, v_ot, v_ult
  from servicios where cliente_id = p_principal;

  update clientes set
    facturacion_total = v_total,
    num_ot            = v_ot,
    ultima_visita     = v_ult,
    ticket_promedio   = case when v_ot > 0 then round(v_total / v_ot) else 0 end
  where id = p_principal;

  return r || jsonb_build_object(
    'facturacion_total', v_total,
    'num_ot', v_ot,
    'ultima_visita', v_ult
  );
end;
$$;


-- ----------------------------------------------------------------------------
-- 6) RECÁLCULO GENERAL de facturación histórica
-- ----------------------------------------------------------------------------
-- ⚠️ CORREGIDO EN LA MIGRACIÓN 51 — USAR AQUELLA, NO ESTA.
-- La consulta de verificación de más abajo lista también las fichas cargadas
-- por `06_carga_clientes.sql`, que tienen facturación histórica importada pero
-- ninguna fila en `servicios`. Aparecen como "guardado > 0 / real = 0" y NO
-- están mal: poner sus totales en cero destruiría datos históricos reales
-- (27 fichas, $10.746.186). Ver `51_facturacion_importada.sql`.
-- Corrige las fichas cuyo total quedó desactualizado (importaciones antiguas,
-- vinculaciones posteriores desde Control de OT, borrados). Es seguro y
-- repetible: deja el total igual a la suma real de sus OTs.
--
-- ⚠️ Ejecutar DESPUÉS de fusionar los duplicados y de vincular las huérfanas,
--    no antes, o se consolidarán totales que todavía están repartidos.

update clientes c set
  facturacion_total = s.suma,
  num_ot            = s.n,
  ultima_visita     = s.ult,
  ticket_promedio   = case when s.n > 0 then round(s.suma / s.n) else 0 end
from (
  select cliente_id,
         sum(coalesce(monto,0)) as suma,
         count(*)               as n,
         max(fecha)             as ult
  from servicios
  where cliente_id is not null
  group by cliente_id
) s
where s.cliente_id = c.id
  and (coalesce(c.facturacion_total,0) is distinct from s.suma
       or coalesce(c.num_ot,0) is distinct from s.n);

-- Verificación final: fichas donde el total sigue sin calzar (debería dar 0 filas)
select c.id, c.nombre,
       coalesce(c.facturacion_total,0) as guardado,
       coalesce(s.suma,0)              as real
from clientes c
left join (
  select cliente_id, sum(coalesce(monto,0)) as suma
  from servicios where cliente_id is not null group by cliente_id
) s on s.cliente_id = c.id
where coalesce(c.facturacion_total,0) is distinct from coalesce(s.suma,0)
order by abs(coalesce(c.facturacion_total,0) - coalesce(s.suma,0)) desc
limit 50;
