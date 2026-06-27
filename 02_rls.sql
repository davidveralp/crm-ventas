// =====================================================================
// DIDIAL CRM · ENVIAR CAMPAÑA POR EMAIL (Supabase Edge Function)
// =====================================================================
// Recibe { campana_id }, busca los clientes del segmento de esa campaña
// que tengan email, y les envía el mensaje de la campaña vía Brevo.
//
// Despliegue:  supabase functions deploy enviar-campana
// Requiere secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BREVO_API_KEY
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { campana_id } = await req.json()
    if (!campana_id) {
      return new Response(JSON.stringify({ error: 'Falta campana_id' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Cargar la campaña
    const { data: c, error: ec } = await supabase
      .from('campanas').select('*').eq('id', campana_id).single()
    if (ec || !c) throw new Error('Campaña no encontrada')

    // 2. Buscar clientes del segmento con email
    let q = supabase.from('clientes').select('nombre,email').not('email', 'is', null)
    if (c.segmento) q = q.eq('segmento', c.segmento)
    if (c.dias_recientes) {
      const desde = new Date(Date.now() - c.dias_recientes * 864e5).toISOString()
      q = q.gte('creado_en', desde)
    }
    const { data: clientes } = await q.limit(1000)
    const destinatarios = (clientes || [])
      .filter((x) => x.email && x.email.includes('@'))
      .map((x) => ({ email: x.email.trim(), name: x.nombre }))

    if (!destinatarios.length) {
      return new Response(JSON.stringify({ ok: true, enviados: 0, motivo: 'Sin clientes con email en este segmento' }),
        { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // 3. Enviar vía Brevo (mensaje de la campaña)
    const brevoKey = Deno.env.get('BREVO_API_KEY')
    if (!brevoKey) throw new Error('Falta BREVO_API_KEY en los secrets')

    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1A1C20;line-height:1.6">
      ${(c.mensaje_plantilla || '').replace(/\n/g, '<br>')}
      <br><br><span style="color:#6B7280;font-size:12px">DIDIAL Servicio Automotriz · La Serena</span>
    </div>`

    // Brevo permite hasta ~50 destinatarios "to" por llamada; enviamos en lotes
    let enviados = 0
    for (let i = 0; i < destinatarios.length; i += 50) {
      const lote = destinatarios.slice(i, i + 50)
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'DIDIAL Servicio Automotriz', email: 'administracion@didial.cl' },
          messageVersions: lote.map((d) => ({ to: [d] })),
          subject: c.nombre,
          htmlContent: html
        })
      })
      if (r.ok) enviados += lote.length
    }

    // 4. Marcar campaña como activa
    await supabase.from('campanas').update({ estado: 'activa' }).eq('id', campana_id)

    return new Response(JSON.stringify({ ok: true, enviados, total: destinatarios.length }),
      { headers: { ...cors, 'Content-Type': 'application/json' } })

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message || e) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
