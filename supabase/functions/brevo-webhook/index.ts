// =====================================================================
// DIDIAL CRM · WEBHOOK DE EVENTOS BREVO (Supabase Edge Function)
// =====================================================================
// Recibe los eventos de Brevo (delivered, opened, click, bounce,
// unsubscribed...) y actualiza el estado de cada envío en email_envios.
//
// Despliegue:  supabase functions deploy brevo-webhook --no-verify-jwt
// Requiere secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BREVO_WEBHOOK_TOKEN
// Configurar en Brevo la URL del webhook:
//   https://<proyecto>.supabase.co/functions/v1/brevo-webhook?token=<BREVO_WEBHOOK_TOKEN>
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Brevo -> estado interno (+ ranking para no "degradar" un avance)
const MAPA: Record<string, string> = {
  delivered: 'entregado',
  opened: 'abierto', unique_opened: 'abierto', proxy_open: 'abierto',
  click: 'click',
  hard_bounce: 'rebote', soft_bounce: 'rebote', blocked: 'rebote', invalid_email: 'rebote', error: 'rebote',
  unsubscribed: 'no_suscrito',
  spam: 'spam', complaint: 'spam'
}
const RANK: Record<string, number> = { enviado: 1, entregado: 2, abierto: 3, click: 4, rebote: 5, no_suscrito: 6, spam: 7 }
const limpiarId = (m: string) => (m || '').replace(/[<>]/g, '').trim()

Deno.serve(async (req) => {
  try {
    const u = new URL(req.url)
    if (u.searchParams.get('token') !== Deno.env.get('BREVO_WEBHOOK_TOKEN')) {
      return new Response('forbidden', { status: 403 })
    }
    const body = await req.json().catch(() => null)
    if (!body) return new Response('bad request', { status: 400 })
    const eventos = Array.isArray(body) ? body : [body]

    const service = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    for (const ev of eventos) {
      const nuevo = MAPA[ev.event]
      if (!nuevo) continue
      const mid = limpiarId(ev['message-id'] || ev.message_id || '')
      if (!mid) continue
      // No degradar: solo actualiza si el nuevo estado tiene rango >= al actual
      const { data: fila } = await service.from('email_envios')
        .select('id, estado').eq('message_id', mid).limit(1).single()
      if (!fila) continue
      if ((RANK[nuevo] || 0) >= (RANK[fila.estado] || 0)) {
        await service.from('email_envios')
          .update({ estado: nuevo, actualizado_en: new Date().toISOString() })
          .eq('id', fila.id)
      }
    }
    return new Response('ok', { status: 200 })
  } catch (e) {
    return new Response(String((e as Error).message || e), { status: 500 })
  }
})
