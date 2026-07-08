-- =====================================================================
-- ACTUALIZACIÓN v22 · Campañas bien definidas: tareas para asesores,
-- calendario limpio y 6 campañas de email marketing listas para enviar
-- ---------------------------------------------------------------------
-- 1) NUEVO FLUJO DE CAMPAÑAS (corrige los 3 bugs de raíz):
--    Activar/cargar una campaña YA NO crea actividades en el calendario
--    ni eventos en las gestiones. Ahora crea filas en `tareas_campana`,
--    asignadas al vendedor de cada cliente según su cartera. El asesor
--    trabaja su lista en Clientes → Tareas; SOLO cuando él agenda algo
--    se crea la actividad (y ahí sí aparece en el Calendario). Las
--    gestiones vuelven a ser únicamente lo registrado por el asesor.
-- 2) LIMPIEZA: las tareas pendientes que la campaña insertó como
--    actividades (las 696 "vencidas" y los eventos plantilla en
--    gestiones) se MIGRAN a tareas_campana y se eliminan del calendario.
--    Nada se pierde: quedan como tareas pendientes de la campaña.
-- 3) 6 CAMPAÑAS DE EMAIL MARKETING institucionales precargadas en
--    estado borrador, con asunto, plantilla HTML y criterio de audiencia
--    calculado desde el historial real de servicios
--    (función audiencia_campana). Se envían con un botón desde Campañas.
-- Idempotente. Requiere migraciones 1–27.
-- =====================================================================

-- ---- 1) Tareas de campaña --------------------------------------------
create table if not exists tareas_campana (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  campana_id    uuid not null references campanas(id) on delete cascade,
  cliente_id    uuid not null references clientes(id) on delete cascade,
  vendedor_id   uuid references usuarios(id) on delete set null,
  canal         text,
  estado        text not null default 'pendiente',  -- pendiente|contactado|agendado|venta|descartado
  comentario    text,
  creado_en     timestamptz default now(),
  gestionado_en timestamptz,
  gestionado_por uuid references usuarios(id) on delete set null
);
create unique index if not exists uq_tarea_campana on tareas_campana(campana_id, cliente_id);
create index if not exists ix_tareas_campana_vend on tareas_campana(empresa_id, vendedor_id, estado);
alter table tareas_campana enable row level security;
drop policy if exists tareas_campana_all on tareas_campana;
create policy tareas_campana_all on tareas_campana for all
  using (empresa_id = empresa_actual()) with check (empresa_id = empresa_actual());

-- ---- 2) Migrar y limpiar lo que la campaña metió al calendario -------
insert into tareas_campana (empresa_id, campana_id, cliente_id, vendedor_id, canal, estado, creado_en)
select a.empresa_id, a.campana_id, a.cliente_id, a.vendedor_id, a.tipo::text, 'pendiente', a.creado_en
  from actividades a
 where a.campana_id is not null and a.resultado = 'pendiente'
on conflict (campana_id, cliente_id) do nothing;

-- Elimina del calendario/gestiones las tareas automáticas pendientes
-- (las gestionadas por un asesor quedan como historial real).
delete from actividades
 where campana_id is not null and resultado = 'pendiente';

-- ---- 3) Campañas: asunto y criterio de audiencia ----------------------
alter table campanas add column if not exists asunto   text;
alter table campanas add column if not exists criterio jsonb;

-- ---- 4) Audiencia calculada desde el historial de servicios -----------
-- Mantención = tipo de servicio que empieza con 'MAN' (MAN X PAUTA,
-- MAN BASICA, MANTENCION…). Corre con los permisos del usuario (RLS).
create or replace function audiencia_campana(p_campana uuid)
returns table (cliente_id uuid, nombre text, apellidos text, email text,
               telefono text, ultima_visita date, visitas_12m bigint, facturacion numeric)
