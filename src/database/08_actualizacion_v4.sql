-- =====================================================================
-- DIDIAL CRM · ACTUALIZACIÓN v4
-- 1) Línea de tiempo de gestión: estados de pipeline con clave + activo
-- 2) Normaliza tipo de cliente (PARTICULAR -> PERSONA)
-- 3) Índice para filtrar actividades por campaña (métricas de Pipeline)
-- Ejecutar en el SQL Editor de Supabase. Es seguro re-ejecutarlo.
-- =====================================================================

-- empresa DIDIAL (constante usada abajo)
-- '00000000-0000-0000-0000-000000000001'

-- ---- 1. Estados de pipeline: clave estable + activar/ocultar --------
alter table pipeline_estados add column if not exists clave  text;
alter table pipeline_estados add column if not exists activo boolean default true;

-- Re-mapea los estados existentes al nuevo flujo de gestión.
-- (Conserva los estado_id ya asignados a clientes: solo renombra.)
update pipeline_estados set nombre='Asignado',           clave='asignado',   orden=1, color='#7FB3C7', es_final=false
  where empresa_id='00000000-0000-0000-0000-000000000001' and nombre='Lead';
update pipeline_estados set                              clave='contactado', orden=3, color='#5B9BB5', es_final=false
  where empresa_id='00000000-0000-0000-0000-000000000001' and nombre='Contactado';
update pipeline_estados set nombre='Cotización enviada', clave='cotizacion', orden=5, color='#185FA5', es_final=false
  where empresa_id='00000000-0000-0000-0000-000000000001' and nombre='Propuesta';
update pipeline_estados set                              clave='agendado',   orden=6, color='#C98A1B', es_final=false
  where empresa_id='00000000-0000-0000-0000-000000000001' and nombre='Agendado';
update pipeline_estados set nombre='Servicio realizado', clave='servicio',   orden=7, color='#1D9E75', es_final=true
  where empresa_id='00000000-0000-0000-0000-000000000001' and nombre='Vendido';
update pipeline_estados set                              clave='perdido',    orden=9, color='#A32D2D', es_final=true
  where empresa_id='00000000-0000-0000-0000-000000000001' and nombre='Perdido';

-- Inserta las etapas nuevas que falten (idempotente por clave).
insert into pipeline_estados (empresa_id, nombre, clave, color, orden, es_final, activo)
select '00000000-0000-0000-0000-000000000001', x.nombre, x.clave, x.color, x.orden, x.es_final, true
from (values
  ('Pendiente de contacto', 'pendiente',   '#94a3b8', 2, false),
  ('Interesado',            'interesado',  '#534AB7', 4, false),
  ('Seguimiento',           'seguimiento', '#0E7490', 8, false)
) as x(nombre, clave, color, orden, es_final)
where not exists (
  select 1 from pipeline_estados p
  where p.empresa_id='00000000-0000-0000-0000-000000000001' and p.clave=x.clave
);

-- ---- 2. Tipo de cliente: normaliza PARTICULAR -> PERSONA ------------
update clientes set tipo='PERSONA'
  where empresa_id='00000000-0000-0000-0000-000000000001'
    and (tipo is null or tipo='PARTICULAR' or tipo='');

-- ---- 3. Métricas de Pipeline por campaña ---------------------------
create index if not exists idx_actividades_campana on actividades(campana_id);

-- Listo. Refresca el CRM tras ejecutar.
