import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Pill, Modal } from '../components/UI'
import { SEGMENTOS, VENTANAS, segLabel } from '../lib/helpers'

const ESTADO_COLOR = {
  borrador: '#73726c', activa: '#1D9E75', pausada: '#C98A1B', completada: '#185FA5'
}
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
    const { data } = await supabase.from('campanas').select('*').order('prioridad')
    setCampanas(data || [])
  }

  async function abrir(c) {
    setSel(c); setResultadoEnvio('')
    let q = supabase.from('clientes').select('id,nombre,telefono,segmento,vendedor_id,creado_en')
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

  // Crea tareas pendientes (actividades) para cada cliente del segmento,
  // asignadas a su vendedor y etiquetadas con la campaña. Evita duplicar.
  async function cargarAAsesores() {
    if (!coincidencias.length) { setResultadoEnvio('No hay clientes en este segmento.'); return }
    if (!confirm(`Se generarán tareas de seguimiento para ${coincidencias.length} cliente(s), asignadas a su vendedor. ¿Continuar?`)) return
    setCargandoAsesores(true); setResultadoEnvio('')

    // Clientes que ya tienen una tarea de esta campaña (para no duplicar)
    const ids = coincidencias.map((c) => c.id)
    const { data: existentes } = await supabase.from('actividades')
      .select('cliente_id').eq('campana_id', sel.id).in('cliente_id', ids)
    const yaCargados = new Set((existentes || []).map((a) => a.cliente_id))

    const hoy = new Date().toISOString().slice(0, 10)
    const tipo = CANAL_A_TIPO[sel.canal] || 'llamada'
    const filas = coincidencias
      .filter((c) => !yaCargados.has(c.id))
      .map((c) => ({
        empresa_id: perfil.empresa_id, cliente_id: c.id, vendedor_id: c.vendedor_id || null,
        tipo, resultado: 'pendiente', fecha: hoy, proxima_fecha: hoy,
        campana_id: sel.id, proxima_accion: `Campaña: ${sel.nombre}`,
        descripcion: sel.mensaje_plantilla || ''
      }))

    if (!filas.length) { setCargandoAsesores(false); setResultadoEnvio('Todos los clientes ya tenían tarea de esta campaña.'); return }
    const { error } = await supabase.from('actividades').insert(filas)
    setCargandoAsesores(false)
    if (error) { setResultadoEnvio('Error: ' + error.message); return }
    if (sel.estado !== 'activa') await cambiarEstado(sel.id, 'activa')
    setResultadoEnvio(`Listo: ${filas.length} tarea(s) cargada(s) a los asesores (visibles en su Calendario y Pipeline).`)
  }

  async function enviarEmail() {
    if (!confirm('¿Enviar esta campaña por email a los clientes del segmento con correo registrado?')) return
    setEnviando(true); setResultadoEnvio('')
    const { data, error } = await supabase.functions.invoke('enviar-campana', { body: { campana_id: sel.id } })
    setEnviando(false)
    if (error || data?.error) {
      setResultadoEnvio('Error: ' + (data?.error || error.message) +
        '. Verifica que la función y la clave de Brevo estén configuradas.')
      return
    }
    setResultadoEnvio(`Enviados: ${data.enviados} de ${data.total || data.enviados} correos.`)
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
              <Pill color={ESTADO_COLOR[c.estado]}>{c.estado}</Pill>
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
              <Pill color={ESTADO_COLOR[sel.estado]}>{sel.estado}</Pill>
            </div>

            <div>
              <div className="label">Mensaje plantilla</div>
              <div className="rounded-lg bg-paper p-3 text-sm text-slate-700 whitespace-pre-wrap">{sel.mensaje_plantilla}</div>
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
                {sel.estado !== 'activa' && (
                  <button className="btn-primary" onClick={() => cambiarEstado(sel.id, 'activa')}>Activar</button>
                )}
                {sel.estado === 'activa' && (
                  <button className="btn-primary" onClick={() => cambiarEstado(sel.id, 'pausada')}>Pausar</button>
                )}
              </div>
            )}

            {resultadoEnvio && (
              <div className="rounded-lg bg-sky/10 px-3 py-2 text-sm text-deep">{resultadoEnvio}</div>
            )}

            <p className="text-[11px] text-slate-400">
              "Cargar a asesores" genera una tarea de seguimiento por cliente, asignada a su vendedor y visible en su Calendario y Pipeline.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
