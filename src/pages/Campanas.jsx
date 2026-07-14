import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Pill, Modal } from '../components/UI'
import { SEGMENTOS, VENTANAS, segLabel, ESTADOS_CAMPANA, estadoCampanaLabel, estadoCampanaColor } from '../lib/helpers'

const ESTADO_COLOR = Object.fromEntries(Object.entries(ESTADOS_CAMPANA).map(([k, v]) => [k, v.color]))
const CANALES = { whatsapp: 'WhatsApp', llamada: 'Llamada', email: 'Email', sms: 'SMS' }
// Canal de campaña -> tipo_actividad válido del enum
const CANAL_A_TIPO = { whatsapp: 'whatsapp', llamada: 'llamada', email: 'email', sms: 'llamada' }

export default function Campanas() {
  const { esAdmin, perfil } = useAuth()
  const [campanas, setCampanas] = useState([])
  const [sel, setSel] = useState(null)
  const [coincidencias, setCoincidencias] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [cargandoAsesores, setCargandoAsesores] = useState(false)
  const [asesores, setAsesores] = useState([])
  const [asesorDestino, setAsesorDestino] = useState('cartera')  // 'cartera' | <id de asesor>
  const [modalNueva, setModalNueva] = useState(false)
  const NUEVA = { nombre: '', descripcion: '', fecha_desde: '', fecha_hasta: '',
                  tipo_servicio: 'todos', min_visitas: '', monto_min: '', canal: 'tareas', asunto: '' }
  const [fN, setFN] = useState(NUEVA)

  // v29: creador de campañas personalizadas — criterios simples que la
  // función audiencia_campana resuelve en vivo contra el historial.
  async function crearCampana(e) {
    e.preventDefault()
    if (!fN.nombre.trim()) return
    if (!fN.fecha_desde || !fN.fecha_hasta) return alert('Define el rango de fechas del último servicio (desde / hasta).')
    const criterio = {
      tipo: 'personalizada', canal: fN.canal,
      fecha_desde: fN.fecha_desde, fecha_hasta: fN.fecha_hasta,
      tipo_servicio: fN.tipo_servicio
    }
    if (+fN.min_visitas > 0) criterio.min_visitas = +fN.min_visitas
    if (+fN.monto_min > 0) criterio.monto_min = +fN.monto_min

    const fila = {
      empresa_id: perfil.empresa_id, nombre: fN.nombre.trim(),
      descripcion: fN.descripcion.trim() || null, estado: 'activa',
      prioridad: 50, canal: null, criterio
    }
    if (fN.canal === 'email') {
      fila.asunto = fN.asunto.trim() || fN.nombre.trim()
      // plantilla genérica: reutiliza la de fidelización (logo, slogan y
      // personalización {nombre}/{vehiculo}/{servicio} incluidos)
      const { data: pl } = await supabase.from('campanas').select('mensaje_plantilla')
        .eq('empresa_id', perfil.empresa_id).eq('criterio->>tipo', 'fidelizacion_reparacion').limit(1).maybeSingle()
      if (pl?.mensaje_plantilla) fila.mensaje_plantilla = pl.mensaje_plantilla
    }
    const { error } = await supabase.from('campanas').insert(fila)
    if (error) return alert('Error: ' + error.message + '\n(¿Ejecutaste la migración 34?)')
    setModalNueva(false); setFN(NUEVA); cargar()
    setResultadoEnvio(fN.canal === 'email'
      ? '✓ Campaña creada. La encuentras en Email marketing → Campañas para revisar audiencia y enviar.'
      : '✓ Campaña creada y activa. Selecciónala para ver su audiencia y usar "Cargar a asesores".')
  }
  const [resultadoEnvio, setResultadoEnvio] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    supabase.from('usuarios').select('id,nombre')
      .in('rol', ['vendedor', 'asesor_toyota', 'asesor_multimarca']).eq('activo', true).order('nombre')
      .then(({ data }) => setAsesores(data || []))
    // v23/v29: aquí viven las campañas comerciales y las personalizadas de
    // canal TAREAS; las de email (con criterio de envío) están en Email marketing
    const { data } = await supabase.from('campanas').select('*')
      .or('criterio.is.null,criterio->>canal.eq.tareas').order('prioridad')
    setCampanas(data || [])
  }

  async function abrir(c) {
    setSel(c); setResultadoEnvio(''); setCoincidencias([])
    setAsesorDestino('cartera')  // v38: evita arrastrar el destino elegido en otra campaña
    // v22: las campañas de email con criterio calculan su audiencia desde el
    // historial real de servicios (función audiencia_campana)
    if (c.criterio) {
      const { data, error } = await supabase.rpc('audiencia_campana', { p_campana: c.id })
      if (error) { setResultadoEnvio('Error calculando audiencia: ' + error.message); return }
      // trae vendedor_id para poder asignar tareas (en lotes: sin límite de 1000)
      const ids = (data || []).map((x) => x.cliente_id)
      let vend = {}
      for (let i = 0; i < ids.length; i += 1000) {
        const { data: cl } = await supabase.from('clientes').select('id,vendedor_id').in('id', ids.slice(i, i + 1000))
        ;(cl || []).forEach((x) => { vend[x.id] = x.vendedor_id })
      }
      setCoincidencias((data || []).map((x) => ({
        id: x.cliente_id, nombre: [x.nombre, x.apellidos].filter(Boolean).join(' '),
        telefono: x.telefono, email: x.email, vendedor_id: vend[x.cliente_id] || null,
        ultima_visita: x.ultima_visita
      })))
      return
    }
    let q = supabase.from('clientes').select('id,nombre,apellidos,telefono,segmento,vendedor_id,creado_en')
    if (c.segmento) q = q.eq('segmento', c.segmento)
    if (c.dias_recientes) {
      const desde = new Date(Date.now() - c.dias_recientes * 864e5).toISOString()
      q = q.gte('creado_en', desde).order('creado_en', { ascending: false })
    }
    const { data } = await q.limit(500)
    setCoincidencias(data || [])
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('campanas').update({ estado }).eq('id', id)
    cargar(); if (sel?.id === id) setSel({ ...sel, estado })
  }

  // v22: crea TAREAS DE CAMPAÑA (tabla tareas_campana) asignadas al
  // vendedor de cada cliente. Ya NO se insertan actividades: el calendario
  // solo recibe los agendamientos que el asesor haga al trabajar su tarea,
  // y las gestiones quedan solo con lo registrado efectivamente por él.
  async function cargarAAsesores() {
    if (sel.estado !== 'activa') {
      setResultadoEnvio('Solo las campañas activas pueden asignar clientes. Activa la campaña primero.')
      return
    }
    if (!coincidencias.length) { setResultadoEnvio('No hay clientes que coincidan con esta campaña.'); return }
    const destinoNombre = asesorDestino === 'cartera'
      ? 'el vendedor de la cartera de cada cliente'
      : (asesores.find((a) => a.id === asesorDestino)?.nombre || 'el asesor elegido')
    if (!confirm(`Se asignarán ${coincidencias.length} tarea(s) de campaña a ${destinoNombre}. ¿Continuar?`)) return
    setCargandoAsesores(true); setResultadoEnvio('')

    // v37: se separan las tareas NUEVAS (se insertan) de las que YA
    // existen para esta campaña. Antes, un re-ingreso con un asesor
    // específico no reasignaba nada porque el upsert ignoraba duplicados
    // silenciosamente. Ahora, si se eligió un asesor puntual (no
    // "cartera"), las existentes se REASIGNAN explícitamente a ese
    // asesor (sin tocar su estado/comentario ya trabajado).
    const idsCliente = coincidencias.map((c) => c.id)
    const { data: existentes } = await supabase.from('tareas_campana')
      .select('id,cliente_id').eq('campana_id', sel.id).in('cliente_id', idsCliente)
    const idsExistentes = new Set((existentes || []).map((e) => e.cliente_id))

    const nuevas = coincidencias.filter((c) => !idsExistentes.has(c.id)).map((c) => ({
      empresa_id: perfil.empresa_id, campana_id: sel.id, cliente_id: c.id,
      vendedor_id: asesorDestino === 'cartera' ? (c.vendedor_id || null) : asesorDestino,
      canal: sel.canal || null, estado: 'pendiente'
    }))
    let error = null
    if (nuevas.length) {
      ({ error } = await supabase.from('tareas_campana')
        .upsert(nuevas, { onConflict: 'campana_id,cliente_id', ignoreDuplicates: true }))
    }
    let reasignadas = 0
    if (!error && asesorDestino !== 'cartera' && existentes?.length) {
      const { error: eReasig } = await supabase.from('tareas_campana')
        .update({ vendedor_id: asesorDestino })
        .eq('campana_id', sel.id).in('cliente_id', [...idsExistentes])
      error = eReasig
      reasignadas = existentes.length
    }

    setCargandoAsesores(false)
    if (error) { setResultadoEnvio('Error: ' + error.message); return }
    const sinVend = asesorDestino === 'cartera' ? nuevas.filter((f) => !f.vendedor_id).length : 0
    setResultadoEnvio(`Listo: ${nuevas.length} tarea(s) nueva(s) asignada(s) a ${destinoNombre}` +
      (reasignadas ? ` · ${reasignadas} ya existente(s) reasignada(s) a ${destinoNombre}` : '') +
      `. Se ven en Clientes → pestaña Tareas.` +
      (sinVend ? ` ${sinVend} cliente(s) sin vendedor quedaron sin asignar: reasígnalos o vuelve a cargar eligiendo un asesor.` : ''))
  }

  async function enviarEmail() {
    if (sel.estado !== 'activa') {
      setResultadoEnvio('Solo las campañas activas pueden enviar emails. Activa la campaña primero.')
      return
    }
    if (!confirm('¿Enviar esta campaña por email a los clientes del segmento con correo registrado?')) return
    setEnviando(true); setResultadoEnvio('')
    const { data, error } = await supabase.functions.invoke('enviar-email', {
      body: {
        asunto: sel.asunto || sel.nombre,
        cuerpo: sel.mensaje_plantilla || '',
        es_html: /<[a-z][\s\S]*>/i.test(sel.mensaje_plantilla || ''),
        cliente_ids: sel.criterio ? coincidencias.map((c) => c.id) : null,
        segmento: sel.segmento || null,
        dias_recientes: sel.dias_recientes || null,
        campana_id: sel.id
      }
    })
    setEnviando(false)
    if (error || data?.error) {
      setResultadoEnvio('Error: ' + (data?.error || error.message) +
        '. Verifica que la función enviar-email y la clave de Brevo estén configuradas.')
      return
    }
    setResultadoEnvio(`Enviados: ${data.enviados} de ${data.total || data.enviados} correos. Su resultado (aperturas, clics) se mide en Email marketing → Reportes.`)
    cargar()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-ink">Campañas</h1>
          <p className="text-sm text-slate-500">Oportunidades por segmento y campañas personalizadas · ordenadas por prioridad</p>
        </div>
        <button className="btn-primary" onClick={() => { setFN(NUEVA); setModalNueva(true) }}>➕ Nueva campaña</button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {campanas.map((c) => (
          <div key={c.id} className="card p-5 hover:border-sky cursor-pointer" onClick={() => abrir(c)}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-deep text-white text-xs grid place-items-center font-medium">{c.prioridad}</span>
                <h3 className="font-semibold text-ink text-sm">{c.nombre}</h3>
              </div>
              <Pill color={ESTADO_COLOR[c.estado]}>{estadoCampanaLabel(c.estado)}</Pill>
            </div>
            <p className="text-xs text-slate-500 mt-2">{c.descripcion}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {c.segmento && <span className="text-[11px] text-slate-400">{segLabel(c.segmento)}</span>}
              {c.criterio?.tipo === 'personalizada' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-deep/10 text-deep">
                  Personalizada · {c.criterio.fecha_desde?.split('-').reverse().join('-')} → {c.criterio.fecha_hasta?.split('-').reverse().join('-')}
                </span>
              )}
              {c.ventana && <span className="text-[11px] text-slate-400">· {VENTANAS[c.ventana]?.label}</span>}
              <span className="text-[11px] text-slate-400">· {CANALES[c.canal]}</span>
            </div>
          </div>
        ))}
      </div>

      <Modal abierto={!!sel} onClose={() => { setSel(null); setResultadoEnvio('') }} titulo={sel?.nombre} ancho="max-w-2xl">
        {sel && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              {sel.segmento && <Pill color={SEGMENTOS[sel.segmento]?.color}>{segLabel(sel.segmento)}</Pill>}
              {sel.ventana && <Pill color={VENTANAS[sel.ventana]?.color}>{VENTANAS[sel.ventana]?.label}</Pill>}
              <span className="pill bg-mist text-deep">{CANALES[sel.canal]}</span>
              <Pill color={ESTADO_COLOR[sel.estado]}>{estadoCampanaLabel(sel.estado)}</Pill>
            </div>

            <div>
              <div className="label">Mensaje plantilla</div>
              {sel.asunto && <div className="text-xs text-slate-500 mb-1"><b>Asunto:</b> {sel.asunto}</div>}
              {/<[a-z][\s\S]*>/i.test(sel.mensaje_plantilla || '')
                ? <div className="rounded-lg border border-slate-200 overflow-hidden max-h-96 overflow-y-auto"
                       dangerouslySetInnerHTML={{ __html: sel.mensaje_plantilla }} />
                : <div className="rounded-lg bg-paper p-3 text-sm text-slate-700 whitespace-pre-wrap">{sel.mensaje_plantilla}</div>}
            </div>

            <div>
              <div className="label">Clientes que coinciden ({coincidencias.length})</div>
              <div className="max-h-48 overflow-y-auto card divide-y divide-slate-100">
                {coincidencias.length ? coincidencias.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-ink">{c.nombre}</span>
                    <span className="text-xs text-slate-400">{c.telefono || '—'}</span>
                  </div>
                )) : <div className="px-3 py-4 text-sm text-slate-400 text-center">Sin clientes en este segmento todavía.</div>}
              </div>
            </div>

            {esAdmin && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs text-slate-500">Asignar a:</label>
                  <select className="input w-auto text-sm py-1.5" value={asesorDestino}
                          onChange={(e) => setAsesorDestino(e.target.value)}>
                    <option value="cartera">Vendedor de cada cliente (cartera)</option>
                    <optgroup label="— Asignar todo a un asesor —">
                      {asesores.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </optgroup>
                  </select>
                  <span className="text-[11px] text-slate-400">
                    {asesorDestino === 'cartera'
                      ? 'Clientes nuevos → quien subió la OT; antiguos sin vendedor quedan sin asignar.'
                      : 'Toda la audiencia irá a este asesor.'}
                  </span>
                </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button className="btn-soft" onClick={cargarAAsesores} disabled={cargandoAsesores}>
                  {cargandoAsesores ? 'Cargando…' : 'Cargar a asesores'}
                </button>
                {sel.canal === 'email' && (
                  <button className="btn-soft" onClick={enviarEmail} disabled={enviando}>
                    {enviando ? 'Enviando…' : 'Enviar por email (Brevo)'}
                  </button>
                )}
                {['borrador', 'pausada', 'finalizada', 'completada'].includes(sel.estado) && (
                  <button className="btn-primary" onClick={() => cambiarEstado(sel.id, 'activa')}>Activar</button>
                )}
                {sel.estado === 'activa' && (
                  <button className="btn-soft" onClick={() => cambiarEstado(sel.id, 'pausada')}>Pausar</button>
                )}
                {['activa', 'pausada'].includes(sel.estado) && (
                  <button className="btn-soft" onClick={() => cambiarEstado(sel.id, 'finalizada')}>Finalizar</button>
                )}
                {sel.estado !== 'archivada' && (
                  <button className="btn-soft text-slate-500" onClick={() => cambiarEstado(sel.id, 'archivada')}>Archivar</button>
                )}
              </div>
              </div>
            )}

            {resultadoEnvio && (
              <div className="rounded-lg bg-sky/10 px-3 py-2 text-sm text-deep">{resultadoEnvio}</div>
            )}

            <p className="text-[11px] text-slate-400">
              "Cargar a asesores" asigna una tarea de campaña por cliente a su vendedor (Clientes → Tareas). El calendario solo recibe los agendamientos que el asesor cree al gestionarla. "Enviar email" envía la plantilla a toda la audiencia con correo.
            </p>
          </div>
        )}
      </Modal>

      {/* v29 · Constructor de campañas personalizadas */}
      <Modal abierto={modalNueva} onClose={() => setModalNueva(false)} titulo="Nueva campaña personalizada">
        <form onSubmit={crearCampana} className="space-y-3">
          <div>
            <label className="label">Nombre *</label>
            <input className="input" required value={fN.nombre} placeholder="Ej: Fidelización servicios de agosto"
                   onChange={(e) => setFN({ ...fN, nombre: e.target.value })} />
          </div>
          <div>
            <label className="label">Descripción / guion para el asesor</label>
            <textarea className="input" rows="2" value={fN.descripcion}
                      placeholder="Qué debe lograr el contacto: ¿cómo respondió el vehículo?, ¿quedó conforme?…"
                      onChange={(e) => setFN({ ...fN, descripcion: e.target.value })} />
          </div>
          <div className="rounded-lg bg-paper p-3 space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase">Audiencia · clientes con servicio en el rango</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Servicio desde *</label>
                <input className="input" type="date" required value={fN.fecha_desde}
                       onChange={(e) => setFN({ ...fN, fecha_desde: e.target.value })} />
              </div>
              <div>
                <label className="label">Servicio hasta *</label>
                <input className="input" type="date" required value={fN.fecha_hasta}
                       onChange={(e) => setFN({ ...fN, fecha_hasta: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Tipo de servicio</label>
                <select className="input" value={fN.tipo_servicio} onChange={(e) => setFN({ ...fN, tipo_servicio: e.target.value })}>
                  <option value="todos">Todos</option>
                  <option value="mantencion">Solo mantenciones</option>
                  <option value="reparacion">Solo reparaciones</option>
                </select>
              </div>
              <div>
                <label className="label">Visitas mín. (hist.)</label>
                <input className="input" type="number" min="0" value={fN.min_visitas} placeholder="—"
                       onChange={(e) => setFN({ ...fN, min_visitas: e.target.value })} />
              </div>
              <div>
                <label className="label">Monto mín. (hist.)</label>
                <input className="input" type="number" min="0" value={fN.monto_min} placeholder="—"
                       onChange={(e) => setFN({ ...fN, monto_min: e.target.value })} />
              </div>
            </div>
          </div>
          <div>
            <label className="label">Canal</label>
            <select className="input" value={fN.canal} onChange={(e) => setFN({ ...fN, canal: e.target.value })}>
              <option value="tareas">Tareas para asesores (llamada / WhatsApp personal)</option>
              <option value="email">Email masivo (usa la plantilla genérica de fidelización)</option>
            </select>
          </div>
          {fN.canal === 'email' && (
            <div>
              <label className="label">Asunto del email</label>
              <input className="input" value={fN.asunto} placeholder="Ej: {nombre}, ¿cómo ha andado tu {vehiculo}?"
                     onChange={(e) => setFN({ ...fN, asunto: e.target.value })} />
              <p className="text-[10px] text-slate-400 mt-0.5">La campaña quedará en Email marketing → Campañas para revisar la audiencia y enviar. El cuerpo usa la plantilla de fidelización con {'{nombre}'}, {'{vehiculo}'} y {'{servicio}'} personalizados.</p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-soft" onClick={() => setModalNueva(false)}>Cancelar</button>
            <button className="btn-primary">Crear campaña</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
