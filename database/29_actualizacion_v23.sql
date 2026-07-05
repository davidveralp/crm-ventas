-- =====================================================================
-- ACTUALIZACIÓN v23 · Flujo de presupuestos por el encargado, cotización
-- rápida del asesor, empresa con razón social, anulación de OT y email
-- marketing personalizado (logo, slogan, vehículo/servicio, contactos
-- Toyota/multimarca)
-- Idempotente. Requiere migraciones 1–28.
-- =====================================================================

-- ---- 1) Clientes tipo Empresa: contacto además de la razón social ----
alter table clientes add column if not exists contacto_nombre text;

-- ---- 2) Presupuestos de taller: reasignados al ENCARGADO --------------
-- El presupuesto se elabora desde el módulo Presupuestos (rol
-- coordinador_adquisiciones o admin), no desde el taller. Además se
-- habilitan cotizaciones rápidas del asesor (sin trabajo de taller).
alter table presupuestos_taller alter column trabajo_id drop not null;
alter table presupuestos_taller add column if not exists cliente_id  uuid references clientes(id)  on delete set null;
alter table presupuestos_taller add column if not exists vehiculo_id uuid references vehiculos(id) on delete set null;
alter table presupuestos_taller add column if not exists origen      text default 'taller';  -- taller | rapida
alter table presupuestos_taller add column if not exists compra_gestionada_en timestamptz;
alter table presupuestos_taller add column if not exists compra_por  uuid references usuarios(id) on delete set null;

-- Backfill: cliente y vehículo desde el trabajo para lo ya existente
update presupuestos_taller p set
  cliente_id  = coalesce(p.cliente_id,  t.cliente_id),
  vehiculo_id = coalesce(p.vehiculo_id, t.vehiculo_id)
from trabajos_taller t where p.trabajo_id = t.id;

-- ---- 3) OT: RUT/contacto de empresa y solicitud de anulación ----------
alter table ordenes_trabajo add column if not exists rut               text;
alter table ordenes_trabajo add column if not exists contacto_nombre   text;
alter table ordenes_trabajo add column if not exists anulacion_solicitada boolean default false;

-- ---- 4) Audiencia de campañas v2: datos para personalizar -------------
-- Devuelve además marca/modelo del vehículo de la última visita, el
-- último servicio realizado y el contacto según marca (Toyota vs
-- multimarca) para la firma del correo.
create or replace function audiencia_campana(p_campana uuid)
returns table (cliente_id uuid, nombre text, apellidos text, email text,
               telefono text, ultima_visita date, visitas_12m bigint, facturacion numeric,
               marca text, modelo text, ultimo_servicio text,
               contacto_email text, contacto_fono text)
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
),
ult as (  -- servicio y vehículo de la última visita
  select distinct on (s.cliente_id) s.cliente_id, s.tipo_servicio, v.marca, v.modelo
    from servicios s
    left join vehiculos v on v.id = s.vehiculo_id
   where s.fecha is not null
   order by s.cliente_id, s.fecha desc
)
select b.id, b.nombre, b.apellidos, b.email, b.telefono, b.ult_visita, b.visitas_12m, b.fact,
       u.marca, u.modelo, u.tipo_servicio,
       case when upper(coalesce(u.marca,'')) = 'TOYOTA' then 'serviciotoyota@didial.cl'  else 'serviciotecnico@didial.cl' end,
       case when upper(coalesce(u.marca,'')) = 'TOYOTA' then '+56 9 3740 1051'           else '+56 9 8974 8626'            end
  from base b
  left join ult u on u.cliente_id = b.id
  cross join cfg
 where case cfg.cr->>'tipo'
   when 'mant_proxima' then
        b.ult_mant is not null
        and b.ult_mant between current_date - coalesce((cfg.cr->>'dias_max')::int, 180)
                           and current_date - coalesce((cfg.cr->>'dias_min')::int, 150)
        and b.ult_mant = b.ult_visita
   when 'mant_vencida' then
        b.ult_mant is not null
        and b.ult_mant between current_date - coalesce((cfg.cr->>'dias_max')::int, 365)
                           and current_date - coalesce((cfg.cr->>'dias_min')::int, 181)
        and b.ult_mant = b.ult_visita
   when 'fidelizacion_reparacion' then
        b.ult_visita between current_date - coalesce((cfg.cr->>'dias_max')::int, 180)
                         and current_date - coalesce((cfg.cr->>'dias_min')::int, 60)
        and (b.ult_mant is null or b.ult_mant < b.ult_visita)
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

