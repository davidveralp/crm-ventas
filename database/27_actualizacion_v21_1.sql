-- =====================================================================
-- ACTUALIZACIÓN v21.1 · Alta automática de clientes/vehículos desde la
-- base de OT + fix de búsqueda por N° de OT
-- ---------------------------------------------------------------------
-- PROBLEMA: la búsqueda por N° de OT resuelve el cliente vía
-- servicios.cliente_id. Las OT de clientes que nunca fueron importados
-- al CRM (registradas solo por la app de OT) quedan como fila de
-- servicio SIN cliente ni vehículo -> no aparecen en el buscador
-- (ej: OT 13199).
--
-- SOLUCIÓN: crm_aplicar_datos_ot v2 ahora, cuando la patente no existe
-- en el CRM:
--   1. Busca un cliente existente por teléfono (últimos 8 dígitos) o por
--      nombre exacto; si no hay, CREA el cliente con los datos de la
--      planilla (segmento 'nuevo').
--   2. CREA el vehículo con esa patente (marca/modelo/año/km).
--   3. Vincula todas las filas de `servicios` de esa patente y
--      recalcula facturación, N° de OT y última visita del cliente.
-- Se ejecuta sola en cada sync; esta migración además la corre una vez
-- no hace falta nada más que re-ejecutar crmSyncServicios() después.
-- Idempotente. Requiere 25_actualizacion_v21.sql.
-- =====================================================================

create or replace function crm_aplicar_datos_ot(p_empresa uuid, filas jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  v_pat text;
  v_veh uuid;
  v_cli uuid;
  v_fono text;
begin
  for r in select * from jsonb_array_elements(filas) loop
    v_pat := regexp_replace(upper(coalesce(r->>'patente', '')), '[^A-Z0-9]', '', 'g');
    if v_pat = '' then continue; end if;

    select v.id, v.cliente_id into v_veh, v_cli
      from vehiculos v
     where v.empresa_id = p_empresa
       and regexp_replace(upper(coalesce(v.patente, '')), '[^A-Z0-9]', '', 'g') = v_pat
     limit 1;

    if v_veh is not null then
      -- Vehículo existe: completa vacíos (no pisa lo editado en el CRM)
      update vehiculos v set
        marca  = coalesce(nullif(v.marca,  ''), nullif(r->>'marca',  '')),
        modelo = coalesce(nullif(v.modelo, ''), nullif(r->>'modelo', '')),
        anio   = coalesce(v.anio, nullif(r->>'anio', '')::int),
        km_ultimo = greatest(coalesce(v.km_ultimo, 0), coalesce(nullif(r->>'km','')::int, 0))
      where v.id = v_veh;

      update clientes c set
        telefono  = coalesce(nullif(c.telefono,  ''), nullif(r->>'telefono',  '')),
        email     = coalesce(nullif(c.email,     ''), nullif(r->>'email',     '')),
        direccion = coalesce(nullif(c.direccion, ''), nullif(r->>'direccion', '')),
        ciudad    = coalesce(nullif(c.ciudad,    ''), nullif(r->>'ciudad',    ''))
      where c.id = v_cli and c.empresa_id = p_empresa;

    elsif nullif(trim(coalesce(r->>'propietario', '')), '') is not null then
      -- v21.1: la patente NO existe en el CRM -> alta automática.
      -- 1) intenta reutilizar un cliente por teléfono (últimos 8 dígitos)
      v_fono := right(regexp_replace(coalesce(r->>'telefono', ''), '[^0-9]', '', 'g'), 8);
      v_cli := null;
      if length(v_fono) = 8 then
        select c.id into v_cli from clientes c
         where c.empresa_id = p_empresa
           and right(regexp_replace(coalesce(c.telefono, ''), '[^0-9]', '', 'g'), 8) = v_fono
         limit 1;
      end if;
      -- 2) o por nombre exacto
      if v_cli is null then
        select c.id into v_cli from clientes c
         where c.empresa_id = p_empresa
           and lower(trim(coalesce(c.nombre, '') || ' ' || coalesce(c.apellidos, '')))
             = lower(trim(r->>'propietario'))
         limit 1;
        if v_cli is null then
          select c.id into v_cli from clientes c
           where c.empresa_id = p_empresa
             and lower(trim(coalesce(c.nombre, ''))) = lower(trim(r->>'propietario'))
           limit 1;
        end if;
      end if;
      -- 3) si no hay, crea el cliente
      if v_cli is null then
        insert into clientes (empresa_id, nombre, telefono, email, ciudad, direccion, tipo, segmento, notas)
        values (p_empresa, trim(r->>'propietario'),
                nullif(r->>'telefono', ''), nullif(r->>'email', ''),
                nullif(r->>'ciudad', ''), nullif(r->>'direccion', ''),
                'PERSONA', 'nuevo', 'Importado automáticamente desde la base de OT')
        returning id into v_cli;
      end if;
      -- 4) crea el vehículo
      insert into vehiculos (empresa_id, cliente_id, patente, marca, modelo, anio, km_ultimo, km_actual_estimado)
      values (p_empresa, v_cli, v_pat,
              nullif(r->>'marca', ''), nullif(r->>'modelo', ''),
              nullif(r->>'anio', '')::int,
              nullif(r->>'km', '')::int, nullif(r->>'km', '')::int);
    end if;
  end loop;

  -- Vincula servicios huérfanos por patente (habilita la búsqueda por N° OT)
  update servicios s set
    vehiculo_id = v.id,
    cliente_id  = coalesce(s.cliente_id, v.cliente_id)
  from vehiculos v
  where s.empresa_id = p_empresa and v.empresa_id = p_empresa
    and s.vehiculo_id is null
    and s.patente is not null and v.patente is not null
    and regexp_replace(upper(v.patente), '[^A-Z0-9]', '', 'g')
      = regexp_replace(upper(s.patente), '[^A-Z0-9]', '', 'g');

  -- Recalcula indicadores del cliente desde su historial real
  update clientes c set
    facturacion_total = x.total,
    num_ot            = x.n,
    ultima_visita     = x.ult,
    ticket_promedio   = case when x.n > 0 then round(x.total / x.n, 2) else 0 end
  from (
    select s.cliente_id, coalesce(sum(s.monto), 0) total, count(*) n, max(s.fecha) ult
      from servicios s
     where s.empresa_id = p_empresa and s.cliente_id is not null
     group by s.cliente_id
  ) x
  where c.id = x.cliente_id and c.empresa_id = p_empresa;
end $$;
revoke all on function crm_aplicar_datos_ot(uuid, jsonb) from public, anon, authenticated;

-- Vinculación inmediata de lo ya sincronizado (sin esperar al próximo sync):
update servicios s set
  vehiculo_id = v.id,
  cliente_id  = coalesce(s.cliente_id, v.cliente_id)
from vehiculos v
where s.vehiculo_id is null
  and s.empresa_id = v.empresa_id
  and s.patente is not null and v.patente is not null
  and regexp_replace(upper(v.patente), '[^A-Z0-9]', '', 'g')
    = regexp_replace(upper(s.patente), '[^A-Z0-9]', '', 'g');

-- Diagnóstico: cuántas OT siguen sin cliente (se resolverán al re-ejecutar
-- crmSyncServicios(), que ahora crea los clientes/vehículos faltantes):
select count(*) as ots_sin_cliente
  from servicios
 where cliente_id is null;
