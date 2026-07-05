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
  const [resultadoEnvio, setResultadoEnvio] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    // v23: las campañas de email (con criterio) viven en Email marketing
    const { data } = await supabase.from('campanas').select('*').is('criterio', null).order('prioridad')
    setCampanas(data || [])
  }

  async function abrir(c) {
    setSel(c); setResultadoEnvio(''); setCoincidencias([])
    // v22: las campañas de email con criterio calculan su audiencia desde el
    // historial real de servicios (función audiencia_campana)
    if (c.criterio) {
      const { data, error } = await supabase.rpc('audiencia_campana', { p_campana: c.id })
      if (error) { setResultadoEnvio('Error calculando audiencia: ' + error.message); return }
      // trae vendedor_id para poder asignar tareas
      const ids = (data || []).map((x) => x.cliente_id)
      let vend = {}
      if (ids.length) {
        const { data: cl } = await supabase.from('clientes').select('id,vendedor_id').in('id', ids.slice(0, 1000))
        vend = Object.fromEntries((cl || []).map((x) => [x.id, x.vendedor_id]))
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
    if (!confirm(`Se asignarán ${coincidencias.length} tarea(s) de campaña a los vendedores según su cartera. ¿Continuar?`)) return
    setCargandoAsesores(true); setResultadoEnvio('')
    const filas = coincidencias.map((c) => ({
      empresa_id: perfil.empresa_id, campana_id: sel.id, cliente_id: c.id,
      vendedor_id: c.vendedor_id || null, canal: sel.canal || null, estado: 'pendiente'
    }))
    const { error } = await supabase.from('tareas_campana')
      .upsert(filas, { onConflict: 'campana_id,cliente_id', ignoreDuplicates: true })
    setCargandoAsesores(false)
    if (error) { setResultadoEnvio('Error: ' + error.message); return }
    setResultadoEnvio(`Listo: ${filas.length} tarea(s) asignada(s). Cada vendedor las ve en Clientes → pestaña Tareas (los clientes sin vendedor quedan para que administración los reasigne).`)
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
      <div>
        <h1 className="text-xl font-bold text-ink">Campañas</h1>
        <p className="text-sm text-slate-500">Oportunidades por segmento · ordenadas por prioridad</p>
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
              <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100">
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
    </div>
  )
}
