// ============================================================================
// DIDIAL CRM · sync-planilla
// ----------------------------------------------------------------------------
// Mantiene la planilla histórica de OT al día con lo que ocurre en el CRM.
//
//   { accion: 'despachar' }   → envía todo lo pendiente de la cola
//   { accion: 'importar' }    → completa vehículos del CRM con datos de la planilla
//   { accion: 'enviar', ot_numero } → fuerza el envío de una OT puntual
//
// UNA OT = UNA FILA. Al ingresar se crea; al cerrar se actualiza la misma fila.
//
// POR QUÉ UNA COLA: si Google no responde, un envío directo perdería el dato o
// dejaría al asesor esperando con el cliente delante. La cola reintenta después
// y la entrega nunca se bloquea.
//
// SECRETS: SHEET_WEBAPP_URL · SHEET_TOKEN
// DESPLIEGUE: supabase functions deploy sync-planilla · Verify JWT: ON
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const WEBAPP = Deno.env.get('SHEET_WEBAPP_URL') ?? ''
const TOKEN = Deno.env.get('SHEET_TOKEN') ?? ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

const service = createClient(SB_URL, SB_KEY)

/** Envía una fila al Apps Script. Devuelve el motivo del error, o null si salió. */
async function escribirFila(fila: Record<string, unknown>): Promise<string | null> {
  try {
    const r = await fetch(WEBAPP, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TOKEN, accion: 'upsert', fila })
    })
    const txt = await r.text()
    if (!r.ok) return `HTTP ${r.status}: ${txt.slice(0, 200)}`
    try {
      const j = JSON.parse(txt)
      return j.ok ? null : (j.error || 'respuesta sin ok')
    } catch {
      // Si devuelve HTML, el Apps Script pidió autenticación: la publicación
      // quedó restringida en vez de "Cualquier usuario".
      return 'La URL no devolvió JSON. Revisa que el Apps Script esté publicado con acceso "Cualquier usuario".'
    }
  } catch (e) {
    return (e as Error).message
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    if (!WEBAPP) return json({ error: 'Falta el secret SHEET_WEBAPP_URL' }, 500)
    const body = await req.json().catch(() => ({}))

    // ---- Despachar la cola ----
    if (body.accion === 'despachar' || !body.accion) {
      const { data: cola } = await service.from('sync_planilla')
        .select('id, trabajo_id, ot_numero, etapa, intentos')
        .neq('estado', 'enviado')
        // Tras varios fallos el problema no se arregla insistiendo: se deja
        // para revisión manual en vez de golpear la API sin parar.
        .lt('intentos', 5)
        .order('creado_en').limit(100)

      const r = { total: cola?.length || 0, enviadas: 0, fallidas: 0, errores: [] as string[] }

      for (const item of cola || []) {
        const { data: fila } = await service.from('v_planilla_ot')
          .select('*').eq('trabajo_id', item.trabajo_id).maybeSingle()

        if (!fila) {
          await service.from('sync_planilla').update({
            estado: 'error', ultimo_error: 'La OT ya no existe', intentos: item.intentos + 1
          }).eq('id', item.id)
          r.fallidas++
          continue
        }

        // trabajo_id es interno del CRM: no va a la planilla.
        const { trabajo_id: _omit, ...columnas } = fila as Record<string, unknown>
        const error = await escribirFila(columnas)

        if (error) {
          await service.from('sync_planilla').update({
            estado: 'error', ultimo_error: error, intentos: item.intentos + 1
          }).eq('id', item.id)
          r.fallidas++
          if (r.errores.length < 3) r.errores.push(`OT ${item.ot_numero}: ${error}`)
        } else {
          await service.from('sync_planilla').update({
            estado: 'enviado', enviado_en: new Date().toISOString(), ultimo_error: null
          }).eq('id', item.id)
          r.enviadas++
        }
      }
      return json({ ok: true, ...r })
    }

    // ---- Enviar una OT puntual ----
    if (body.accion === 'enviar' && body.ot_numero) {
      const { data: fila } = await service.from('v_planilla_ot')
        .select('*').eq('N° Orden Trabajo', body.ot_numero).maybeSingle()
      if (!fila) return json({ error: `No existe la OT ${body.ot_numero}` }, 404)
      const { trabajo_id: _o, ...columnas } = fila as Record<string, unknown>
      const error = await escribirFila(columnas)
      if (error) return json({ error }, 502)
      return json({ ok: true, ot: body.ot_numero })
    }

    // ---- Importar: completar vehículos con datos de la planilla ----
    if (body.accion === 'importar') {
      const r = await fetch(WEBAPP, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, accion: 'leer', desde: body.desde || 2 })
      })
      if (!r.ok) return json({ error: `La planilla respondió ${r.status}` }, 502)
      const { filas } = await r.json()

      const res = { revisadas: filas?.length || 0, vehiculos_nuevos: 0, actualizados: 0, sin_patente: 0 }

      for (const f of filas || []) {
        const patente = String(f['Patente'] || '').trim()
        const norm = patente.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
        if (norm.length < 5) { res.sin_patente++; continue }

        const { data: veh } = await service.from('vehiculos')
          .select('id, marca, modelo, anio, cilindrada, km_ultimo')
          .eq('patente_norm', norm).maybeSingle()

        const km = parseInt(String(f['Kilometraje'] || '').replace(/\D/g, ''), 10) || null

        if (veh) {
          /* Solo se completa lo que falta: la planilla es histórica y pisar un
             dato más reciente del CRM sería retroceder. El kilometraje es la
             excepción, porque siempre avanza. */
          const parche: Record<string, unknown> = {}
          if (!veh.marca && f['Marca']) parche.marca = f['Marca']
          if (!veh.modelo && f['Modelo']) parche.modelo = f['Modelo']
          if (!veh.anio && f['Año']) parche.anio = f['Año']
          if (!veh.cilindrada && f['Cilindrada']) parche.cilindrada = f['Cilindrada']
          if (km && km > (veh.km_ultimo || 0)) parche.km_ultimo = km

          if (Object.keys(parche).length) {
            await service.from('vehiculos').update(parche).eq('id', veh.id)
            res.actualizados++
          }
        } else {
          const { error: eV } = await service.from('vehiculos').insert({
            empresa_id: '00000000-0000-0000-0000-000000000001',
            patente, marca: f['Marca'] || null, modelo: f['Modelo'] || null,
            anio: f['Año'] || null, cilindrada: f['Cilindrada'] || null, km_ultimo: km
          })
          if (!eV) res.vehiculos_nuevos++
        }
      }
      return json({ ok: true, ...res })
    }

    return json({ error: 'Acción no reconocida' }, 400)
  } catch (e) {
    console.error(e)
    return json({ error: (e as Error).message }, 500)
  }
})
