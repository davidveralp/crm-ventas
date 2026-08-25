import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtCLP, formatPatente } from '../lib/helpers'

/* ============================================================================
   Panel de Postventa
   ----------------------------------------------------------------------------
   Lo que el cliente respondió sin el asesor delante.

   El indicador que importa no es el promedio sino los DETRACTORES: un cliente
   que puntúa 6 o menos tiene un problema concreto y todavía se puede resolver.
   Por eso van primero y con su comentario a la vista.
   ========================================================================== */

const CAT = {
  promotor:  { label: 'Promotores', color: '#1f9d57', bg: '#e8f6ee' },
  pasivo:    { label: 'Pasivos',    color: '#e0a020', bg: '#fdf6e3' },
  detractor: { label: 'Detractores', color: '#e0382b', bg: '#fdecea' }
}
const fecha = (d) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'

export default function Postventa() {
  const [rows, setRows] = useState([])
  const [estado, setEstado] = useState('cargando')
  const [errMsg, setErrMsg] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const [meses, setMeses] = useState(3)
  const [despachando, setDespachando] = useState(false)
  const [msgDesp, setMsgDesp] = useState('')

  useEffect(() => { cargar() }, [meses]) // eslint-disable-line

  async function cargar() {
    setEstado('cargando')
    const desde = new Date(); desde.setMonth(desde.getMonth() - meses)
    const { data, error } = await supabase.from('v_postventa')
      .select('*').gte('creada_en', desde.toISOString()).order('creada_en', { ascending: false })
    if (error) { setErrMsg(error.message); setEstado('error'); return }
    setRows(data || []); setEstado('listo')
  }

  async function despachar() {
    setDespachando(true); setMsgDesp('')
    try {
      const { data, error } = await supabase.functions.invoke('enviar-encuestas', { body: { accion: 'despachar' } })
      if (error || data?.error) setMsgDesp('No se pudo despachar: ' + (data?.error || error.message))
      else {
        setMsgDesp(`${data.revisadas} revisadas · ${data.enviadas} enviadas · ${data.sin_correo} sin correo` +
                   (data.fallidas ? ` · ${data.fallidas} se reintentarán` : ''))
        cargar()
      }
    } catch (e) { setMsgDesp('No se pudo despachar: ' + (e?.message || e)) }
    setDespachando(false)
  }

  const K = useMemo(() => {
    const resp = rows.filter((r) => r.estado === 'respondida' && r.nps != null)
    const prom = resp.filter((r) => r.nps >= 9).length
    const pas = resp.filter((r) => r.nps >= 7 && r.nps <= 8).length
    const det = resp.filter((r) => r.nps <= 6).length
    const prm = (k) => {
      const v = resp.map((r) => r[k]).filter((x) => x != null)
      return v.length ? (v.reduce((a, b) => a + b, 0) / v.length) : null
    }
    return {
      programadas: rows.filter((r) => r.estado === 'programada').length,
      enviadas: rows.filter((r) => r.estado === 'enviada').length,
      sinCorreo: rows.filter((r) => r.estado === 'descartada').length,
      respondidas: resp.length, prom, pas, det,
      nps: resp.length ? Math.round(((prom - det) / resp.length) * 100) : null,
      tasa: rows.filter((r) => r.estado !== 'descartada').length
        ? Math.round(resp.length / rows.filter((r) => r.estado !== 'descartada').length * 100) : 0,
      calidad: prm('p_calidad'), plazo: prm('p_plazo'), atencion: prm('p_atencion')
    }
  }, [rows])

  const visibles = useMemo(() => {
    if (filtro === 'todas') return rows
    if (filtro === 'sin_responder') return rows.filter((r) => ['programada', 'enviada'].includes(r.estado))
    return rows.filter((r) => r.categoria === filtro)
  }, [rows, filtro])

  if (estado === 'cargando') return <div className="text-slate-400 text-sm">Cargando postventa…</div>
  if (estado === 'error') return (
    <div className="card p-4 border-l-4" style={{ borderLeftColor: '#e0a020' }}>
      <p className="text-sm text-slate-600">No se pudo cargar el panel de postventa.</p>
      <p className="text-xs text-slate-400 mt-1">{errMsg}</p>
      <p className="text-[11px] text-slate-400 mt-2">Si menciona <code>v_postventa</code>, falta la migración 66.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-ink">Postventa</h2>
          <p className="text-[11px] text-slate-400">
            Encuestas enviadas por correo al día siguiente de la entrega, sin el asesor delante.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-xs">
            {[1, 3, 6, 12].map((m) => (
              <button key={m} onClick={() => setMeses(m)}
                className={`px-2.5 py-1 ${meses === m ? 'bg-deep text-white' : 'text-slate-500'}`}>
                {m}m
              </button>
            ))}
          </div>
          <button onClick={despachar} disabled={despachando} className="btn-soft text-xs">
            {despachando ? 'Enviando…' : '✉ Despachar pendientes'}
          </button>
        </div>
      </div>
      {msgDesp && (
        <p className="text-[11px] px-2 py-1.5 rounded" style={{ background: '#e8f6ee', color: '#1f7a45' }}>{msgDesp}</p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-3 border-l-4" style={{ borderLeftColor: CAT.detractor.color }}>
          <div className="text-xs text-slate-500">Detractores</div>
          <div className="text-2xl font-semibold" style={{ color: K.det ? CAT.detractor.color : '#1f9d57' }}>{K.det}</div>
          <div className="text-[11px] text-slate-400">Puntuación 6 o menos</div>
        </div>
        <div className="card p-3 border-l-4" style={{ borderLeftColor: '#2f6fb0' }}>
          <div className="text-xs text-slate-500">NPS</div>
          <div className="text-2xl font-semibold text-ink">{K.nps == null ? '—' : (K.nps > 0 ? '+' : '') + K.nps}</div>
          <div className="text-[11px] text-slate-400">{K.respondidas} respuestas</div>
        </div>
        <div className="card p-3 border-l-4" style={{ borderLeftColor: '#e0a020' }}>
          <div className="text-xs text-slate-500">Tasa de respuesta</div>
          <div className="text-2xl font-semibold text-ink">{K.tasa}%</div>
          <div className="text-[11px] text-slate-400">{K.enviadas} enviadas · {K.programadas} por salir</div>
        </div>
        <div className="card p-3 border-l-4" style={{ borderLeftColor: '#6b7a8a' }}>
          <div className="text-xs text-slate-500">Sin correo</div>
          <div className="text-2xl font-semibold text-ink">{K.sinCorreo}</div>
          <div className="text-[11px] text-slate-400">Clientes que no se pueden encuestar</div>
        </div>
      </div>

      {K.respondidas > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-ink mb-2">Promedios (1 a 5)</h3>
          <div className="grid grid-cols-3 gap-3">
            {[['Trabajo', K.calidad], ['Plazo', K.plazo], ['Atención', K.atencion]].map(([l, v]) => (
              <div key={l}>
                <div className="text-xs text-slate-500">{l}</div>
                <div className="text-xl font-semibold" style={{ color: v == null ? '#94a3b8' : v >= 4 ? '#1f9d57' : v >= 3 ? '#e0a020' : '#e0382b' }}>
                  {v == null ? '—' : v.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            El promedio esconde los casos malos: es en Detractores donde está lo accionable.
          </p>
        </div>
      )}

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-semibold text-ink">Respuestas ({visibles.length})</h3>
          <div className="flex flex-wrap gap-1">
            {[['todas', 'Todas', rows.length],
              ['detractor', 'Detractores', K.det],
              ['pasivo', 'Pasivos', K.pas],
              ['promotor', 'Promotores', K.prom],
              ['sin_responder', 'Sin responder', K.programadas + K.enviadas]].map(([k, l, n]) => (
              <button key={k} onClick={() => setFiltro(k)}
                className="text-xs px-2 py-1 rounded"
                style={filtro === k
                  ? { background: CAT[k]?.color || '#111922', color: '#fff' }
                  : { background: '#f1f5f9', color: CAT[k]?.color || '#64748b' }}>
                {l} {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {visibles.map((r) => {
            const c = CAT[r.categoria]
            return (
              <div key={r.id} className="rounded-lg border p-3"
                   style={{ borderColor: c ? c.color + '55' : '#e2e8f0', background: r.categoria === 'detractor' ? CAT.detractor.bg : '#fff' }}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-medium text-ink text-sm">
                      {`${r.nombre || ''} ${r.apellidos || ''}`.trim() || 'Cliente'}
                      {r.patente && <span className="text-slate-400 font-normal"> · {formatPatente(r.patente)}</span>}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {[r.marca, r.modelo].filter(Boolean).join(' ')}
                      {r.asesor && ` · atendió ${r.asesor}`}
                      {r.monto_total ? ` · ${fmtCLP(r.monto_total)}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {r.nps != null ? (
                      <span className="px-2 py-1 rounded text-sm font-bold"
                            style={{ background: c?.bg, color: c?.color }}>{r.nps}/10</span>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        {r.estado === 'programada' ? 'Sale mañana' : r.estado === 'enviada' ? 'Enviada, sin responder' : 'Sin correo'}
                      </span>
                    )}
                    <div className="text-[10px] text-slate-400 mt-0.5">{fecha(r.respondida_en || r.creada_en)}</div>
                  </div>
                </div>
                {r.comentario && (
                  <p className="text-sm text-slate-600 mt-2 italic border-l-2 pl-2"
                     style={{ borderColor: c?.color || '#e2e8f0' }}>«{r.comentario}»</p>
                )}
                {r.categoria === 'detractor' && r.telefono && (
                  <a href={`tel:${r.telefono}`} className="inline-block mt-2 text-xs font-semibold"
                     style={{ color: CAT.detractor.color }}>
                    Llamar a {r.telefono} →
                  </a>
                )}
              </div>
            )
          })}
          {!visibles.length && <p className="text-sm text-slate-400 text-center py-4">Sin resultados en este filtro.</p>}
        </div>
      </div>
    </div>
  )
}