language sql stable as $fn$
with cfg as (
  select c.empresa_id, coalesce(c.criterio, '{}'::jsonb) cr from campanas c where c.id = p_campana
),
base as (
  select c.id, c.nombre, c.apellidos, c.email, c.telefono,
         coalesce(c.facturacion_total, 0) fact,
         max(s.fecha) ult_visita,
         max(s.fecha) filter (where upper(coalesce(s.tipo_servicio,'')) like 'MAN%'
                                 or upper(coalesce(s.tipo_servicio_2,'')) like 'MAN%') ult_mant,
         count(*) filter (where s.fecha > current_date - 365) visitas_12m,
         count(*) visitas_tot
    from clientes c
    join servicios s on s.cliente_id = c.id and s.fecha is not null
   where c.empresa_id = (select empresa_id from cfg)
     and c.email is not null and position('@' in c.email) > 1
   group by c.id
)
select b.id, b.nombre, b.apellidos, b.email, b.telefono, b.ult_visita, b.visitas_12m, b.fact
  from base b, cfg
 where case cfg.cr->>'tipo'
   when 'mant_proxima' then
        b.ult_mant is not null
        and b.ult_mant between current_date - coalesce((cfg.cr->>'dias_max')::int, 180)
                           and current_date - coalesce((cfg.cr->>'dias_min')::int, 150)
        and b.ult_mant = b.ult_visita  -- sin visitas posteriores a esa mantención
   when 'mant_vencida' then
        b.ult_mant is not null
        and b.ult_mant between current_date - coalesce((cfg.cr->>'dias_max')::int, 365)
                           and current_date - coalesce((cfg.cr->>'dias_min')::int, 181)
        and b.ult_mant = b.ult_visita
   when 'fidelizacion_reparacion' then
        b.ult_visita between current_date - coalesce((cfg.cr->>'dias_max')::int, 180)
                         and current_date - coalesce((cfg.cr->>'dias_min')::int, 60)
        and (b.ult_mant is null or b.ult_mant < b.ult_visita)  -- lo último NO fue mantención
   when 'fidelizados' then
        b.visitas_12m >= coalesce((cfg.cr->>'min_visitas_12m')::int, 3)
   when 'recupero_importante' then
        b.ult_visita < current_date - coalesce((cfg.cr->>'dias_min')::int, 365)
        and (b.visitas_tot >= coalesce((cfg.cr->>'min_visitas')::int, 3)
             or b.fact >= coalesce((cfg.cr->>'monto_min')::numeric, 500000))
   when 'recupero_masivo' then
        b.ult_visita < current_date - coalesce((cfg.cr->>'dias_min')::int, 365)
        and b.visitas_tot < coalesce((cfg.cr->>'min_visitas')::int, 3)
        and b.fact < coalesce((cfg.cr->>'monto_min')::numeric, 500000)
   else false
 end
 order by b.ult_visita desc nulls last
$fn$;

-- ---- 5) Seed: 6 campañas de email marketing (borrador, listas) --------
delete from campanas
 where empresa_id = '00000000-0000-0000-0000-000000000001'
   and criterio is not null;   -- recarga limpia de las campañas de email

