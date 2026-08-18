import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { fmtCLP } from '../lib/helpers'

/* ============================================================================
   Conversión de venta cruzada
   ----------------------------------------------------------------------------
   Responde la pregunta que originó el módulo operativo: de los hallazgos que
   detecta el técnico, ¿cuántos llegan a ser venta?

   La cifra central es "sin ofrecer": hallazgos registrados que nunca se le
   presentaron al cliente. Es una pérdida que hoy no se ve en ningún informe,
   porque el diagnóstico moría en la ficha del trabajo.
   ========================================================================== */

const C = { red: '#e0382b', green: '#1f9d57', amber: '#e0a020', blue: '#2f6fb0', muted: '#6b7a8a' }

const SEV = {
  critico:    { label: 'Crítico',    color: C.red,   orden: 1 },
  pronto:     { label: 'Pronto',     color: C.amber, orden: 2 },
  preventivo: { label: 'Preventivo', color: C.blue,  orden: 3 }
}

const ESTADO = {
  detectada:      { label: 'Sin ofrecer',   color: C.red },
  ofrecida:       { label: 'Ofrecida',      color: C.amber },
  presupuestada:  { label: 'Presupuestada', color: C.blue },
  aprobada:       { label: 'Aprobada',      color: C.green },
  rechazada:      { label: 'Rechazada',     color: C.muted },
  postergada:     { label: 'Postergada',    color: C.muted }
}

