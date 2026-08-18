import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'

/* ============================================================================
   Panel de salud del vehículo — alertas del RADAR
   ----------------------------------------------------------------------------
   Muestra los rojos y amarillos de las inspecciones RADAR con su observación.
   Responde "¿qué le pasa a este auto?" sin abrir la inspección completa.

   Se puede usar de dos formas:
     <PanelVehiculo vehiculoId={...} />              → panel completo
     <PanelVehiculo vehiculoId={...} compacto />     → resumen de una línea
   ========================================================================== */

const SEV = {
  critico: { label: 'Crítico', color: '#e0382b', bg: '#fdecea', punto: '🔴' },
  pronto:  { label: 'Pronto',  color: '#e0a020', bg: '#fdf6e3', punto: '🟡' }
}

const fecha = (d) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function PanelVehiculo({ vehiculoId, compacto = false }) {
  const [alertas, setAlertas] = useState([])
  const [estado, setEstado] = useState('cargando')
  const [errMsg, setErrMsg] = useState('')
  const [verTodas, setVerTodas] = useState(false)

  useEffect(() => { if (vehiculoId) cargar() }, [vehiculoId]) // eslint-disable-line

  async function cargar() {
    setEstado('cargando')
    const { data, error } = await supabase
      .from('v_radar_alertas')
      .select('*')
      .eq('vehiculo_id', vehiculoId)
      .order('iniciada_en', { ascending: false })
      .order('categoria_orden')
    if (error) { setErrMsg(error.message); setEstado('error'); return }
    setAlertas(data || []); setEstado('listo')
  }

  const D = useMemo(() => {
    if (!alertas.length) return null
    // La inspección más reciente es la que vale: las anteriores son historial.
    const ultima = alertas[0].inspeccion_id
    const vigentes = alertas.filter((a) => a.inspeccion_id === ultima)
    const historicas = alertas.filter((a) => a.inspeccion_id !== ultima)

    const porCategoria = {}
    vigentes.forEach((a) => {
      if (!porCategoria[a.categoria]) porCategoria[a.categoria] = { orden: a.categoria_orden, items: [] }
      porCategoria[a.categoria].items.push(a)
    })
    const cats = Object.entries(porCategoria)
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => a.orden - b.orden)

    return {
      vigentes, historicas, cats,
      criticos: vigentes.filter((a) => a.severidad === 'critico').length,
      pronto: vigentes.filter((a) => a.severidad === 'pronto').length,
      fecha: vigentes[0]?.iniciada_en,
      tecnico: vigentes[0]?.tecnico,
      km: vigentes[0]?.km,
      dias: vigentes[0]?.dias_desde
    }
  }, [alertas])

  if (estado === 'cargando') return <div className="text-xs text-slate-400">Cargando salud del vehículo…</div>

  if (estado === 'error') {
    const faltaVista = /v_radar_alertas|does not exist|schema cache/i.test(errMsg)
    return (
      <div className="text-[11px] text-slate-400">
        {faltaVista
          ? 'El panel de salud requiere la migración 59 (RADAR).'
          : 'No se pudo cargar la salud del vehículo: ' + errMsg}
      </div>
    )
  }

  if (!D) {
    return compacto
      ? <span className="text-[11px] text-slate-400">Sin RADAR</span>
      : (
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Salud del vehículo</div>
          <p className="text-sm text-slate-500">Este vehículo no tiene inspecciones RADAR registradas.</p>
        </div>
      )
  }

  // Versión de una línea, para listados
  if (compacto) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px]">
        {D.criticos > 0 && (
          <span className="px-1.5 py-0.5 rounded font-medium"
                style={{ background: SEV.critico.bg, color: SEV.critico.color }}>
            {D.criticos} crítico{D.criticos > 1 ? 's' : ''}
          </span>
        )}
        {D.pronto > 0 && (
          <span className="px-1.5 py-0.5 rounded font-medium"
                style={{ background: SEV.pronto.bg, color: SEV.pronto.color }}>
            {D.pronto} por atender
          </span>
        )}
        {!D.criticos && !D.pronto && <span className="text-slate-400">Sin alertas</span>}
      </span>
    )
  }

  return (
    <div className="rounded-lg border p-3"
         style={{ borderColor: D.criticos ? SEV.critico.color : D.pronto ? SEV.pronto.color : '#e2e8f0' }}>
      <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase">Salud del vehículo · RADAR</div>
          <div className="text-[11px] text-slate-400">
            Último control: {fecha(D.fecha)}
            {D.tecnico && <> · {D.tecnico}</>}
            {D.km ? <> · {D.km.toLocaleString('es-CL')} km</> : null}
          </div>
        </div>
        <div className="flex gap-1.5">
          {D.criticos > 0 && (
            <span className="px-2 py-1 rounded text-xs font-semibold"
                  style={{ background: SEV.critico.bg, color: SEV.critico.color }}>
              {D.criticos} crítico{D.criticos > 1 ? 's' : ''}
            </span>
          )}
          {D.pronto > 0 && (
            <span className="px-2 py-1 rounded text-xs font-semibold"
                  style={{ background: SEV.pronto.bg, color: SEV.pronto.color }}>
              {D.pronto} por atender
            </span>
          )}
        </div>
      </div>

      {/* Una alerta de hace mucho probablemente ya se resolvió */}
      {D.dias > 180 && (
        <p className="text-[11px] mb-2 px-2 py-1 rounded" style={{ background: '#f1f5f9', color: '#6b7a8a' }}>
          Esta inspección tiene {Math.round(D.dias / 30)} meses. Conviene confirmar
          que las alertas siguen vigentes antes de ofrecerlas al cliente.
        </p>
      )}

      <div className="space-y-2">
        {D.cats.map((cat) => (
          <div key={cat.nombre}>
            <div className="text-[11px] font-semibold text-ink">{cat.nombre}</div>
            <ul className="mt-0.5 space-y-1">
              {cat.items.map((a) => {
                const s = SEV[a.severidad] || SEV.pronto
                return (
                  <li key={a.criterio_codigo} className="flex gap-1.5 items-start text-xs">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: s.color }} />
                    <span className="text-slate-600">
                      <span className="font-medium text-ink">{a.criterio}</span>
                      {a.opcion && <> · {a.opcion}</>}
                      {a.observacion && (
                        <span className="block text-slate-400 italic">{a.observacion}</span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      {D.historicas.length > 0 && (
        <div className="mt-3 pt-2 border-t border-slate-100">
          <button onClick={() => setVerTodas((v) => !v)}
                  className="text-[11px] text-slate-400 hover:text-slate-600">
            {verTodas ? 'Ocultar' : 'Ver'} historial de inspecciones anteriores ({D.historicas.length} alerta{D.historicas.length > 1 ? 's' : ''})
          </button>
          {verTodas && (
            <ul className="mt-1.5 space-y-1">
              {D.historicas.map((a, i) => (
                <li key={a.criterio_codigo + i} className="text-[11px] text-slate-400 flex gap-1.5">
                  <span>{fecha(a.iniciada_en)}</span>
                  <span>·</span>
                  <span>{a.categoria} · {a.criterio}</span>
                  <span className="font-medium" style={{ color: (SEV[a.severidad] || SEV.pronto).color }}>
                    {a.opcion}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