-- ---- 5) Plantillas v2: logo real, slogan y personalización ------------
-- Placeholders: {nombre} {vehiculo} {servicio} {contacto_email} {contacto_fono}
-- Slogan institucional: "Cuidamos lo que te mueve"
update campanas set mensaje_plantilla = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F4F7;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
  <tr><td align="center" style="background:#ffffff;padding:20px 20px 6px">
    <img src="https://crm-ventas-neon.vercel.app/logo-didial.png" alt="DIDIAL Servicio Automotriz" width="220" style="display:block;max-width:220px;height:auto">
    <div style="font-size:12px;color:#6B7280;letter-spacing:1px;padding-top:4px">Cuidamos lo que te mueve</div>
  </td></tr>
  <tr><td style="padding:22px 32px 6px">
    <h1 style="margin:0;font-size:20px;color:#1A1C20">Hola {nombre}, la mantención de tu {vehiculo} está por cumplirse</h1>
  </td></tr>
  <tr><td style="padding:6px 32px 10px;font-size:15px;color:#3A4450;line-height:1.65">
    Tu <b>{vehiculo}</b> ya se acerca a los <b>6 meses desde su última mantención</b> ({servicio}), el plazo recomendado para mantenerlo seguro, eficiente y con su respaldo de servicio al día.<br><br>
     Para ayudarte a no dejarlo pasar, te regalamos un <b>10% de descuento</b> en tu próxima mantención. Solo muestra este código al llegar o menciónalo al agendar:
  </td></tr>
  
      <tr><td align="center" style="padding:6px 32px 2px">
        <div style="border:2px dashed #E0382B;border-radius:10px;padding:12px 20px;display:inline-block">
          <span style="font-size:12px;color:#6B7280;letter-spacing:1px">TU CÓDIGO DE DESCUENTO</span><br>
          <span style="font-size:22px;font-weight:bold;color:#1A1C20;letter-spacing:3px">MANT10-DIDIAL</span>
        </div>
      </td></tr>
  
      <tr><td align="center" style="padding:8px 32px 4px">
        <a href="mailto:{contacto_email}" style="display:inline-block;background:#E0382B;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:8px">Agendar mi mantención</a>
      </td></tr>
  <tr><td style="padding:16px 32px 22px;font-size:13px;color:#6B7280;line-height:1.6">
    Agenda tu hora respondiendo a <a href="mailto:{contacto_email}" style="color:#E0382B">{contacto_email}</a> o llamándonos al <b>{contacto_fono}</b>.<br>
    Te esperamos en Avda. Cuatro Esquinas 759, La Serena.
  </td></tr>
  <tr><td style="background:#12212F;padding:16px 32px;text-align:center">
    <span style="font-size:14px;font-weight:bold;color:#ffffff;letter-spacing:1px">DIDIAL Servicio Automotriz</span><br>
    <span style="font-size:11px;color:#E0382B;font-style:italic">Cuidamos lo que te mueve</span><br>
    <span style="font-size:10px;color:#9AA3AE">La Serena, Chile · {contacto_email} · {contacto_fono}<br>Recibes este correo por ser cliente de DIDIAL.</span>
  </td></tr>
