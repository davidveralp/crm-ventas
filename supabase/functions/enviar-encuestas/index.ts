// ============================================================================
// DIDIAL CRM · enviar-encuestas
// ----------------------------------------------------------------------------
// Tres funciones en una:
//   POST { accion: 'despachar' }      → envía las encuestas programadas cuya
//                                        fecha ya llegó. Se llama desde pg_cron
//                                        o desde el panel de administración.
//   GET  ?token=XXX                    → devuelve los datos para el formulario
//                                        que el cliente abre desde el correo.
//   POST { token, nps, ... }           → guarda la respuesta.
//
// POR QUÉ AL DÍA SIGUIENTE Y NO AL ENTREGAR
// Un asesor preguntando "¿cómo lo hicimos?" con el cliente al frente obtiene
// cortesía, no evaluación: el NPS del panel marcaba +100. A las 24 horas el
// cliente ya usó el vehículo y responde sin nadie mirándolo.
//
// DESPLIEGUE
//   supabase functions deploy enviar-encuestas
//   Verify JWT: OFF (el cliente responde desde su correo, sin sesión)
//   Secrets: BREVO_API_KEY, PUBLIC_APP_URL
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const BREVO_KEY = Deno.env.get('BREVO_API_KEY') ?? ''
const APP_URL = Deno.env.get('PUBLIC_APP_URL') || 'https://crm-ventas-neon.vercel.app'
const REMITENTE = { name: 'Servicio Automotriz Didial', email: 'serviciotecnico@didial.cl' }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

const service = createClient(SB_URL, SB_KEY)

/** Correo de la encuesta. Sobrio a propósito: pedir opinión con demasiada
 *  decoración parece publicidad y baja la tasa de respuesta. */
function cuerpoCorreo(nombre: string, patente: string, url: string) {
  return `<!DOCTYPE html><html><body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f4f5f7;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden">
    <div style="background:#111922;padding:18px 24px">
      <span style="color:#fff;font-size:18px;font-weight:bold;letter-spacing:.5px">DIDIAL</span>
      <span style="color:#8b95a3;font-size:12px;display:block">Servicio Automotriz</span>
    </div>
    <div style="padding:24px">
      <p style="font-size:15px;color:#111922;margin:0 0 12px">Hola ${nombre},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;margin:0 0 16px">
        Ayer le entregamos su vehículo <strong>${patente}</strong>. Queremos saber cómo estuvo la
        atención: son cuatro preguntas y toma menos de un minuto.
      </p>
      <p style="text-align:center;margin:24px 0">
        <a href="${url}" style="display:inline-block;background:#e0382b;color:#fff;text-decoration:none;
           padding:13px 30px;border-radius:8px;font-size:15px;font-weight:bold">Responder la encuesta</a>
      </p>
      <p style="font-size:12px;color:#8b95a3;line-height:1.5;margin:16px 0 0">
        Si algo no salió como esperaba, cuéntenoslo aquí: lo revisamos caso a caso.
      </p>
    </div>
    <div style="padding:14px 24px;background:#f4f5f7;font-size:11px;color:#8b95a3">
      Avda. Cuatro Esquinas 759, La Serena · serviciotecnico@didial.cl
    </div>
  </div></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const url = new URL(req.url)

    // ---- El cliente abre el enlace del correo ----
    if (req.method === 'GET') {
      const token = url.searchParams.get('token')
      if (!token) return json({ error: 'Falta el token' }, 400)
      const { data } = await service.from('encuestas')
        .select('id, estado, nps, vehiculos(patente, marca, modelo), clientes(nombre)')
        .eq('token', token).maybeSingle()
      if (!data) return json({ error: 'Encuesta no encontrada' }, 404)
      return json({
        ok: true, ya_respondida: data.estado === 'respondida',
        vehiculo: data.vehiculos, cliente: data.clientes
      })
    }

    const body = await req.json().catch(() => ({}))

    // ---- El cliente envía su respuesta ----
    if (body.token) {
      const { data: enc } = await service.from('encuestas')
        .select('id, estado').eq('token', body.token).maybeSingle()
      if (!enc) return json({ error: 'Encuesta no encontrada' }, 404)
      if (enc.estado === 'respondida') return json({ ok: true, ya_respondida: true })

      const rango = (v: unknown, max: number) => {
        const n = Number(v)
        return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n) : null
      }
      await service.from('encuestas').update({
        estado: 'respondida', respondida_en: new Date().toISOString(),
        nps: rango(body.nps, 10),
        p_calidad: rango(body.p_calidad, 5),
        p_plazo: rango(body.p_plazo, 5),
        p_atencion: rango(body.p_atencion, 5),
        comentario: typeof body.comentario === 'string' ? body.comentario.slice(0, 2000) : null
      }).eq('id', enc.id)

      // Un detractor es un problema que hay que atender hoy, no a fin de mes.
      const nps = rango(body.nps, 10)
      if (nps !== null && nps <= 6) {
        const { data: det } = await service.from('v_postventa')
          .select('nombre, apellidos, patente, asesor_id:asesor').eq('id', enc.id).maybeSingle()
        await service.from('notificaciones').insert({
          empresa_id: '00000000-0000-0000-0000-000000000001',
          rol_destino: 'admin',
          titulo: `Cliente insatisfecho (${nps}/10)`,
          cuerpo: `${det?.nombre || 'Cliente'} · ${det?.patente || ''} — ${
            typeof body.comentario === 'string' && body.comentario.trim()
              ? body.comentario.slice(0, 160) : 'sin comentario'}`,
          url: '/informes?vista=postventa'
        })
      }
      return json({ ok: true })
    }

    // ---- Despacho de las programadas ----
    if (body.accion === 'despachar') {
      if (!BREVO_KEY) return json({ error: 'Falta el secret BREVO_API_KEY' }, 500)

      const { data: pend } = await service.from('encuestas')
        .select('id, token, email, clientes(nombre), vehiculos(patente)')
        .eq('estado', 'programada')
        .lte('enviar_desde', new Date().toISOString())
        .limit(50)

      const r = { revisadas: pend?.length || 0, enviadas: 0, sin_correo: 0, fallidas: 0 }
      for (const e of pend || []) {
        if (!e.email) {
          await service.from('encuestas').update({ estado: 'descartada' }).eq('id', e.id)
          r.sin_correo++; continue
        }
        const enlace = `${APP_URL}/encuesta?token=${e.token}`
        const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: REMITENTE,
            to: [{ email: e.email, name: (e.clientes as any)?.nombre || '' }],
            subject: `¿Cómo estuvo la atención de su ${(e.vehiculos as any)?.patente || 'vehículo'}?`,
            htmlContent: cuerpoCorreo(
              (e.clientes as any)?.nombre || 'estimado/a',
              (e.vehiculos as any)?.patente || 'vehículo', enlace)
          })
        })
        if (resp.ok) {
          await service.from('encuestas')
            .update({ estado: 'enviada', enviada_en: new Date().toISOString() }).eq('id', e.id)
          r.enviadas++
        } else {
          // No se marca como fallida: queda programada y se reintenta en el
          // próximo despacho. Un problema temporal de Brevo no debe perder la encuesta.
          console.error('Brevo rechazó el envío:', await resp.text())
          r.fallidas++
        }
      }
      return json({ ok: true, ...r })
    }

    return json({ error: 'Solicitud no reconocida' }, 400)
  } catch (e) {
    console.error(e)
    return json({ error: (e as Error).message }, 500)
  }
})
