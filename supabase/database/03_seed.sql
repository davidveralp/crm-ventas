-- =====================================================================
-- DIDIAL CRM · DATOS INICIALES (SEED)
-- =====================================================================
-- IMPORTANTE: los USUARIOS no se crean aquí. Primero se crean en
-- Authentication > Users de Supabase, y luego se vinculan con el script
-- 04_vincular_usuarios.sql (que ya trae los emails de DIDIAL).
-- =====================================================================

-- ---------------------------------------------------------------------
-- EMPRESA
-- ---------------------------------------------------------------------
insert into empresas (id, nombre, rut, ciudad, email, zona_horaria)
values (
  '00000000-0000-0000-0000-000000000001',
  'Servicio Automotriz Didial Ltda.',
  null,
  'La Serena',
  'administracion@didial.cl',
  'America/Santiago'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- ESTADOS DE PIPELINE (embudo de ventas)
-- ---------------------------------------------------------------------
insert into pipeline_estados (empresa_id, nombre, color, orden, es_final) values
  ('00000000-0000-0000-0000-000000000001', 'Lead',       '#7FB3C7', 1, false),
  ('00000000-0000-0000-0000-000000000001', 'Contactado', '#5B9BB5', 2, false),
  ('00000000-0000-0000-0000-000000000001', 'Propuesta',  '#1C4357', 3, false),
  ('00000000-0000-0000-0000-000000000001', 'Agendado',   '#C98A1B', 4, false),
  ('00000000-0000-0000-0000-000000000001', 'Vendido',    '#1D9E75', 5, true),
  ('00000000-0000-0000-0000-000000000001', 'Perdido',    '#A32D2D', 6, true)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- CAMPAÑAS BASE (las 7 del Plan Maestro, en borrador)
-- ---------------------------------------------------------------------
insert into campanas (empresa_id, nombre, descripcion, segmento, ventana, canal, estado, prioridad, mensaje_plantilla) values
  ('00000000-0000-0000-0000-000000000001',
   'Win-back alto valor con mantención vencida',
   'Recupera la venta de mayor valor que se está fugando. Máximo ROI.',
   'alto_valor_riesgo', 'vencida', 'llamada', 'borrador', 1,
   'Hola [NOMBRE], le habla [ASESOR] de DIDIAL. Vi que su [MARCA MODELO] estuvo con nosotros y por kilometraje ya le toca [TIPO MANTENCIÓN]. Como cliente importante le ofrezco hora prioritaria y una revisión de cortesía sin costo. ¿Le acomoda esta semana o la próxima?'),

  ('00000000-0000-0000-0000-000000000001',
   'Mantención mayor próxima (40/80/120k)',
   'Es el ticket más alto del taller; justifica contacto 1 a 1.',
   null, 'inminente', 'llamada', 'borrador', 2,
   'Hola [NOMBRE], su [MARCA MODELO] se acerca a los [KM] km, que es la mantención más importante del vehículo: incluye correa/distribución, bujías, filtros y frenos. Conviene planificarla con tiempo. ¿Le preparo una cotización y agendamos?'),

  ('00000000-0000-0000-0000-000000000001',
   'VIP con mantención inminente',
   'Protege el 43% de la facturación; alta probabilidad de cierre.',
   'vip_activo', 'inminente', 'whatsapp', 'borrador', 3,
   'Hola [NOMBRE] 👋 Le saluda [ASESOR] de DIDIAL. Su [MARCA MODELO] ([PATENTE]) ya estaría próximo a su mantención de [KM]. Como cliente preferente le aparto hora prioritaria. ¿Le coordino esta semana?'),

  ('00000000-0000-0000-0000-000000000001',
   'Flota con mantención próxima',
   'Volumen y recurrencia; afianza convenios.',
   'flota_empresa', 'proxima', 'llamada', 'borrador', 4,
   'Estimado/a [NOMBRE]: activemos el agendamiento programado de la flota de [EMPRESA] con tarifa corporativa y atención prioritaria. ¿Coordinamos 15-20 min esta semana?'),

  ('00000000-0000-0000-0000-000000000001',
   'Conversión de Prometedores',
   'Gran volumen; convierte clientes nuevos en recurrentes.',
   'prometedor', 'inminente', 'whatsapp', 'borrador', 5,
   'Hola [NOMBRE] 👋 Gracias por preferir DIDIAL para su [MARCA MODELO]. Pronto le tocará su mantención de [KM]. Si agenda este mes le incluimos [BENEFICIO]. ¿Se lo coordino?'),

  ('00000000-0000-0000-0000-000000000001',
   'Reactivación de Dormidos',
   'Bajo costo, recupera cartera fría.',
   'dormido_recuperable', null, 'sms', 'borrador', 6,
   'DIDIAL Servicio Automotriz 🚗 ¡Lo extrañamos! Vuelva con su [MARCA] y aproveche [OFERTA] este mes. Agende al [TELÉFONO].'),

  ('00000000-0000-0000-0000-000000000001',
   'Recordatorios automáticos',
   'Mantiene contacto sin esfuerzo comercial.',
   'ocasional', 'futura', 'email', 'borrador', 7,
   'Le avisaremos cuando su [MARCA MODELO] se acerque a su próxima mantención de [KM] km. Gracias por confiar en DIDIAL.')
on conflict do nothing;