</table>
</td></tr></table>'          where empresa_id = '00000000-0000-0000-0000-000000000001' and criterio->>'tipo' = 'mant_proxima';
update campanas set mensaje_plantilla = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F4F7;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
  <tr><td align="center" style="background:#ffffff;padding:20px 20px 6px">
    <img src="https://crm-ventas-neon.vercel.app/logo-didial.png" alt="DIDIAL Servicio Automotriz" width="220" style="display:block;max-width:220px;height:auto">
    <div style="font-size:12px;color:#6B7280;letter-spacing:1px;padding-top:4px">Cuidamos lo que te mueve</div>
  </td></tr>
  <tr><td style="padding:22px 32px 6px">
    <h1 style="margin:0;font-size:20px;color:#1A1C20">Hola {nombre}, ¿cómo ha andado tu {vehiculo}?</h1>
  </td></tr>
  <tr><td style="padding:6px 32px 10px;font-size:15px;color:#3A4450;line-height:1.65">
    Hace algunas semanas realizamos en tu <b>{vehiculo}</b> el servicio de <b>{servicio}</b>, y queremos saber cómo ha respondido desde entonces. Tu tranquilidad al volante es lo que más nos importa.<br><br>
     Como agradecimiento por tu confianza, te invitamos a una <b>inspección de cortesía sin costo</b>: revisamos niveles, frenos, suspensión y el trabajo realizado, para que sigas manejando con total seguridad.
  </td></tr>
  
  
      <tr><td align="center" style="padding:8px 32px 4px">
        <a href="mailto:{contacto_email}" style="display:inline-block;background:#E0382B;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:8px">Reservar mi inspección de cortesía</a>
      </td></tr>
  <tr><td style="padding:16px 32px 22px;font-size:13px;color:#6B7280;line-height:1.6">
    Agenda tu hora respondiendo a <a href="mailto:{contacto_email}" style="color:#E0382B">{contacto_email}</a> o llamándonos al <b>{contacto_fono}</b>.<br>
    Te esperamos en Avda. Cuatro Esquinas 759, La Serena.
  </td></tr>
  <tr><td style="background:#12212F;padding:16px 32px;text-align:center">
    <span style="font-size:14px;font-weight:bold;color:#ffffff;letter-spacing:1px">DIDIAL Servicio Automotriz</span><br>
    <span style="font-size:11px;color:#E0382B;font-style:italic">Cuidamos lo que te mueve</span><br>
    <span style="font-size:10px;color:#9AA3AE">La Serena, Chile · {contacto_email} · {contacto_fono}<br>Recibes este correo por ser cliente de DIDIAL.</span>
  </td></tr>
</table>
</td></tr></table>' where empresa_id = '00000000-0000-0000-0000-000000000001' and criterio->>'tipo' = 'fidelizacion_reparacion';
update campanas set mensaje_plantilla = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F4F7;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
  <tr><td align="center" style="background:#ffffff;padding:20px 20px 6px">
    <img src="https://crm-ventas-neon.vercel.app/logo-didial.png" alt="DIDIAL Servicio Automotriz" width="220" style="display:block;max-width:220px;height:auto">
    <div style="font-size:12px;color:#6B7280;letter-spacing:1px;padding-top:4px">Cuidamos lo que te mueve</div>
  </td></tr>
  <tr><td style="padding:22px 32px 6px">
    <h1 style="margin:0;font-size:20px;color:#1A1C20">Hola {nombre}, tu {vehiculo} te está pidiendo su mantención</h1>
  </td></tr>
  <tr><td style="padding:6px 32px 10px;font-size:15px;color:#3A4450;line-height:1.65">
    Han pasado <b>más de 6 meses desde la última mantención</b> de tu <b>{vehiculo}</b> ({servicio}). Postergarla puede transformar desgastes simples en reparaciones costosas: aceite degradado, frenos exigidos, filtros saturados.<br><br>
     Ponerte al día es fácil, y queremos ayudarte: tienes un <b>10% de descuento</b> en tu próxima mantención presentando este código:
  </td></tr>
  
      <tr><td align="center" style="padding:6px 32px 2px">
        <div style="border:2px dashed #E0382B;border-radius:10px;padding:12px 20px;display:inline-block">
          <span style="font-size:12px;color:#6B7280;letter-spacing:1px">TU CÓDIGO DE DESCUENTO</span><br>
          <span style="font-size:22px;font-weight:bold;color:#1A1C20;letter-spacing:3px">MANT10-DIDIAL</span>
        </div>
      </td></tr>
  
      <tr><td align="center" style="padding:8px 32px 4px">
        <a href="mailto:{contacto_email}" style="display:inline-block;background:#E0382B;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:8px">Poner mi vehículo al día</a>
      </td></tr>
  <tr><td style="padding:16px 32px 22px;font-size:13px;color:#6B7280;line-height:1.6">
    Agenda tu hora respondiendo a <a href="mailto:{contacto_email}" style="color:#E0382B">{contacto_email}</a> o llamándonos al <b>{contacto_fono}</b>.<br>
    Te esperamos en Avda. Cuatro Esquinas 759, La Serena.
  </td></tr>
  <tr><td style="background:#12212F;padding:16px 32px;text-align:center">
    <span style="font-size:14px;font-weight:bold;color:#ffffff;letter-spacing:1px">DIDIAL Servicio Automotriz</span><br>
    <span style="font-size:11px;color:#E0382B;font-style:italic">Cuidamos lo que te mueve</span><br>
    <span style="font-size:10px;color:#9AA3AE">La Serena, Chile · {contacto_email} · {contacto_fono}<br>Recibes este correo por ser cliente de DIDIAL.</span>
  </td></tr>