insert into campanas (empresa_id, nombre, descripcion, canal, estado, prioridad, asunto, criterio, mensaje_plantilla) values
('00000000-0000-0000-0000-000000000001', 'Email · Mantención próxima',
 'Clientes a 5–6 meses de su última mantención (y sin visitas posteriores). 10% dcto con código MANT10-DIDIAL.',
 'email', 'borrador', 1,
 'Tu mantención está por cumplirse — 10% de descuento te espera',
 '{"tipo":"mant_proxima","dias_min":150,"dias_max":180}',
 '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F4F7;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
  <tr><td align="center" style="background:#12212F;padding:22px">
    <span style="font-size:30px;font-weight:900;letter-spacing:3px;color:#E0382B">DIDIAL</span><br>
    <span style="font-size:10px;letter-spacing:5px;color:#ffffff">SERVICIO AUTOMOTRIZ</span>
  </td></tr>
  <tr><td style="padding:26px 32px 6px">
    <h1 style="margin:0;font-size:20px;color:#1A1C20">Hola {nombre}, tu mantención está por cumplirse</h1>
  </td></tr>
  <tr><td style="padding:6px 32px 10px;font-size:15px;color:#3A4450;line-height:1.65">
    Ya se acercan los <b>6 meses desde tu última mantención</b>, el plazo recomendado para mantener tu vehículo seguro, eficiente y con su garantía de servicio al día.<br><br>
     Para ayudarte a no dejarlo pasar, te regalamos un <b>10% de descuento</b> en tu próxima mantención. Solo muestra este código al llegar o menciónalo al agendar:
  </td></tr>
  
      <tr><td align="center" style="padding:6px 32px 2px">
        <div style="border:2px dashed #E0382B;border-radius:10px;padding:12px 20px;display:inline-block">
          <span style="font-size:12px;color:#6B7280;letter-spacing:1px">TU CÓDIGO DE DESCUENTO</span><br>
          <span style="font-size:22px;font-weight:bold;color:#1A1C20;letter-spacing:3px">MANT10-DIDIAL</span>
        </div>
      </td></tr>
  
      <tr><td align="center" style="padding:8px 32px 4px">
        <a href="https://wa.me/56989748626" style="display:inline-block;background:#E0382B;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:8px">Agendar mi mantención</a>
      </td></tr>
  <tr><td style="padding:16px 32px 22px;font-size:13px;color:#6B7280;line-height:1.6">
    Agenda tu hora respondiendo este correo o llamándonos al <b>+56 9 8974 8626</b>.<br>
    Te esperamos en Avda. Cuatro Esquinas 759, La Serena.
  </td></tr>
  <tr><td style="background:#F2F4F7;padding:14px 32px;font-size:11px;color:#9AA3AE;text-align:center">
    Servicio Automotriz DIDIAL Ltda. · La Serena, Chile · serviciotecnico@didial.cl<br>
    Recibes este correo por ser cliente de DIDIAL.
  </td></tr>
</table>
</td></tr></table>'),
('00000000-0000-0000-0000-000000000001', 'Email · Fidelización post-reparación',
 'Clientes cuya última visita (hace 2–6 meses) fue una reparación, no mantención. Encuesta de satisfacción + inspección de cortesía.',
 'email', 'borrador', 2,
 '¿Cómo ha andado tu vehículo? Te invitamos a una inspección de cortesía',
 '{"tipo":"fidelizacion_reparacion","dias_min":60,"dias_max":180}',
 '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F4F7;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
  <tr><td align="center" style="background:#12212F;padding:22px">
    <span style="font-size:30px;font-weight:900;letter-spacing:3px;color:#E0382B">DIDIAL</span><br>
    <span style="font-size:10px;letter-spacing:5px;color:#ffffff">SERVICIO AUTOMOTRIZ</span>
  </td></tr>
  <tr><td style="padding:26px 32px 6px">
    <h1 style="margin:0;font-size:20px;color:#1A1C20">Hola {nombre}, ¿cómo ha andado tu vehículo?</h1>
  </td></tr>
  <tr><td style="padding:6px 32px 10px;font-size:15px;color:#3A4450;line-height:1.65">
    Hace algunas semanas realizamos una reparación en tu vehículo y queremos saber cómo ha respondido desde entonces. Tu tranquilidad al volante es lo que más nos importa.<br><br>
     Como agradecimiento por tu confianza, te invitamos a una <b>inspección de cortesía sin costo</b>: revisamos niveles, frenos, suspensión y el trabajo realizado, para que sigas manejando con total seguridad.
  </td></tr>
  
  
      <tr><td align="center" style="padding:8px 32px 4px">
        <a href="https://wa.me/56989748626" style="display:inline-block;background:#E0382B;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:8px">Reservar mi inspección de cortesía</a>
      </td></tr>
  <tr><td style="padding:16px 32px 22px;font-size:13px;color:#6B7280;line-height:1.6">
    Agenda tu hora respondiendo este correo o llamándonos al <b>+56 9 8974 8626</b>.<br>
    Te esperamos en Avda. Cuatro Esquinas 759, La Serena.
  </td></tr>
  <tr><td style="background:#F2F4F7;padding:14px 32px;font-size:11px;color:#9AA3AE;text-align:center">
    Servicio Automotriz DIDIAL Ltda. · La Serena, Chile · serviciotecnico@didial.cl<br>
    Recibes este correo por ser cliente de DIDIAL.
  </td></tr>
</table>
</td></tr></table>'),
('00000000-0000-0000-0000-000000000001', 'Email · Mantención vencida',
 'Clientes entre 6 y 12 meses desde su última mantención (sin visitas posteriores). 10% dcto con código MANT10-DIDIAL.',
 'email', 'borrador', 3,
 'Tu vehículo te está pidiendo su mantención — ponte al día con 10% dcto',
 '{"tipo":"mant_vencida","dias_min":181,"dias_max":365}',
 '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F4F7;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
  <tr><td align="center" style="background:#12212F;padding:22px">
    <span style="font-size:30px;font-weight:900;letter-spacing:3px;color:#E0382B">DIDIAL</span><br>
    <span style="font-size:10px;letter-spacing:5px;color:#ffffff">SERVICIO AUTOMOTRIZ</span>
  </td></tr>
  <tr><td style="padding:26px 32px 6px">
    <h1 style="margin:0;font-size:20px;color:#1A1C20">Hola {nombre}, tu vehículo te está pidiendo su mantención</h1>
  </td></tr>
  <tr><td style="padding:6px 32px 10px;font-size:15px;color:#3A4450;line-height:1.65">
    Han pasado <b>más de 6 meses desde tu última mantención</b>. Postergarla puede transformar desgastes simples en reparaciones costosas: aceite degradado, frenos exigidos, filtros saturados.<br><br>
     Ponerte al día es fácil, y queremos ayudarte: tienes un <b>10% de descuento</b> en tu próxima mantención presentando este código:
  </td></tr>
  
      <tr><td align="center" style="padding:6px 32px 2px">
        <div style="border:2px dashed #E0382B;border-radius:10px;padding:12px 20px;display:inline-block">
          <span style="font-size:12px;color:#6B7280;letter-spacing:1px">TU CÓDIGO DE DESCUENTO</span><br>
          <span style="font-size:22px;font-weight:bold;color:#1A1C20;letter-spacing:3px">MANT10-DIDIAL</span>
        </div>
      </td></tr>
  
      <tr><td align="center" style="padding:8px 32px 4px">
        <a href="https://wa.me/56989748626" style="display:inline-block;background:#E0382B;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:8px">Poner mi vehículo al día</a>
      </td></tr>
  <tr><td style="padding:16px 32px 22px;font-size:13px;color:#6B7280;line-height:1.6">
    Agenda tu hora respondiendo este correo o llamándonos al <b>+56 9 8974 8626</b>.<br>
    Te esperamos en Avda. Cuatro Esquinas 759, La Serena.
  </td></tr>
  <tr><td style="background:#F2F4F7;padding:14px 32px;font-size:11px;color:#9AA3AE;text-align:center">
    Servicio Automotriz DIDIAL Ltda. · La Serena, Chile · serviciotecnico@didial.cl<br>
    Recibes este correo por ser cliente de DIDIAL.
  </td></tr>
</table>
</td></tr></table>'),
('00000000-0000-0000-0000-000000000001', 'Email · Fidelizados (mecánica preventiva)',
 'Clientes con 3 o más visitas en los últimos 12 meses. Contenido de mecánica preventiva + inspección de cortesía.',
 'email', 'borrador', 4,
 'Gracias por tu preferencia — 3 claves para cuidar tu vehículo',
 '{"tipo":"fidelizados","min_visitas_12m":3}',
 '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F4F7;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
  <tr><td align="center" style="background:#12212F;padding:22px">
    <span style="font-size:30px;font-weight:900;letter-spacing:3px;color:#E0382B">DIDIAL</span><br>
    <span style="font-size:10px;letter-spacing:5px;color:#ffffff">SERVICIO AUTOMOTRIZ</span>
  </td></tr>
  <tr><td style="padding:26px 32px 6px">
    <h1 style="margin:0;font-size:20px;color:#1A1C20">{nombre}, gracias por tu preferencia — esto te puede servir</h1>
  </td></tr>
  <tr><td style="padding:6px 32px 10px;font-size:15px;color:#3A4450;line-height:1.65">
    Eres de los clientes que más nos visita y eso nos compromete contigo. Por eso te compartimos <b>3 claves de mecánica preventiva</b> que alargan la vida de tu vehículo:<br><br>
     <b>1. Aceite y filtros a tiempo:</b> cada 6 meses o según pauta — es el seguro de vida del motor.<br>
     <b>2. Frenos y neumáticos:</b> revisa su desgaste cada 10.000 km; frenar bien no es negociable.<br>
     <b>3. Escucha tu auto:</b> ruidos, tirones o testigos encendidos siempre son avisos tempranos — atenderlos a tiempo cuesta menos.<br><br>
     Y porque preferimos prevenir contigo, te invitamos a una <b>inspección de cortesía sin costo</b> cuando quieras pasar.
  </td></tr>
  
  
      <tr><td align="center" style="padding:8px 32px 4px">
        <a href="https://wa.me/56989748626" style="display:inline-block;background:#E0382B;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:8px">Agendar inspección de cortesía</a>
      </td></tr>
  <tr><td style="padding:16px 32px 22px;font-size:13px;color:#6B7280;line-height:1.6">
    Agenda tu hora respondiendo este correo o llamándonos al <b>+56 9 8974 8626</b>.<br>
    Te esperamos en Avda. Cuatro Esquinas 759, La Serena.
  </td></tr>
  <tr><td style="background:#F2F4F7;padding:14px 32px;font-size:11px;color:#9AA3AE;text-align:center">
    Servicio Automotriz DIDIAL Ltda. · La Serena, Chile · serviciotecnico@didial.cl<br>
    Recibes este correo por ser cliente de DIDIAL.
  </td></tr>
</table>
</td></tr></table>'),
('00000000-0000-0000-0000-000000000001', 'Email · Recupero importante',
 'Más de 1 año sin visitar, con 3+ visitas históricas o facturación sobre $500.000. "Te extrañamos" + 10% dcto código VUELVE10-DIDIAL.',
 'email', 'borrador', 5,
 'Te echamos de menos — vuelve con un 10% de descuento',
 '{"tipo":"recupero_importante","dias_min":365,"min_visitas":3,"monto_min":500000}',
 '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F4F7;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
  <tr><td align="center" style="background:#12212F;padding:22px">
    <span style="font-size:30px;font-weight:900;letter-spacing:3px;color:#E0382B">DIDIAL</span><br>
    <span style="font-size:10px;letter-spacing:5px;color:#ffffff">SERVICIO AUTOMOTRIZ</span>
  </td></tr>
  <tr><td style="padding:26px 32px 6px">
    <h1 style="margin:0;font-size:20px;color:#1A1C20">{nombre}, te echamos de menos en DIDIAL</h1>
  </td></tr>
  <tr><td style="padding:6px 32px 10px;font-size:15px;color:#3A4450;line-height:1.65">
    Ha pasado más de un año desde tu última visita y de verdad nos gustaría volver a verte. Clientes como tú son la razón por la que trabajamos con tanto cariño.<br><br>
     Queremos que tu regreso sea especial: tienes un <b>10% de descuento en tu próxima visita</b>, sea mantención o reparación. Solo presenta este código:
  </td></tr>
  
      <tr><td align="center" style="padding:6px 32px 2px">
        <div style="border:2px dashed #E0382B;border-radius:10px;padding:12px 20px;display:inline-block">
          <span style="font-size:12px;color:#6B7280;letter-spacing:1px">TU CÓDIGO DE DESCUENTO</span><br>
          <span style="font-size:22px;font-weight:bold;color:#1A1C20;letter-spacing:3px">VUELVE10-DIDIAL</span>
        </div>
      </td></tr>
  
      <tr><td align="center" style="padding:8px 32px 4px">
        <a href="https://wa.me/56989748626" style="display:inline-block;background:#E0382B;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:8px">Volver a DIDIAL</a>
      </td></tr>
  <tr><td style="padding:16px 32px 22px;font-size:13px;color:#6B7280;line-height:1.6">
    Agenda tu hora respondiendo este correo o llamándonos al <b>+56 9 8974 8626</b>.<br>
    Te esperamos en Avda. Cuatro Esquinas 759, La Serena.
  </td></tr>
  <tr><td style="background:#F2F4F7;padding:14px 32px;font-size:11px;color:#9AA3AE;text-align:center">
    Servicio Automotriz DIDIAL Ltda. · La Serena, Chile · serviciotecnico@didial.cl<br>
    Recibes este correo por ser cliente de DIDIAL.
  </td></tr>
</table>
</td></tr></table>'),
('00000000-0000-0000-0000-000000000001', 'Email · Recupero masivo',
 'Más de 1 año sin visitar, pocas visitas y montos menores. Invitación a revisión general con diagnóstico honesto.',
 'email', 'borrador', 6,
 '¿Cuándo fue la última revisión de tu vehículo?',
 '{"tipo":"recupero_masivo","dias_min":365,"min_visitas":3,"monto_min":500000}',
 '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F4F7;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
  <tr><td align="center" style="background:#12212F;padding:22px">
    <span style="font-size:30px;font-weight:900;letter-spacing:3px;color:#E0382B">DIDIAL</span><br>
    <span style="font-size:10px;letter-spacing:5px;color:#ffffff">SERVICIO AUTOMOTRIZ</span>
  </td></tr>
  <tr><td style="padding:26px 32px 6px">
    <h1 style="margin:0;font-size:20px;color:#1A1C20">Hola {nombre}, ¿cuándo fue la última revisión de tu vehículo?</h1>
  </td></tr>
  <tr><td style="padding:6px 32px 10px;font-size:15px;color:#3A4450;line-height:1.65">
    Ha pasado más de un año desde tu última visita a DIDIAL, y un vehículo sin revisión por tanto tiempo suele acumular desgastes silenciosos: aceite vencido, frenos exigidos, batería al límite.<br><br>
     Te invitamos a retomar el cuidado de tu auto con quienes ya lo conocen: agenda una <b>revisión general</b> y te entregamos un diagnóstico claro y honesto de su estado, sin compromisos.
  </td></tr>
  
  
      <tr><td align="center" style="padding:8px 32px 4px">
        <a href="https://wa.me/56989748626" style="display:inline-block;background:#E0382B;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:8px">Agendar mi revisión</a>
      </td></tr>
  <tr><td style="padding:16px 32px 22px;font-size:13px;color:#6B7280;line-height:1.6">
    Agenda tu hora respondiendo este correo o llamándonos al <b>+56 9 8974 8626</b>.<br>
    Te esperamos en Avda. Cuatro Esquinas 759, La Serena.
  </td></tr>
  <tr><td style="background:#F2F4F7;padding:14px 32px;font-size:11px;color:#9AA3AE;text-align:center">
    Servicio Automotriz DIDIAL Ltda. · La Serena, Chile · serviciotecnico@didial.cl<br>
    Recibes este correo por ser cliente de DIDIAL.
  </td></tr>
</table>
</td></tr></table>');

-- Diagnóstico final: tareas migradas y actividades vencidas restantes
select
  (select count(*) from tareas_campana) as tareas_de_campana,
  (select count(*) from actividades where campana_id is not null and resultado = 'pendiente') as actividades_campana_restantes;
