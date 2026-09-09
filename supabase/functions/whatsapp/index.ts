// ============================================================================
// DIDIAL CRM · whatsapp
// ----------------------------------------------------------------------------
// Conecta con la API de WhatsApp Business de Meta (Cloud API).
//
// TRES FUNCIONES
//   GET  ?hub.verify_token=...    → verificación del webhook (Meta la llama una
//                                    vez al configurarlo)
//   POST (desde Meta)             → mensajes entrantes del cliente
//   POST { accion: 'enviar' }     → mensaje saliente desde el CRM
//
// LOS DOS NÚMEROS
// Didial tiene dos: Toyota (+56 9 3740 1051) y Multimarca (+56 9 8974 8626).
// Cada uno tiene su `phone_number_id` en Meta. El CRM elige cuál usar según la
// sucursal del cliente, igual que ya hace con los correos de contacto.
//
// VENTANA DE 24 HORAS
// Meta solo permite mensajes libres dentro de las 24 h posteriores al último
// mensaje del cliente. Fuera de esa ventana hay que usar una plantilla
// aprobada. La función lo verifica y avisa en vez de fallar en silencio.
//
// SECRETS NECESARIOS
//   WA_TOKEN              token permanente del usuario del sistema
//   WA_PHONE_TOYOTA       phone_number_id del +56 9 3740 1051
//   WA_PHONE_MULTIMARCA   phone_number_id del +56 9 8974 8626
//   WA_VERIFY_TOKEN       cualquier texto que inventes; se repite en Meta
//
// DESPLIEGUE
//   supabase functions deploy whatsapp
//   Verify JWT: OFF (Meta llama sin sesión)
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const WA_TOKEN = Deno.env.get('WA_TOKEN') ?? ''
const WA_VERIFY = Deno.env.get('WA_VERIFY_TOKEN') ?? ''
const PHONES: Record<string, string> = {
  Toyota: Deno.env.get('WA_PHONE_TOYOTA') ?? '',
  Multimarca: Deno.env.get('WA_PHONE_MULTIMARCA') ?? ''
}
const EMPRESA = '00000000-0000-0000-0000-000000000001'
const API = 'https://graph.facebook.com/v21.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

const service = createClient(SB_URL, SB_KEY)

/** Normaliza a formato Meta: 56912345678, sin + ni espacios. */
function normalizarFono(t: string): string {
  const d = String(t || '').replace(/\D/g, '')
  if (d.startsWith('56')) return d
  if (d.length === 9 && d.startsWith('9')) return '56' + d
  if (d.length === 8) return '569' + d
  return d
}

/** Busca al cliente por teléfono, probando las variantes con que suele estar guardado. */
async function buscarCliente(fono: string) {
  const n = normalizarFono(fono)
  const ultimos8 = n.slice(-8)
  const { data } = await service.from('clientes')
    .select('id, nombre, apellidos, telefono, marca_principal, segmento')
    .ilike('telefono', `%${ultimos8}%`).limit(1)
  return data?.[0] || null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const url = new URL(req.url)

    // ---- Verificación del webhook (Meta la llama al configurarlo) ----
    if (req.method === 'GET') {
      const modo = url.searchParams.get('hub.mode')
      const token = url.searchParams.get('hub.verify_token')
      const challenge = url.searchParams.get('hub.challenge')
      if (modo === 'subscribe' && token === WA_VERIFY) {
        return new Response(challenge ?? '', { status: 200 })
      }
      return new Response('Token de verificación incorrecto', { status: 403 })
    }

    const body = await req.json().catch(() => ({}))

    // ---- Salida: el CRM envía un mensaje ----
    if (body.accion === 'enviar') {
      if (!WA_TOKEN) return json({ error: 'Falta el secret WA_TOKEN' }, 500)
      const sucursal = body.sucursal === 'Toyota' ? 'Toyota' : 'Multimarca'
      const phoneId = PHONES[sucursal]
      if (!phoneId) return json({ error: `Falta el secret WA_PHONE_${sucursal.toUpperCase()}` }, 500)

      const para = normalizarFono(body.telefono)
      if (!para) return json({ error: 'Teléfono inválido' }, 400)

      // Ventana de 24 h: fuera de ella Meta rechaza el texto libre.
      const { data: ultimo } = await service.from('wa_mensajes')
        .select('recibido_en').eq('telefono', para).eq('direccion', 'entrante')
        .order('recibido_en', { ascending: false }).limit(1).maybeSingle()
      const dentro = ultimo && (Date.now() - new Date(ultimo.recibido_en).getTime()) < 24 * 3600 * 1000

      const payload = (body.plantilla || !dentro)
        ? {
            messaging_product: 'whatsapp', to: para, type: 'template',
            template: {
              name: body.plantilla || 'hello_world',
              language: { code: body.idioma || 'es' },
              components: body.variables?.length
                ? [{ type: 'body', parameters: body.variables.map((v: string) => ({ type: 'text', text: v })) }]
                : undefined
            }
          }
        : { messaging_product: 'whatsapp', to: para, type: 'text', text: { body: body.texto } }

      const r = await fetch(`${API}/${phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const j = await r.json()
      if (!r.ok) {
        const motivo = j?.error?.message || `Meta respondió ${r.status}`
        return json({ error: motivo, fuera_de_ventana: !dentro && !body.plantilla }, 502)
      }

      await service.from('wa_mensajes').insert({
        empresa_id: EMPRESA, telefono: para, direccion: 'saliente',
        texto: body.texto || `[plantilla: ${body.plantilla}]`,
        wa_id: j.messages?.[0]?.id || null, sucursal,
        cliente_id: body.cliente_id || null, enviado_por: body.usuario_id || null
      })
      return json({ ok: true, wa_id: j.messages?.[0]?.id })
    }

    // ---- Entrada: Meta notifica un mensaje del cliente ----
    const entry = body.entry?.[0]?.changes?.[0]?.value
    if (entry?.messages?.length) {
      for (const m of entry.messages) {
        const fono = normalizarFono(m.from)
        const texto = m.text?.body || m.button?.text || m.interactive?.list_reply?.title || `[${m.type}]`
        const cliente = await buscarCliente(fono)

        await service.from('wa_mensajes').insert({
          empresa_id: EMPRESA, telefono: fono, direccion: 'entrante',
          texto, wa_id: m.id, cliente_id: cliente?.id || null,
          nombre_perfil: entry.contacts?.[0]?.profile?.name || null,
          recibido_en: new Date(Number(m.timestamp) * 1000).toISOString()
        })

        // Aviso a recepción. Sin esto el mensaje entra a la base y nadie lo ve.
        await service.from('notificaciones').insert({
          empresa_id: EMPRESA, rol_destino: 'asistente_administrativo',
          titulo: `WhatsApp de ${cliente ? `${cliente.nombre || ''} ${cliente.apellidos || ''}`.trim() : fono}`,
          cuerpo: texto.slice(0, 160), url: '/recepcion'
        })
      }
    }

    // Meta reintenta si no recibe 200, así que se responde siempre ok.
    return json({ ok: true })
  } catch (e) {
    console.error(e)
    return json({ ok: true, error: (e as Error).message })
  }
})