</table>
</td></tr></table>'          where empresa_id = '00000000-0000-0000-0000-000000000001' and criterio->>'tipo' = 'mant_vencida';
update campanas set mensaje_plantilla = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F4F7;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
  <tr><td align="center" style="background:#ffffff;padding:20px 20px 6px">
    <img src="https://crm-ventas-neon.vercel.app/logo-didial.png" alt="DIDIAL Servicio Automotriz" width="220" style="display:block;max-width:220px;height:auto">
    <div style="font-size:12px;color:#6B7280;letter-spacing:1px;padding-top:4px">Cuidamos lo que te mueve</div>
  </td></tr>
  <tr><td style="padding:22px 32px 6px">
    <h1 style="margin:0;font-size:20px;color:#1A1C20">{nombre}, gracias por tu preferencia — esto le sirve a tu {vehiculo}</h1>
  </td></tr>
  <tr><td style="padding:6px 32px 10px;font-size:15px;color:#3A4450;line-height:1.65">
    Eres de los clientes que más nos visita y eso nos compromete contigo. Por eso te compartimos <b>3 claves de mecánica preventiva</b> que alargan la vida de tu <b>{vehiculo}</b>:<br><br>
     <b>1. Aceite y filtros a tiempo:</b> cada 6 meses o según pauta — es el seguro de vida del motor.<br>
     <b>2. Frenos y neumáticos:</b> revisa su desgaste cada 10.000 km; frenar bien no es negociable.<br>
     <b>3. Escucha tu auto:</b> ruidos, tirones o testigos encendidos siempre son avisos tempranos — atenderlos a tiempo cuesta menos.<br><br>
     Y porque preferimos prevenir contigo, te invitamos a una <b>inspección de cortesía sin costo</b> cuando quieras pasar.
  </td></tr>
  
  
      <tr><td align="center" style="padding:8px 32px 4px">
        <a href="mailto:{contacto_email}" style="display:inline-block;background:#E0382B;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:8px">Agendar inspección de cortesía</a>
      </td></tr>
  <tr><td style="padding:16px 32px 22px;font-size:13px;color:#6B7280;line-height:1.6">
    Agenda tu hora respondiendo a <a href="mailto:{contacto_email}" style="color:#E0382B">{contacto_email}</a> o llamándonos al <b>{contacto_fono}</b>.<br>
    Te esperamos en Avda. Cuatro Esquinas 759, La Serena.
  </td></tr>
  <tr><td style="background:#12212F;padding:16px 32px;text-align:center">
    <span style="font-size:14px;font-weight:bold;color:#ffffff;letter-spacing:1px">DIDIAL Servicio Automotriz</span><br>
    <span style="font-size:11px;color:#E0382B;font-style:italic">Cuidamos lo que te mueve</span><br>
    <span style="font-size:10px;color:#9AA3AE">La Serena, Chile · {contacto_email} · {contacto_fono}<br>Recibes este correo por ser cliente de DIDIAL.</span>
  </td></tr>
