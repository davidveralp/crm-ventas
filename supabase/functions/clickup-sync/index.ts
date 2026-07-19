// DIDIAL CRM · clickup-sync (v42)
// ---------------------------------------------------------------------
// Integración BIDIRECCIONAL entre trabajos_taller y la lista de ClickUp
// "Vehiculos en Taller" (space SERVICIO TECNICO).
//
// Dos entradas, distinguidas por el shape del body:
//
// 1) DESDE EL CRM (llamada interna del frontend tras crear/actualizar un
//    trabajo de taller):
//      POST { accion: 'crear' | 'actualizar', trabajo_id: uuid }
//    Requiere header Authorization con el JWT del usuario logueado (se
//    valida contra Supabase igual que las demás Edge Functions).
//
// 2) DESDE CLICKUP (webhook registrado una vez, ver instrucciones al
//    final de este archivo):
//      POST { event, task_id, history_items: [...] }
//    No requiere Authorization — se valida por la lista/team de origen.
//
// Solo se sincronizan datos GENERALES (estado, prioridad, fecha límite,
// cliente, observaciones) — los checklists de repuestos/insumos/servicio
// externo NO viajan a ClickUp (se manejan por separado en cada sistema).
//
// Secrets requeridos (Project Settings → Edge Functions → Secrets):
//   CLICKUP_API_TOKEN   → token personal de ClickUp (Settings → Apps)
//   CLICKUP_LIST_ID     → 901324296305 (lista "Vehiculos en Taller")
//   SB_PROJECT_URL      → https://ehpstxrzsjwcevcafxgk.supabase.co
//   SB_SERVICE_KEY      → tu Service Role / Secret Key (Settings → API)
// ---------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// v42.3: no depende de la inyección automática de SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY (en proyectos con el sistema nuevo de llaves
// de Supabase — publishable/secret key — esas variables reservadas
// pueden no llegar igual). Se leen como secrets propios primero, con la
// reservada como respaldo por si el proyecto sí las inyecta.
const SB_URL = Deno.env.get('SB_PROJECT_URL') || Deno.env.get('SUPABASE_URL') || ''
const SB_SERVICE_KEY = Deno.env.get('SB_SERVICE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const CLICKUP_TOKEN = Deno.env.get('CLICKUP_API_TOKEN') ?? ''
const CLICKUP_LIST_ID = Deno.env.get('CLICKUP_LIST_ID') || '901324296305'
const CLICKUP_API = 'https://api.clickup.com/api/v2'

// ---- Mapeo de estados CRM <-> ClickUp -------------------------------
// "revision" y "esperando_aprobacion" (diagnóstico/presupuesto, antes de
// que el vehículo entre físicamente a reparación) no tienen equivalente
// en ClickUp — se dejan en "por designar" allá y no se empujan como
// cambio de estado hasta que el CRM avance a un estado con equivalente.
const ESTADO_CRM_A_CLICKUP: Record<string, string> = {
  por_designar: 'por designar',
  en_reparacion: 'en reparación',
  servicio_externo: 'en rep. servicio externo',
  compra_repuestos: 'compra de repuestos',
  pintura_dyp: 'pintura/desabolladura',
  lavado: 'lavado',
  alineacion: 'alineacion',
  prueba_ruta: 'prueba en ruta',
  retroceso: 'retroceso',
  listo_entrega: 'listo para entrega'
}
const ESTADO_CLICKUP_A_CRM: Record<string, string> = Object.fromEntries(
  Object.entries(ESTADO_CRM_A_CLICKUP).map(([crm, cu]) => [cu, crm])
)
ESTADO_CLICKUP_A_CRM['complete'] = 'listo_entrega'   // cierre formal en ClickUp

const PRIORIDAD_CRM_A_CLICKUP: Record<string, number> = { urgente: 1, alta: 2, normal: 3 }
const PRIORIDAD_CLICKUP_A_CRM: Record<number, string> = { 1: 'urgente', 2: 'alta', 3: 'normal', 4: 'normal' }

// IDs de los campos personalizados de la lista "Vehiculos en Taller"
// (obtenidos vía la API de ClickUp — ver docs/ACTUALIZACION_v21.md v42)
const CAMPO_DATOS_CLIENTE = '61ad3618-8fe4-49e8-9b74-9beae1e15ec5'
const CAMPO_OBSERVACIONES = 'd2337ca4-7808-42ee-972a-40bfc0f83fec'

// v42.1: CORS — sin esto, el navegador bloquea el preflight OPTIONS antes
// de que el POST real llegue a la función (causa exacta del 4xx visto en
// el dashboard con 1 invocación / 100% 4xx).
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// v43: intenta extraer una patente del título de una tarea creada en
// ClickUp (texto libre, sin formato fijo). Es solo una SUGERENCIA — el
// jefe de taller la confirma o corrige antes de vincular/crear nada.
function extraerPatente(titulo: string): string | null {
  const m = (titulo || '').toUpperCase().match(/\b([A-Z]{2}\s?[A-Z]{2}\s?\d{2}|[A-Z]{2}\s?\d{4})\b/)
  return m ? m[1].replace(/\s+/g, ' ').trim() : null
}

function tituloDe(t: any) {
  const v = t.vehiculos
  return [v?.marca, v?.modelo, v?.patente, t.ot_numero ? `OT ${t.ot_numero}` : null].filter(Boolean).join(' ')
}

async function cuHeaders() {
  return { Authorization: CLICKUP_TOKEN, 'Content-Type': 'application/json' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  // v42.2: guardia explícita — si el entorno de la función no tiene las
  // variables reservadas de Supabase, se reporta un error claro en vez del
  // mensaje interno críptico "supabaseUrl is required" (síntoma de un
  // despliegue que no terminó de vincular el entorno). Solución: redesplegar
  // con `supabase functions deploy clickup-sync`.
  if (!SB_URL || !SB_SERVICE_KEY) {
    return json({ error: 'Faltan las variables SB_PROJECT_URL / SB_SERVICE_KEY.' }, 500)
  }
  const body = await req.json().catch(() => ({}))
  if ((body.accion === 'crear' || body.accion === 'actualizar') && !CLICKUP_TOKEN) {
    console.error('CLICKUP_API_TOKEN no está definido en el entorno de esta función.')
    return json({ error: 'Falta el secret CLICKUP_API_TOKEN (revisa Edge Functions → Secrets — debe estar EXACTAMENTE con ese nombre, sin espacios).' }, 500)
  }
  const service = createClient(SB_URL, SB_SERVICE_KEY)

  // ============== 1) DESDE EL CRM: crear o actualizar en ClickUp ======
  if (body.accion === 'crear' || body.accion === 'actualizar') {
    const auth = req.headers.get('Authorization') || ''
    if (!auth) return json({ error: 'Falta Authorization' }, 401)
    const userClient = createClient(SB_URL, SB_SERVICE_KEY, { global: { headers: { Authorization: auth } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'No autenticado' }, 401)

    const { data: t, error: eT } = await service.from('trabajos_taller')
      .select('*, clientes(nombre,apellidos,telefono), vehiculos(patente,marca,modelo)')
      .eq('id', body.trabajo_id).single()
    if (eT || !t) { console.error('Trabajo no encontrado:', body.trabajo_id, eT?.message); return json({ error: 'Trabajo no encontrado' }, 404) }

    const nombreCliente = [t.clientes?.nombre, t.clientes?.apellidos].filter(Boolean).join(' ')
    const datosCliente = [nombreCliente, t.clientes?.telefono].filter(Boolean).join('\n')
    const observaciones = [t.servicio_solicitado, t.observaciones_cliente].filter(Boolean).join(' · ')

    if (body.accion === 'crear' || !t.clickup_task_id) {
      const resp = await fetch(`${CLICKUP_API}/list/${CLICKUP_LIST_ID}/task`, {
        method: 'POST', headers: await cuHeaders(),
        body: JSON.stringify({
          name: tituloDe(t),
          priority: PRIORIDAD_CRM_A_CLICKUP[t.prioridad] || 3,
          due_date: t.fecha_limite ? new Date(t.fecha_limite).getTime() : undefined,
          custom_fields: [
            { id: CAMPO_DATOS_CLIENTE, value: datosCliente },
            { id: CAMPO_OBSERVACIONES, value: observaciones }
          ]
        })
      })
      const cu = await resp.json()
      if (!resp.ok) { console.error('ClickUp crear falló:', JSON.stringify(cu)); return json({ error: 'ClickUp: ' + JSON.stringify(cu) }, 400) }
      await service.from('trabajos_taller')
        .update({ clickup_task_id: cu.id, clickup_synced_at: new Date().toISOString() })
        .eq('id', t.id)
      return json({ ok: true, clickup_task_id: cu.id })
    }

    // actualizar tarjeta existente
    const estadoCU = ESTADO_CRM_A_CLICKUP[t.estado]
    const resp = await fetch(`${CLICKUP_API}/task/${t.clickup_task_id}`, {
      method: 'PUT', headers: await cuHeaders(),
      body: JSON.stringify({
        name: tituloDe(t),
        ...(estadoCU ? { status: estadoCU } : {}),   // revision/esperando_aprobacion: no se empuja estado
        priority: PRIORIDAD_CRM_A_CLICKUP[t.prioridad] || 3,
        due_date: t.fecha_limite ? new Date(t.fecha_limite).getTime() : null
      })
    })
    if (!resp.ok) { const errBody = await resp.json(); console.error('ClickUp actualizar falló:', JSON.stringify(errBody)); return json({ error: 'ClickUp: ' + JSON.stringify(errBody) }, 400) }
    await service.from('trabajos_taller').update({ clickup_synced_at: new Date().toISOString() }).eq('id', t.id)
    return json({ ok: true })
  }

  // ============== 2) DESDE CLICKUP: webhook de cambios ================
  if (body.event && body.task_id) {
    // v43: tarea creada DIRECTO en ClickUp (no viene del CRM) — no se
    // auto-crea el cliente/vehículo (texto libre, no confiable). Se
    // registra en la bandeja de revisión con una patente sugerida.
    if (body.event === 'taskCreated') {
      const { data: yaVinculado } = await service.from('trabajos_taller')
        .select('id').eq('clickup_task_id', body.task_id).maybeSingle()
      if (yaVinculado) return json({ ok: true, ignorado: 'ya vinculada (creada desde el CRM)' })

      const resp = await fetch(`${CLICKUP_API}/task/${body.task_id}`, { headers: await cuHeaders() })
      const tarea = await resp.json()
      if (!resp.ok) { console.error('No se pudo leer la tarea creada en ClickUp:', JSON.stringify(tarea)); return json({ ok: false }, 200) }

      await service.from('clickup_tareas_pendientes').upsert({
        clickup_task_id: body.task_id, titulo: tarea.name,
        descripcion: tarea.text_content || tarea.description || null,
        patente_candidata: extraerPatente(tarea.name), estado: 'pendiente'
      }, { onConflict: 'clickup_task_id' })
      return json({ ok: true, registrado_en_bandeja: true })
    }

    const { data: t } = await service.from('trabajos_taller')
      .select('id, estado, prioridad').eq('clickup_task_id', body.task_id).maybeSingle()
    if (!t) return json({ ok: true, ignorado: 'tarea sin trabajo vinculado' })

    const campos: Record<string, unknown> = {}
    for (const h of body.history_items || []) {
      if (h.field === 'status') {
        const nuevo = ESTADO_CLICKUP_A_CRM[(h.after?.status || '').toLowerCase()]
        if (nuevo) campos.estado = nuevo
      }
      if (h.field === 'priority') {
        const nuevo = PRIORIDAD_CLICKUP_A_CRM[Number(h.after?.priority)]
        if (nuevo) campos.prioridad = nuevo
      }
      if (h.field === 'due_date' && h.after) {
        campos.fecha_limite = new Date(Number(h.after)).toISOString().slice(0, 10)
      }
    }
    if (Object.keys(campos).length) {
      await service.from('trabajos_taller').update(campos).eq('id', t.id)
    }
    return json({ ok: true, actualizado: campos })
  }

  return json({ error: 'Solicitud no reconocida' }, 400)
})

// =======================================================================
// INSTRUCCIONES DE DESPLIEGUE (una sola vez)
// =======================================================================
// 1. Secrets (Supabase → Project Settings → Edge Functions → Secrets):
//      CLICKUP_API_TOKEN = tu token personal (ClickUp → Settings → Apps → API Token)
//      CLICKUP_LIST_ID   = 901324296305
//
// 2. Desplegar: supabase functions deploy clickup-sync
//
// 3. Registrar el webhook UNA VEZ (reemplaza TU_TOKEN y TU_PROYECTO):
//    curl -X POST https://api.clickup.com/api/v2/team/90132937173/webhook \
//      -H "Authorization: TU_TOKEN" -H "Content-Type: application/json" \
//      -d '{
//            "endpoint": "https://TU_PROYECTO.supabase.co/functions/v1/clickup-sync",
//            "events": ["taskStatusUpdated", "taskPriorityUpdated", "taskDueDateUpdated"],
//            "list_id": 901324296305
//          }'
//    Guarda el "id" y "secret" que devuelve la respuesta por si necesitas
//    eliminarlo o recrearlo más adelante (DELETE /webhook/{id}).
// =======================================================================
