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

// v48.1 (SEGURIDAD): secret que devuelve ClickUp al registrar el webhook.
// Sin esto la rama del webhook era un endpoint PÚBLICO con service role:
// cualquiera con la URL podía cambiar estados, prioridades y fechas de
// trabajos_taller. Se obtiene con registrar_webhook.ps1 y se guarda en
// Edge Functions → Secrets como CLICKUP_WEBHOOK_SECRET.
const CLICKUP_WEBHOOK_SECRET = Deno.env.get('CLICKUP_WEBHOOK_SECRET') ?? ''

// ClickUp firma cada webhook con HMAC-SHA256 del cuerpo CRUDO usando el
// secret, y lo envía en el header X-Signature (hex). Hay que comparar
// contra el texto exacto recibido: si se re-serializa el JSON la firma
// no calza.
async function firmaValida(rawBody: string, firmaRecibida: string): Promise<boolean> {
  if (!CLICKUP_WEBHOOK_SECRET || !firmaRecibida) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(CLICKUP_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const esperada = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0')).join('')
  // Comparación de tiempo constante (evita timing attacks)
  if (esperada.length !== firmaRecibida.length) return false
  let dif = 0
  for (let i = 0; i < esperada.length; i++) dif |= esperada.charCodeAt(i) ^ firmaRecibida.charCodeAt(i)
  return dif === 0
}

// ---- Mapeo de estados CRM <-> ClickUp -------------------------------
// "revision" y "esperando_aprobacion" (diagnóstico/presupuesto, antes de
// que el vehículo entre físicamente a reparación) no tienen equivalente
// en ClickUp — se dejan en "por designar" allá y no se empujan como
// cambio de estado hasta que el CRM avance a un estado con equivalente.
const ESTADO_CRM_A_CLICKUP: Record<string, string> = {
  agenda: 'agenda',                    // v91: faltaba, y es el más usado en ClickUp
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

// La tabla tiene `default empresa_actual()`, pero el webhook escribe con service
// role, donde auth.uid() es null y ese default devolvería null. Hay que pasarlo.
const EMPRESA_ID = '00000000-0000-0000-0000-000000000001'

// IDs de los campos personalizados de la lista "Vehiculos en Taller"
// (obtenidos vía la API de ClickUp — ver docs/ACTUALIZACION_v21.md v42)
const CAMPO_DATOS_CLIENTE = '61ad3618-8fe4-49e8-9b74-9beae1e15ec5'
const CAMPO_OBSERVACIONES = 'd2337ca4-7808-42ee-972a-40bfc0f83fec'
// Progreso: campo automático de ClickUp. Lo calcula a partir de subtareas,
// listas de control y comentarios asignados, así que NO se escribe desde el
// CRM: solo se lee para reflejarlo en el tablero.
const CAMPO_PROGRESO = 'bc7e20f6-6b4c-4286-8ada-4b4b4b5616cb'
const CAMPO_SUGERENCIAS = 'd75b0b10-d458-42af-8d6a-33122d317104'

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
  // v48.1: se lee el cuerpo CRUDO (no req.json()) porque la firma del
  // webhook se calcula sobre el texto exacto recibido.
  const rawBody = await req.text().catch(() => '')
  let body: any = {}
  try { body = rawBody ? JSON.parse(rawBody) : {} } catch { body = {} }
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
          // El estado no se enviaba, así que ClickUp aplicaba el primero de su
          // lista. Ahora se manda explícito: un ingreso nace en "por designar"
          // y debe verse así en el tablero desde el primer momento.
          status: ESTADO_CRM_A_CLICKUP[t.estado] || 'por designar',
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

      // v44: crea como Subtareas de ClickUp las tareas de reparación que
      // ya existan para este trabajo (ej. las 31 de MAN X PAUTA).
      const { data: tareas } = await service.from('tareas_taller')
        .select('id,titulo,estado').eq('trabajo_id', t.id).order('orden')
      for (const tarea of tareas || []) {
        const respSub = await fetch(`${CLICKUP_API}/list/${CLICKUP_LIST_ID}/task`, {
          method: 'POST', headers: await cuHeaders(),
          body: JSON.stringify({ name: tarea.titulo, parent: cu.id })
        })
        const cuSub = await respSub.json()
        if (respSub.ok) await service.from('tareas_taller').update({ clickup_subtask_id: cuSub.id }).eq('id', tarea.id)
        else console.error('ClickUp subtarea falló:', tarea.titulo, JSON.stringify(cuSub))
      }
      return json({ ok: true, clickup_task_id: cu.id, subtareas: (tareas || []).length })
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

  // ============== 1b) Subtarea individual: crear o marcar terminada =====
  if (body.accion === 'crear_subtarea' || body.accion === 'actualizar_subtarea') {
    const auth = req.headers.get('Authorization') || ''
    if (!auth) return json({ error: 'Falta Authorization' }, 401)
    const userClient = createClient(SB_URL, SB_SERVICE_KEY, { global: { headers: { Authorization: auth } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'No autenticado' }, 401)

    const { data: tarea, error: eTar } = await service.from('tareas_taller')
      .select('*, trabajos_taller(clickup_task_id)').eq('id', body.tarea_id).single()
    if (eTar || !tarea) return json({ error: 'Tarea no encontrada' }, 404)
    const clickupTrabajoId = tarea.trabajos_taller?.clickup_task_id
    if (!clickupTrabajoId) return json({ ok: true, ignorado: 'trabajo sin tarjeta en ClickUp' })

    if (body.accion === 'crear_subtarea' || !tarea.clickup_subtask_id) {
      const resp = await fetch(`${CLICKUP_API}/list/${CLICKUP_LIST_ID}/task`, {
        method: 'POST', headers: await cuHeaders(),
        body: JSON.stringify({ name: tarea.titulo, parent: clickupTrabajoId })
      })
      const cuSub = await resp.json()
      if (!resp.ok) { console.error('ClickUp crear subtarea falló:', JSON.stringify(cuSub)); return json({ error: 'ClickUp: ' + JSON.stringify(cuSub) }, 400) }
      await service.from('tareas_taller').update({ clickup_subtask_id: cuSub.id }).eq('id', tarea.id)
      return json({ ok: true, clickup_subtask_id: cuSub.id })
    }

    // actualizar_subtarea: refleja el estado (terminada -> complete)
    const resp = await fetch(`${CLICKUP_API}/task/${tarea.clickup_subtask_id}`, {
      method: 'PUT', headers: await cuHeaders(),
      body: JSON.stringify({ status: tarea.estado === 'terminada' ? 'complete' : 'por designar' })
    })
    if (!resp.ok) { const errBody = await resp.json(); console.error('ClickUp actualizar subtarea falló:', JSON.stringify(errBody)); return json({ error: 'ClickUp: ' + JSON.stringify(errBody) }, 400) }
    return json({ ok: true })
  }

  // ============== 2) DESDE CLICKUP: webhook de cambios ================
  if (body.event && body.task_id) {
    // v48.1 (SEGURIDAD): ningún evento se procesa sin firma válida.
    // Antes esta rama escribía en trabajos_taller con service role sin
    // verificar el origen. Si falta el secret se rechaza en vez de
    // "fallar abierto".
    if (!CLICKUP_WEBHOOK_SECRET) {
      console.error('CLICKUP_WEBHOOK_SECRET no está configurado — se rechaza el webhook.')
      return json({ error: 'Webhook no configurado (falta CLICKUP_WEBHOOK_SECRET).' }, 500)
    }
    const firma = req.headers.get('X-Signature') || req.headers.get('x-signature') || ''
    if (!(await firmaValida(rawBody, firma))) {
      console.error('Firma de webhook inválida — solicitud descartada. task_id:', body.task_id)
      return json({ error: 'Firma inválida' }, 401)
    }

    // v44: si es una subtarea que el propio CRM creó (MAN X PAUTA, etc.),
    // nunca debe tratarse como "tarea nueva sin vincular" — se identifica
    // primero contra tareas_taller antes de mirar la bandeja.
    const { data: tareaVinculada } = await service.from('tareas_taller')
      .select('id, estado').eq('clickup_subtask_id', body.task_id).maybeSingle()
    if (tareaVinculada) {
      let nuevoEstado: string | null = null
      for (const h of body.history_items || []) {
        if (h.field === 'status') {
          nuevoEstado = (h.after?.status || '').toLowerCase() === 'complete' ? 'terminada' : 'pendiente'
        }
      }
      if (nuevoEstado && nuevoEstado !== tareaVinculada.estado) {
        await service.from('tareas_taller').update({ estado: nuevoEstado }).eq('id', tareaVinculada.id)
      }
      return json({ ok: true, tarea_actualizada: nuevoEstado })
    }

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

      // Si viene con "parent", es una subtarea de algo que YA está vinculado
      // (recién creada por el CRM, el webhook llegó antes de que guardáramos
      // el clickup_subtask_id) — se ignora, no es una tarjeta nueva suelta.
      if (tarea.parent) return json({ ok: true, ignorado: 'es una subtarea (aún sincronizando)' })

      const patente = extraerPatente(tarea.name)

      // ---- AUTOVINCULACIÓN (v49) -------------------------------------------
      // Si el título trae una patente que identifica a UN solo vehículo de la
      // base, el vínculo es inequívoco y no necesita revisión humana: se crea
      // el trabajo de taller directamente.
      //
      // Las tres condiciones son necesarias. Sin ellas se vuelve al problema
      // original —crear datos a partir de texto ambiguo— que es justamente lo
      // que la bandeja existe para evitar:
      //   1. Hay patente extraíble del título.
      //   2. Esa patente existe en `vehiculos` y coincide con EXACTAMENTE uno.
      //   3. Ese vehículo NO tiene ya un trabajo de taller abierto.
      // Si alguna falla, la tarea cae en la bandeja como antes.
      if (patente) {
        const pnorm = patente.replace(/[^A-Z0-9]/g, '')

        // limit(2) a propósito: permite detectar la ambigüedad sin traer todo
        const { data: vehs } = await service.from('vehiculos')
          .select('id, cliente_id, marca, modelo, patente')
          .eq('patente_norm', pnorm).limit(2)

        if (vehs && vehs.length === 1) {
          const veh = vehs[0]

          const { data: abierto } = await service.from('trabajos_taller')
            .select('id, clickup_task_id')
            .eq('vehiculo_id', veh.id)
            .not('estado', 'in', '("entregado","cancelado")')
            .limit(1).maybeSingle()

          if (abierto && !abierto.clickup_task_id) {
            // Ya existe el trabajo en el CRM pero sin tarjeta espejo:
            // se enlazan en vez de duplicar.
            await service.from('trabajos_taller')
              .update({ clickup_task_id: body.task_id }).eq('id', abierto.id)
            return json({ ok: true, autovinculado: 'trabajo existente', trabajo_id: abierto.id })
          }

          if (!abierto) {
            const { data: nuevo, error: eIns } = await service.from('trabajos_taller').insert({
              empresa_id: EMPRESA_ID,
              vehiculo_id: veh.id,
              cliente_id: veh.cliente_id,
              titulo: tarea.name,
              observaciones_cliente: tarea.text_content || tarea.description || null,
              estado: ESTADO_CLICKUP_A_CRM[(tarea.status?.status || '').toLowerCase()] || 'en_reparacion',
              prioridad: PRIORIDAD_CLICKUP_A_CRM[Number(tarea.priority?.id)] || 'normal',
              fecha_limite: tarea.due_date ? new Date(Number(tarea.due_date)).toISOString().slice(0, 10) : null,
              clickup_task_id: body.task_id
            }).select('id').maybeSingle()

            if (!eIns && nuevo) {
              // Aviso al jefe de taller: el trabajo se creó solo, conviene que
              // alguien lo revise aunque el vínculo sea confiable.
              await service.from('notificaciones').insert({
                empresa_id: EMPRESA_ID,
                rol_destino: 'jefe_taller',
                titulo: `Trabajo vinculado automáticamente · ${veh.patente}`,
                cuerpo: `Tarea de ClickUp "${tarea.name}" se asoció al ${veh.marca || ''} ${veh.modelo || ''} (${veh.patente}). Revisar que corresponda.`,
                url: `/taller?trabajo=${nuevo.id}`
              })
              return json({ ok: true, autovinculado: 'trabajo creado', trabajo_id: nuevo.id, patente: veh.patente })
            }
            console.error('Autovinculación falló al insertar, se deriva a bandeja:', eIns?.message)
          }
          // Si el vehículo ya tiene un trabajo abierto CON tarjeta espejo, no se
          // toca: son dos tarjetas para el mismo vehículo y eso lo decide una
          // persona. Cae a la bandeja.
        }
      }

      // ---- Bandeja de revisión (comportamiento original) --------------------
      await service.from('clickup_tareas_pendientes').upsert({
        clickup_task_id: body.task_id, titulo: tarea.name,
        descripcion: tarea.text_content || tarea.description || null,
        patente_candidata: patente, estado: 'pendiente'
      }, { onConflict: 'clickup_task_id' })
      return json({ ok: true, registrado_en_bandeja: true })
    }

    const { data: t } = await service.from('trabajos_taller')
      .select('id, estado, prioridad, fecha_limite, progreso_clickup, sugerencias_clickup')
      .eq('clickup_task_id', body.task_id).maybeSingle()
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

    // v91: Progreso y Sugerencias. ClickUp calcula el progreso solo, a partir
    // de subtareas y listas de control, y NO lo manda en history_items: hay que
    // consultarlo. Se hace en cualquier evento, porque marcar una subtarea
    // cambia el porcentaje sin cambiar el estado de la tarjeta.
    try {
      const rt = await fetch(`https://api.clickup.com/api/v2/task/${body.task_id}`,
        { headers: { Authorization: CLICKUP_TOKEN } })
      if (rt.ok) {
        const tarea = await rt.json()
        const cf = (tarea.custom_fields || []) as Array<Record<string, any>>
        const prog = cf.find((f) => f.id === CAMPO_PROGRESO)
        const pct = prog?.value?.percent_complete
        if (typeof pct === 'number') campos.progreso_clickup = Math.round(pct)
        const sug = cf.find((f) => f.id === CAMPO_SUGERENCIAS)?.value
        if (typeof sug === 'string' && sug.trim()) campos.sugerencias_clickup = sug.trim()
      }
    } catch (e) {
      // El progreso es informativo: si no se puede leer, el resto igual se aplica.
      console.error('No se pudo leer el progreso de ClickUp:', (e as Error).message)
    }
    // v48.1: guard anti-eco. El CRM empuja un cambio → ClickUp dispara el
    // webhook de vuelta → antes se reescribía el mismo valor en la base
    // (escrituras redundantes y riesgo de rebote). Solo se escriben los
    // campos que realmente difieren del valor actual.
    for (const k of Object.keys(campos)) {
      if (campos[k] === (t as Record<string, unknown>)[k]) delete campos[k]
    }
    if (Object.keys(campos).length) {
      await service.from('trabajos_taller').update(campos).eq('id', t.id)
      return json({ ok: true, actualizado: campos })
    }
    return json({ ok: true, ignorado: 'sin cambios reales (eco del propio CRM)' })
  }

  return json({ error: 'Solicitud no reconocida' }, 400)
})

