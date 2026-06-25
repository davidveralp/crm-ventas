import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Pill, Modal } from '../components/UI'
import { SEGMENTOS, VENTANAS, segLabel } from '../lib/helpers'

const ESTADO_COLOR = {
  borrador: '#73726c', activa: '#1D9E75', pausada: '#C98A1B', completada: '#185FA5'
}
const CANALES = { whatsapp: 'WhatsApp', llamada: 'Llamada', email: 'Email', sms: 'SMS' }

export default function Campanas() {
  const { esAdmin } = useAuth()
  const [campanas, setCampanas] = useState([])
  const [sel, setSel] = useState(null)
  const [coincidencias, setCoincidencias] = useState([])

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data } = await supabase.from('campanas').select('*').order('prioridad')
    setCampanas(data || [])
  }

  async function abrir(c) {
    setSel(c)
    let q = supabase.from('clientes').select('id,nombre,telefono,segmento,creado_en')
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink">Campañas</h1>
        <p className="text-sm text-slate-500">
          Basadas en tu Plan Maestro · ordenadas por prioridad de ejecución
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {campanas.map((c) => (
          <div key={c.id} className="card p-5 hover:border-sky cursor-pointer"
               onClick={() => abrir(c)}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-deep text-white text-xs grid place-items-center font-medium">
                  {c.prioridad}
                </span>
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

      <Modal abierto={!!sel} onClose={() => setSel(null)} titulo={sel?.nombre} ancho="max-w-2xl">
        {sel && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {sel.segmento && <Pill color={SEGMENTOS[sel.segmento]?.color}>{segLabel(sel.segmento)}</Pill>}
              {sel.ventana && <Pill color={VENTANAS[sel.ventana]?.color}>{VENTANAS[sel.ventana]?.label}</Pill>}
              <span className="pill bg-mist text-deep">{CANALES[sel.canal]}</span>
            </div>

            <div>
              <div className="label">Mensaje plantilla</div>
              <div className="rounded-lg bg-paper p-3 text-sm text-slate-700 whitespace-pre-wrap">
                {sel.mensaje_plantilla}
              </div>
            </div>

            <div>
              <div className="label">Clientes que coinciden ({coincidencias.length})</div>
              <div className="max-h-48 overflow-y-auto card divide-y divide-slate-100">
                {coincidencias.length ? coincidencias.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-ink">{c.nombre}</span>
                    <span className="text-xs text-slate-400">{c.telefono || '—'}</span>
                  </div>
                )) : <div className="px-3 py-4 text-sm text-slate-400 text-center">
                  Sin clientes en este segmento todavía.
                </div>}
              </div>
            </div>

            {esAdmin && (
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                {sel.estado !== 'activa' && (
                  <button className="btn-primary" onClick={() => cambiarEstado(sel.id, 'activa')}>
                    Activar campaña
                  </button>
                )}
                {sel.estado === 'activa' && (
                  <button className="btn-soft" onClick={() => cambiarEstado(sel.id, 'pausada')}>
                    Pausar
                  </button>
                )}
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              El envío automático por WhatsApp / Email / SMS se conecta en la Fase 2 (Brevo + Twilio).
              Por ahora la campaña organiza a quién contactar y con qué mensaje.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