</table>
</td></tr></table>'           where empresa_id = '00000000-0000-0000-0000-000000000001' and criterio->>'tipo' = 'fidelizados';
update campanas set mensaje_plantilla = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F4F7;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
  <tr><td align="center" style="background:#ffffff;padding:20px 20px 6px">
    <img src="https://crm-ventas-neon.vercel.app/logo-didial.png" alt="DIDIAL Servicio Automotriz" width="220" style="display:block;max-width:220px;height:auto">
    <div style="font-size:12px;color:#6B7280;letter-spacing:1px;padding-top:4px">Cuidamos lo que te mueve</div>
  </td></tr>
  <tr><td style="padding:22px 32px 6px">
    <h1 style="margin:0;font-size:20px;color:#1A1C20">{nombre}, te echamos de menos en DIDIAL</h1>
  </td></tr>
  <tr><td style="padding:6px 32px 10px;font-size:15px;color:#3A4450;line-height:1.65">
    Ha pasado más de un año desde tu última visita con tu <b>{vehiculo}</b> ({servicio}) y de verdad nos gustaría volver a verte. Clientes como tú son la razón por la que trabajamos con tanto cariño.<br><br>
     Queremos que tu regreso sea especial: tienes un <b>10% de descuento en tu próxima visita</b>, sea mantención o reparación. Solo presenta este código:
  </td></tr>
  
      <tr><td align="center" style="padding:6px 32px 2px">
        <div style="border:2px dashed #E0382B;border-radius:10px;padding:12px 20px;display:inline-block">
          <span style="font-size:12px;color:#6B7280;letter-spacing:1px">TU CÓDIGO DE DESCUENTO</span><br>
          <span style="font-size:22px;font-weight:bold;color:#1A1C20;letter-spacing:3px">VUELVE10-DIDIAL</span>
        </div>
      </td></tr>
  
      <tr><td align="center" style="padding:8px 32px 4px">
        <a href="mailto:{contacto_email}" style="display:inline-block;background:#E0382B;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:8px">Volver a DIDIAL</a>
      </td></tr>
  <tr><td style="padding:16px 32px 22px;font-size:13px;color:#6B7280;line-height:1.6">
    Agenda tu hora respondiendo a <a href="mailto:{contacto_email}" style="color:#E0382B">{contacto_email}</a> o llamándonos al <b>{contacto_fono}</b>.<br>
    Te esperamos en Avda. Cuatro Esquinas 759, La Serena.
  </td></tr>
  <tr><td style="background:#12212F;padding:16px 32px;text-align:center">
    <span style="font-size:14px;font-weight:bold;color:#ffffff;letter-spacing:1px">DIDIAL Servicio Automotriz</span><br>
    <span style="font-size:11px;color:#E0382B;font-style:italic">Cuidamos lo que te mueve</span><br>
    <span style="font-size:10px;color:#9AA3AE">La Serena, Chile · {contacto_email} · {contacto_fono}<br>Recibes este correo por ser cliente de DIDIAL.</span>
  </td></tr>
</table>
</td></tr></table>'   where empresa_id = '00000000-0000-0000-0000-000000000001' and criterio->>'tipo' = 'recupero_importante';
update campanas set mensaje_plantilla = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F4F7;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
  <tr><td align="center" style="background:#ffffff;padding:20px 20px 6px">
    <img src="https://crm-ventas-neon.vercel.app/logo-didial.png" alt="DIDIAL Servicio Automotriz" width="220" style="display:block;max-width:220px;height:auto">
    <div style="font-size:12px;color:#6B7280;letter-spacing:1px;padding-top:4px">Cuidamos lo que te mueve</div>
  </td></tr>
  <tr><td style="padding:22px 32px 6px">
    <h1 style="margin:0;font-size:20px;color:#1A1C20">Hola {nombre}, ¿cuándo fue la última revisión de tu {vehiculo}?</h1>
  </td></tr>
  <tr><td style="padding:6px 32px 10px;font-size:15px;color:#3A4450;line-height:1.65">
    Ha pasado más de un año desde la última visita de tu <b>{vehiculo}</b> a DIDIAL, y un vehículo sin revisión por tanto tiempo suele acumular desgastes silenciosos: aceite vencido, frenos exigidos, batería al límite.<br><br>
     Te invitamos a retomar su cuidado con quienes ya lo conocen: agenda una <b>revisión general</b> y te entregamos un diagnóstico claro y honesto de su estado, sin compromisos.
  </td></tr>
  
  
      <tr><td align="center" style="padding:8px 32px 4px">
        <a href="mailto:{contacto_email}" style="display:inline-block;background:#E0382B;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:8px">Agendar mi revisión</a>
      </td></tr>
  <tr><td style="padding:16px 32px 22px;font-size:13px;color:#6B7280;line-height:1.6">
    Agenda tu hora respondiendo a <a href="mailto:{contacto_email}" style="color:#E0382B">{contacto_email}</a> o llamándonos al <b>{contacto_fono}</b>.<br>
    Te esperamos en Avda. Cuatro Esquinas 759, La Serena.
  </td></tr>
  <tr><td style="background:#12212F;padding:16px 32px;text-align:center">
    <span style="font-size:14px;font-weight:bold;color:#ffffff;letter-spacing:1px">DIDIAL Servicio Automotriz</span><br>
    <span style="font-size:11px;color:#E0382B;font-style:italic">Cuidamos lo que te mueve</span><br>
    <span style="font-size:10px;color:#9AA3AE">La Serena, Chile · {contacto_email} · {contacto_fono}<br>Recibes este correo por ser cliente de DIDIAL.</span>
  </td></tr>
</table>
</td></tr></table>'       where empresa_id = '00000000-0000-0000-0000-000000000001' and criterio->>'tipo' = 'recupero_masivo';

-- Diagnóstico
select count(*) as campanas_email from campanas where criterio is not null;
