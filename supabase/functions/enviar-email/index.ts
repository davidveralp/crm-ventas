// =====================================================================
// DIDIAL CRM · ENVIAR EMAIL MARKETING (Supabase Edge Function)
// =====================================================================
// Envía un correo a los clientes de un segmento (con email) vía Brevo,
// registrando cada envío en email_envios para poder medir su resultado.
//   { asunto, cuerpo, es_html?, cliente_ids?, segmento?, dias_recientes?, campana_id? }
//   v22: cliente_ids (audiencia explícita calculada por audiencia_campana)
//        y es_html (la plantilla ya viene en HTML, no convertir saltos).
// Solo lo puede invocar un admin.
//
// Despliegue:  supabase functions deploy enviar-email
// Requiere secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//                   SUPABASE_ANON_KEY, BREVO_API_KEY
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const limpiarId = (m: string) => (m || '').replace(/[<>]/g, '').trim()

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Verifica que quien llama sea admin
    const auth = req.headers.get('Authorization') || ''
    const cliente = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } })
    const { data: ud } = await cliente.auth.getUser()
    const uid = ud?.user?.id
    if (!uid) return json({ error: 'No autenticado' }, 401)
    const { data: perfil } = await service.from('usuarios').select('rol, empresa_id').eq('id', uid).single()
    if (!perfil || perfil.rol !== 'admin') return json({ error: 'Solo un administrador puede enviar emails' }, 403)

    const { asunto, cuerpo, es_html, cliente_ids, segmento, dias_recientes, campana_id } = await req.json()
    if (!asunto || !cuerpo) return json({ error: 'Faltan asunto o cuerpo' }, 400)

    // Remitente configurado por empresa (config sobre código)
    const { data: emp } = await service.from('empresas')
      .select('remitente_nombre, remitente_email').eq('id', perfil.empresa_id).single()
    const remitente = {
      name: emp?.remitente_nombre || 'CRM',
      email: emp?.remitente_email || 'administracion@didial.cl'
    }

    // Audiencia: lista explícita (campañas con criterio) o por segmento
    let q = service.from('clientes').select('id,nombre,apellidos,email')
      .eq('empresa_id', perfil.empresa_id).not('email', 'is', null)
    if (Array.isArray(cliente_ids) && cliente_ids.length) q = q.in('id', cliente_ids.slice(0, 2000))
    else {
      if (segmento) q = q.eq('segmento', segmento)
      if (dias_recientes) q = q.gte('creado_en', new Date(Date.now() - dias_recientes * 864e5).toISOString())
    }
    const { data: clientes } = await q.limit(2000)
    const dest = (clientes || []).filter((x) => x.email && x.email.includes('@'))
    if (!dest.length) return json({ ok: true, enviados: 0, motivo: 'Sin clientes con email en este segmento' })

    const brevoKey = Deno.env.get('BREVO_API_KEY')
    if (!brevoKey) return json({ error: 'Falta BREVO_API_KEY en los secrets' }, 500)

    // Crea la tanda
    const { data: blast, error: eb } = await service.from('email_blasts').insert({
      empresa_id: perfil.empresa_id, campana_id: campana_id || null,
      asunto, cuerpo, segmento: segmento || null, total: dest.length, creado_por: uid
    }).select('id').single()
    if (eb) return json({ error: 'No se pudo crear la tanda: ' + eb.message }, 500)

    // Cuerpo con personalización {nombre} -> {{params.nombre}}.
    // Si es_html, la plantilla ya trae su propio layout (no tocar saltos).
    const htmlBase = es_html
      ? String(cuerpo).replace(/\{nombre\}/g, '{{params.nombre}}')
      : `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1A1C20;line-height:1.6">
      ${String(cuerpo).replace(/\{nombre\}/g, '{{params.nombre}}').replace(/\n/g, '<br>')}
      <br><br><span style="color:#6B7280;font-size:12px">DIDIAL Servicio Automotriz · La Serena</span>
    </div>`

    let enviados = 0
    const filas: Record<string, unknown>[] = []
    for (let i = 0; i < dest.length; i += 50) {
      const lote = dest.slice(i, i + 50)
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: remitente,
          subject: asunto,
          htmlContent: htmlBase,
          messageVersions: lote.map((d) => ({
            to: [{ email: d.email.trim(), name: d.nombre || '' }],
            params: { nombre: (d.nombre || '').split(' ')[0] }
          }))
        })
      })
      const j = await r.json().catch(() => ({}))
      const ids: string[] = j.messageIds || (j.messageId ? [j.messageId] : [])
      lote.forEach((d, idx) => {
        filas.push({
          empresa_id: perfil.empresa_id, blast_id: blast.id, cliente_id: d.id,
          email: d.email.trim(), message_id: limpiarId(ids[idx] || ''),
          estado: r.ok ? 'enviado' : 'rebote'
        })
      })
      if (r.ok) enviados += lote.length
    }

    if (filas.length) await service.from('email_envios').insert(filas)
    await service.from('email_blasts').update({ enviados }).eq('id', blast.id)

    return json({ ok: true, enviados, total: dest.length, blast_id: blast.id })
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500)
  }
})