export default function Oportunidades() {
  const [rows, setRows] = useState([])
  const [estado, setEstado] = useState('cargando')
  const [errMsg, setErrMsg] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const [meses, setMeses] = useState(6)

  useEffect(() => { cargar() }, [meses]) // eslint-disable-line

  async function cargar() {
    setEstado('cargando')
    const desde = new Date()
    desde.setMonth(desde.getMonth() - meses)
    const { data, error } = await supabase
      .from('oportunidades')
      .select(`id, titulo, detalle, severidad, estado, monto_estimado,
               detectada_en, ofrecida_en, cerrada_en, motivo_cierre,
               clientes(nombre, apellidos), vehiculos(patente, marca, modelo),
               det:detectado_por(nombre), asig:asignado_a(nombre)`)
      .gte('detectada_en', desde.toISOString())
      .order('detectada_en', { ascending: false })
    if (error) { setErrMsg(error.message); setEstado('error'); return }
    setRows(data || []); setEstado('listo')
  }

  const K = useMemo(() => {
    const total = rows.length
    const porEstado = {}
    Object.keys(ESTADO).forEach((k) => { porEstado[k] = rows.filter((r) => r.estado === k) })
    const ofrecidas = rows.filter((r) => r.ofrecida_en)
    const aprobadas = porEstado.aprobada
    const sinOfrecer = porEstado.detectada

    // Por severidad, para ver si lo crítico se está ofreciendo
    const porSev = Object.keys(SEV).map((s) => {
      const g = rows.filter((r) => r.severidad === s)
      const of = g.filter((r) => r.ofrecida_en)
      const ap = g.filter((r) => r.estado === 'aprobada')
      return {
        sev: s, total: g.length, ofrecidas: of.length, aprobadas: ap.length,
        sinOfrecer: g.filter((r) => r.estado === 'detectada').length,
        pctOfrec: g.length ? of.length / g.length * 100 : 0,
        pctCierre: of.length ? ap.length / of.length * 100 : 0,
        monto: g.reduce((s2, r) => s2 + (r.monto_estimado || 0), 0),
        montoAprob: ap.reduce((s2, r) => s2 + (r.monto_estimado || 0), 0)
      }
    }).sort((a, b) => SEV[a.sev].orden - SEV[b.sev].orden)

    return {
      total, ofrecidas: ofrecidas.length, aprobadas: aprobadas.length,
      sinOfrecer: sinOfrecer.length, porEstado, porSev,
      pctOfrec: total ? ofrecidas.length / total * 100 : 0,
      pctCierre: ofrecidas.length ? aprobadas.length / ofrecidas.length * 100 : 0,
      montoDetectado: rows.reduce((s, r) => s + (r.monto_estimado || 0), 0),
      montoAprobado: aprobadas.reduce((s, r) => s + (r.monto_estimado || 0), 0),
      montoPerdido: sinOfrecer.reduce((s, r) => s + (r.monto_estimado || 0), 0)
    }
  }, [rows])

  const visibles = filtro === 'todas' ? rows : rows.filter((r) => r.estado === filtro)

  if (estado === 'cargando') return <div className="text-slate-400 text-sm">Cargando oportunidades…</div>
  if (estado === 'error') return (
    <div className="card p-4 border-l-4" style={{ borderLeftColor: C.amber }}>
      <h3 className="font-semibold text-ink mb-1">No se pudo cargar</h3>
      <p className="text-sm text-slate-500">{errMsg}</p>
      <p className="text-[11px] text-slate-400 mt-2">
        Si el mensaje menciona que la tabla no existe, falta ejecutar la migración 58.
      </p>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-ink">Conversión de venta cruzada</h2>
          <p className="text-[11px] text-slate-400">
            De los hallazgos que detecta el técnico, cuántos llegan a ser venta.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-xs">
          {[3, 6, 12].map((m) => (
            <button key={m} onClick={() => setMeses(m)}
              className={`px-2.5 py-1 ${meses === m ? 'bg-deep text-white' : 'text-slate-500'}`}>
              {m} meses
            </button>
          ))}
        </div>
      </div>

      {!rows.length ? (
        <div className="card p-4">
          <p className="text-sm text-slate-500">
            Todavía no hay oportunidades registradas en este período.
          </p>
          <p className="text-[11px] text-slate-400 mt-2">
            Se crean automáticamente al pasar un diagnóstico a presupuesto desde el módulo Taller.
          </p>
        </div>
      ) : (
        <>
          {/* La cifra que importa va primero */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card p-3 border-l-4" style={{ borderLeftColor: C.red }}>
              <div className="text-xs text-slate-500">Sin ofrecer</div>
              <div className="text-2xl font-semibold" style={{ color: K.sinOfrecer ? C.red : C.green }}>
                {K.sinOfrecer}
              </div>
              <div className="text-[11px] text-slate-400">
                {K.montoPerdido ? fmtCLP(K.montoPerdido) + ' sin presentar' : 'de ' + K.total + ' detectadas'}
              </div>
            </div>
            <div className="card p-3 border-l-4" style={{ borderLeftColor: C.amber }}>
              <div className="text-xs text-slate-500">% Ofrecimiento</div>
              <div className="text-2xl font-semibold text-ink">{K.pctOfrec.toFixed(0)}%</div>
              <div className="text-[11px] text-slate-400">{K.ofrecidas} de {K.total} llegaron al cliente</div>
            </div>
            <div className="card p-3 border-l-4" style={{ borderLeftColor: C.green }}>
              <div className="text-xs text-slate-500">% Cierre</div>
              <div className="text-2xl font-semibold text-ink">{K.pctCierre.toFixed(0)}%</div>
              <div className="text-[11px] text-slate-400">{K.aprobadas} aprobadas de {K.ofrecidas} ofrecidas</div>
            </div>
            <div className="card p-3 border-l-4" style={{ borderLeftColor: C.blue }}>
              <div className="text-xs text-slate-500">Venta cruzada lograda</div>
              <div className="text-2xl font-semibold text-ink">{fmtCLP(K.montoAprobado)}</div>
              <div className="text-[11px] text-slate-400">de {fmtCLP(K.montoDetectado)} detectados</div>
            </div>
          </div>

          {/* Por severidad: lo crítico debería ofrecerse siempre */}
          <div className="card p-4">
            <h3 className="font-semibold text-ink mb-1">Por severidad del hallazgo</h3>
            <p className="text-[11px] text-slate-400 mb-3">
              Un hallazgo crítico sin ofrecer es el caso más grave: es un riesgo para el cliente
              y una venta perdida a la vez.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs border-b">
                  <th className="text-left py-1">Severidad</th>
                  <th className="text-right">Detectadas</th>
                  <th className="text-right">Sin ofrecer</th>
                  <th className="text-right">% Ofrec.</th>
                  <th className="text-right">Aprobadas</th>
                  <th className="text-right">% Cierre</th>
                  <th className="text-right">Monto aprobado</th>
                </tr>
              </thead>
              <tbody>
                {K.porSev.filter((x) => x.total > 0).map((x) => (
                  <tr key={x.sev} className="border-b last:border-0">
                    <td className="py-1.5 font-medium">
                      <span className="inline-block w-2 h-2 rounded-sm mr-1.5"
                            style={{ background: SEV[x.sev].color }} />
                      {SEV[x.sev].label}
                    </td>
                    <td className="text-right">{x.total}</td>
                    <td className="text-right font-medium"
                        style={{ color: x.sinOfrecer && x.sev === 'critico' ? C.red : x.sinOfrecer ? C.amber : C.muted }}>
                      {x.sinOfrecer || '—'}
                    </td>
                    <td className="text-right">{x.pctOfrec.toFixed(0)}%</td>
                    <td className="text-right">{x.aprobadas}</td>
                    <td className="text-right">{x.ofrecidas ? x.pctCierre.toFixed(0) + '%' : '—'}</td>
                    <td className="text-right">{fmtCLP(x.montoAprob)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {K.porSev.find((x) => x.sev === 'critico' && x.sinOfrecer > 0) && (
              <p className="text-[11px] mt-3 px-2 py-1.5 rounded" style={{ background: '#fdecea', color: '#8a1f18' }}>
                Hay {K.porSev.find((x) => x.sev === 'critico').sinOfrecer} hallazgo(s) crítico(s) sin
                ofrecer al cliente. Revisar caso a caso antes de que el vehículo vuelva a salir.
              </p>
            )}
          </div>

          {/* Detalle filtrable */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h3 className="font-semibold text-ink">Detalle ({visibles.length})</h3>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setFiltro('todas')}
                  className={`text-xs px-2 py-1 rounded ${filtro === 'todas' ? 'bg-deep text-white' : 'bg-slate-100 text-slate-500'}`}>
                  Todas
                </button>
                {Object.entries(ESTADO).map(([k, v]) => {
                  const n = K.porEstado[k]?.length || 0
                  if (!n) return null
                  return (
                    <button key={k} onClick={() => setFiltro(k)}
                      className="text-xs px-2 py-1 rounded"
                      style={filtro === k
                        ? { background: v.color, color: '#fff' }
                        : { background: '#f1f5f9', color: v.color }}>
                      {v.label} {n}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[720px]">
                <thead>
                  <tr className="text-slate-400 border-b">
                    <th className="text-left py-1">Hallazgo</th>
                    <th className="text-left">Vehículo</th>
                    <th className="text-left">Cliente</th>
                    <th className="text-left">Detectó</th>
                    <th className="text-left">Asesor</th>
                    <th className="text-center">Severidad</th>
                    <th className="text-center">Estado</th>
                    <th className="text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-1.5 max-w-[220px]">
                        <div className="truncate font-medium text-ink">{r.titulo}</div>
                        {r.detalle && <div className="truncate text-slate-400">{r.detalle}</div>}
                      </td>
                      <td>{r.vehiculos?.patente || '—'}</td>
                      <td className="truncate max-w-[140px]">
                        {r.clientes ? `${r.clientes.nombre || ''} ${r.clientes.apellidos || ''}`.trim() : '—'}
                      </td>
                      <td className="truncate max-w-[100px]">{r.det?.nombre || '—'}</td>
                      <td className="truncate max-w-[100px]">{r.asig?.nombre || '—'}</td>
                      <td className="text-center">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={{ background: (SEV[r.severidad]?.color || C.muted) + '20',
                                       color: SEV[r.severidad]?.color || C.muted }}>
                          {SEV[r.severidad]?.label || r.severidad}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={{ background: (ESTADO[r.estado]?.color || C.muted) + '20',
                                       color: ESTADO[r.estado]?.color || C.muted }}>
                          {ESTADO[r.estado]?.label || r.estado}
                        </span>
                      </td>
                      <td className="text-right">{r.monto_estimado ? fmtCLP(r.monto_estimado) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              El estado lo calcula la base desde el presupuesto asociado, así que no puede
              quedar desincronizado con él. El monto es el estimado al detectar el hallazgo,
              no el facturado.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
