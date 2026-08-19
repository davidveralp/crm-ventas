import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmtCLP, formatPatente } from '../lib/helpers'

/* ============================================================================
   Solicitar presupuesto desde la ficha del vehículo
   ----------------------------------------------------------------------------
   Flujo (confirmado con David):
     El ASESOR describe qué necesita el cliente.
     El COORDINADOR DE ADQUISICIONES valoriza y lo envía.

   Es el mismo circuito que ya opera en taller, pero sin exigir que el vehículo
   esté ingresado. Cubre tres casos que antes no tenían salida: el cliente que
   llama a preguntar, el seguimiento de una alerta RADAR de una visita anterior,
   y la cotización preventiva.
   ========================================================================== */

const SEV = {
  critico: { label: 'Crítico', color: '#e0382b', bg: '#fdecea' },
  pronto:  { label: 'Atender', color: '#b8860b', bg: '#fdf6e3' }
}

export default function SolicitarPresupuesto({ vehiculo, onCerrar, onCreado }) {
  const { perfil } = useAuth()
  const [solicitud, setSolicitud] = useState('')
  const [sugeridos, setSugeridos] = useState([])
  const [elegidos, setElegidos] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => { cargarSugeridos() }, []) // eslint-disable-line

  async function cargarSugeridos() {
    // Alertas vigentes del RADAR: son candidatas naturales a cotizar
    const { data } = await supabase.from('v_radar_alertas')
      .select('*').eq('vehiculo_id', vehiculo.id)
      .order('iniciada_en', { ascending: false }).order('categoria_orden')
    if (!data?.length) return
    const ultima = data[0].inspeccion_id
    setSugeridos(data.filter((a) => a.inspeccion_id === ultima))
  }

  const toggle = (cod) => setElegidos((e) => ({ ...e, [cod]: !e[cod] }))

  async function enviar() {
    const seleccion = sugeridos.filter((s) => elegidos[s.criterio_codigo])
    if (!solicitud.trim() && !seleccion.length) {
      setErrMsg('Describe qué necesita el cliente, o marca al menos una alerta a cotizar.')
      return
    }
    setGuardando(true); setErrMsg('')
    try {
      // Los ítems nacen sin precio: el coordinador es quien valoriza.
      const items = seleccion.map((s) => ({
        tipo: 'repuesto', codigo: '',
        detalle: `${s.categoria} · ${s.criterio}` + (s.observacion ? ` (${s.observacion})` : ''),
        cant: 1, costo: 0, precio: 0, en_stock: null, severidad: s.severidad
      }))

      const { data: pres, error } = await supabase.from('presupuestos_taller').insert({
        empresa_id: perfil.empresa_id,
        vehiculo_id: vehiculo.id,
        cliente_id: vehiculo.cliente_id,
        trabajo_id: null,
        estado: 'solicitado',
        origen: seleccion.length ? 'radar' : 'vehiculo',
        solicitud: solicitud.trim() || null,
        items,
        solicitado_por: perfil.id
      }).select('id').maybeSingle()
      if (error) throw error

      // El coordinador tiene que enterarse: sin esto la solicitud queda perdida.
      await supabase.from('notificaciones').insert({
        empresa_id: perfil.empresa_id,
        rol_destino: 'coordinador_adquisiciones',
        titulo: `Cotizar · ${vehiculo.patente ? formatPatente(vehiculo.patente) : 'vehículo'}`,
        cuerpo: `${[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ')} · ` +
                (solicitud.trim() || `${seleccion.length} alerta(s) de RADAR`),
        url: '/presupuestos'
      })

      onCreado?.(pres?.id)
    } catch (e) {
      setErrMsg(e.message || String(e))
    }
    setGuardando(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-slate-200 sticky top-0 bg-white">
          <h3 className="font-semibold text-ink">Solicitar presupuesto</h3>
          <p className="text-xs text-slate-400">
            {vehiculo.patente ? formatPatente(vehiculo.patente) : ''} ·{' '}
            {[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ')}
          </p>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              ¿Qué necesita el cliente?
            </label>
            <textarea className="input w-full" rows={3}
              placeholder="Ej: consulta precio de kit de embrague completo, incluir mano de obra…"
              value={solicitud} onChange={(e) => setSolicitud(e.target.value)} />
            <p className="text-[11px] text-slate-400 mt-1">
              Escríbelo como te lo pidió el cliente. El coordinador lo valoriza.
            </p>
          </div>

          {sugeridos.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Alertas del último RADAR ({sugeridos.length})
              </label>
              <p className="text-[11px] text-slate-400 mb-2">
                Marca las que quieras incluir. Van sin precio: los valoriza el coordinador.
              </p>
              <div className="space-y-1.5">
                {sugeridos.map((s) => {
                  const sev = SEV[s.severidad] || SEV.pronto
                  const on = !!elegidos[s.criterio_codigo]
                  return (
                    <button key={s.criterio_codigo} type="button"
                      onClick={() => toggle(s.criterio_codigo)}
                      className="w-full text-left p-2 rounded-lg border-2 flex gap-2 items-start"
                      style={{ borderColor: on ? sev.color : '#e2e8f0', background: on ? sev.bg : '#fff' }}>
                      <span className="mt-0.5 text-sm">{on ? '☑' : '☐'}</span>
                      <span className="text-sm flex-1">
                        <span className="font-medium text-ink">{s.criterio}</span>
                        <span className="text-slate-400"> · {s.categoria}</span>
                        <span className="block text-xs" style={{ color: sev.color }}>{s.opcion}</span>
                        {s.observacion && <span className="block text-xs text-slate-400 italic">{s.observacion}</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {!sugeridos.length && (
            <p className="text-[11px] text-slate-400">
              Este vehículo no tiene alertas de RADAR vigentes para sugerir.
            </p>
          )}

          {errMsg && (
            <p className="text-xs px-2 py-1.5 rounded" style={{ background: '#fdecea', color: '#8a1f18' }}>{errMsg}</p>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 flex gap-2 justify-end sticky bottom-0 bg-white">
          <button type="button" onClick={onCerrar} className="btn-soft text-sm">Cancelar</button>
          <button type="button" onClick={enviar} disabled={guardando}
            className="px-4 py-2 rounded-lg bg-deep text-white text-sm font-medium disabled:opacity-50">
            {guardando ? 'Enviando…' : 'Enviar a cotizar'}
          </button>
        </div>
      </div>
    </div>
  )
}
