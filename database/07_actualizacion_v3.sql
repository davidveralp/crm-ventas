-- =====================================================================
-- DIDIAL CRM · ACTUALIZACIÓN v3
-- 1) Más opciones de resultado de llamada + observaciones + próxima fecha
-- 2) Campaña de fidelización 48 h (clientes recién ingresados)
-- Ejecutar en el SQL Editor. Es seguro re-ejecutarlo.
-- =====================================================================

-- ---- 1. Seguimiento más detallado ----------------------------------
-- Próxima fecha de contacto (alimenta la Agenda)
alter table actividades add column if not exists proxima_fecha date;

-- Nuevos resultados posibles tras una llamada/contacto
alter type resultado_actividad add value if not exists 'compromiso';
alter type resultado_actividad add value if not exists 'cotizacion_enviada';
alter type resultado_actividad add value if not exists 'numero_erroneo';
alter type resultado_actividad add value if not exists 'no_desea_contacto';
alter type resultado_actividad add value if not exists 'fidelizado';

-- ---- 2. Campañas dinámicas por recencia de ingreso -----------------
alter table campanas add column if not exists dias_recientes int;

-- Campaña de fidelización: clientes ingresados en las últimas 48 horas
insert into campanas (empresa_id, nombre, descripcion, canal, estado, prioridad, dias_recientes, mensaje_plantilla)
values (
  '00000000-0000-0000-0000-000000000001',
  'Fidelización · Recién atendidos (48 h)',
  'Contactar a los clientes ingresados en las últimas 48 horas para preguntar si todo quedó bien con su vehículo. Cuidado postventa, no venta.',
  'llamada', 'activa', 0, 2,
  'Hola [NOMBRE], le habla [ASESOR] de DIDIAL Servicio Automotriz. Lo llamo para saber cómo quedó su [MARCA MODELO] después de su visita. ¿Anda todo bien? Cualquier consulta o detalle, estoy para ayudarle.'
)
on conflict do nothing;