// =======================================================================
// INSTRUCCIONES DE DESPLIEGUE (una sola vez)
// =======================================================================
// ORDEN OBLIGATORIO: primero el webhook (para obtener el secret), después
// los secrets, y al final el deploy. Si se despliega esta versión sin el
// secret, el webhook queda rechazando todo con 401 (a propósito).
//
// 1. Registrar el webhook con scripts/registrar_webhook.ps1
//    (PowerShell nativo — evita los problemas de comillas de curl.exe en
//    Windows). El script borra el webhook anterior, crea el nuevo con los
//    4 eventos y muestra el SECRET.
//    Eventos: taskCreated, taskStatusUpdated, taskPriorityUpdated,
//             taskDueDateUpdated
//
// 2. Secrets (Supabase → Project Settings → Edge Functions → Secrets):
//      CLICKUP_API_TOKEN      = token personal (ClickUp → Settings → Apps)
//      CLICKUP_LIST_ID        = 901324296305
//      CLICKUP_WEBHOOK_SECRET = el secret que mostró el script del paso 1
//      SB_PROJECT_URL         = https://ehpstxrzsjwcevcafxgk.supabase.co
//      SB_SERVICE_KEY         = service role / secret key
//
// 3. Desplegar: supabase functions deploy clickup-sync
//    (Verify JWT debe seguir en OFF: la función valida por su cuenta —
//     JWT de usuario en la rama del CRM, firma HMAC en la del webhook.)
//
// 4. Probar: cambiar el estado de una tarjeta en ClickUp y verificar en
//    los logs que dice "actualizado", no "Firma inválida".
// =======================================================================
