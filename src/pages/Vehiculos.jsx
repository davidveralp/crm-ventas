import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, fetchAllRows } from '../lib/supabase'
import { fmtCLP, formatPatente, patenteLimpia } from '../lib/helpers'
import PanelVehiculo from '../components/PanelVehiculo'
import SolicitarPresupuesto from '../components/SolicitarPresupuesto'

/* ============================================================================
   Panel de Vehículos
   ----------------------------------------------------------------------------
   El CRM estaba organizado por CLIENTE. Pero en un taller la unidad de trabajo
   real es el VEHÍCULO: es lo que entra, lo que se inspecciona y lo que tiene
   historial técnico. Un cliente con tres autos tenía su información mezclada.

   Dos vistas:
     · Listado buscable por patente, marca, modelo o cliente.
     · Ficha con toda la historia de una patente: datos, RADAR completo,
       presupuestos, servicios y trabajos de taller.
   ========================================================================== */

const SEV = {
  critico: { label: 'Crítico', color: '#e0382b', bg: '#fdecea' },
  pronto:  { label: 'Atender', color: '#b8860b', bg: '#fdf6e3' },
  ok:      { label: 'Bien',    color: '#1f7a45', bg: '#e8f6ee' },
  na:      { label: 'N/A',     color: '#6b7a8a', bg: '#f1f5f9' }
}

const fecha = (d) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const nombreCli = (c) => c ? `${c.nombre || ''} ${c.apellidos || ''}`.trim() : '—'

/* ------------------------------ LISTADO ---------------------------------- */

function Listado() {
  const nav = useNavigate()
  const [rows, setRows] = useState([])
  const [alertas, setAlertas] = useState({})
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [estado, setEstado] = useState('cargando')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [v, a] = await Promise.all([
      fetchAllRows('vehiculos', 'id,patente,patente_norm,marca,modelo,version,anio,tipo_vehiculo,traccion,transmision,km_ultimo,cliente_id,clientes(nombre,apellidos)'),
      supabase.from('v_radar_alertas').select('vehiculo_id,severidad,inspeccion_id')
    ])
    const m = {}
    ;(a.data || []).forEach((x) => {
      if (!m[x.vehiculo_id]) m[x.vehiculo_id] = { critico: 0, pronto: 0, insp: new Set() }
      // Solo la inspección más reciente cuenta; las anteriores son historial
      m[x.vehiculo_id].insp.add(x.inspeccion_id)
      m[x.vehiculo_id][x.severidad] = (m[x.vehiculo_id][x.severidad] || 0) + 1
    })
    setAlertas(m); setRows(v || []); setEstado('listo')
  }

  const visibles = useMemo(() => {
    const t = q.trim().toUpperCase()
    let r = rows
    if (t) {
      const tn = patenteLimpia(t)
      r = r.filter((v) =>
        (v.patente_norm || '').includes(tn) ||
        (v.marca || '').toUpperCase().includes(t) ||
        (v.modelo || '').toUpperCase().includes(t) ||
        nombreCli(v.clientes).toUpperCase().includes(t))
    }
    if (filtro === 'criticos') r = r.filter((v) => alertas[v.id]?.critico)
    if (filtro === 'atender') r = r.filter((v) => alertas[v.id]?.pronto && !alertas[v.id]?.critico)
    if (filtro === 'sin_radar') r = r.filter((v) => !alertas[v.id])
    return r
  }, [rows, q, filtro, alertas])

  const K = useMemo(() => ({
    total: rows.length,
    criticos: rows.filter((v) => alertas[v.id]?.critico).length,
    atender: rows.filter((v) => alertas[v.id]?.pronto && !alertas[v.id]?.critico).length,
    sinRadar: rows.filter((v) => !alertas[v.id]).length
  }), [rows, alertas])

  if (estado === 'cargando') return <div className="text-slate-400 text-sm">Cargando vehículos…</div>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-ink">Vehículos</h1>
        <p className="text-sm text-slate-500">Historial técnico por patente · {K.total.toLocaleString('es-CL')} vehículos</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { k: 'todos', label: 'Total', v: K.total, c: '#2f6fb0' },
          { k: 'criticos', label: 'Con críticos', v: K.criticos, c: SEV.critico.color },
          { k: 'atender', label: 'Por atender', v: K.atender, c: SEV.pronto.color },
          { k: 'sin_radar', label: 'Sin RADAR', v: K.sinRadar, c: '#6b7a8a' }
        ].map((x) => (
          <button key={x.k} onClick={() => setFiltro(x.k)}
            className="card p-3 text-left border-l-4 transition-opacity"
            style={{ borderLeftColor: x.c, opacity: filtro === x.k || filtro === 'todos' ? 1 : 0.55 }}>
            <div className="text-xs text-slate-500">{x.label}</div>
            <div className="text-2xl font-semibold text-ink">{x.v.toLocaleString('es-CL')}</div>
          </button>
        ))}
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <input className="input flex-1 w-full sm:min-w-[220px]" placeholder="Buscar por patente, marca, modelo o cliente…"
               value={q} onChange={(e) => setQ(e.target.value)} />
        {filtro !== 'todos' && (
          <button onClick={() => setFiltro('todos')} className="btn-soft text-sm">Quitar filtro ✕</button>
        )}
      </div>

      {/* Móvil: tarjetas. Una tabla de 6 columnas en 360px obliga a desplazar
          horizontalmente, que es la peor interacción posible en celular. */}
      <div className="sm:hidden space-y-2">
        {visibles.slice(0, 200).map((v) => {
          const a = alertas[v.id]
          return (
            <button key={v.id} onClick={() => nav(`/vehiculos/${v.id}`)}
              className="card p-3 w-full text-left active:bg-slate-50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{v.patente ? formatPatente(v.patente) : 'Sin patente'}</div>
                  <div className="text-sm text-slate-600 truncate">
                    {[v.marca, v.modelo, v.version].filter(Boolean).join(' ') || '—'}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{nombreCli(v.clientes)}</div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {!a ? <span className="text-[10px] text-slate-300">sin RADAR</span> : (
                    <span className="flex gap-1">
                      {a.critico > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                              style={{ background: SEV.critico.bg, color: SEV.critico.color }}>{a.critico}</span>
                      )}
                      {a.pronto > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                              style={{ background: SEV.pronto.bg, color: SEV.pronto.color }}>{a.pronto}</span>
                      )}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400">
                    {v.anio || '—'}{v.km_ultimo ? ` · ${(v.km_ultimo / 1000).toFixed(0)}k km` : ''}
                  </span>
                </div>
              </div>
            </button>
          )
        })}
        {!visibles.length && <div className="card p-4 text-sm text-slate-400 text-center">Sin vehículos que coincidan.</div>}
      </div>

      <div className="card overflow-x-auto hidden sm:block">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-slate-400 text-xs border-b">
              <th className="text-left p-2">Patente</th>
              <th className="text-left">Vehículo</th>
              <th className="text-left">Cliente</th>
              <th className="text-center">Año</th>
              <th className="text-right">Km</th>
              <th className="text-center">Salud</th>
            </tr>
          </thead>
          <tbody>
            {visibles.slice(0, 200).map((v) => {
              const a = alertas[v.id]
              return (
                <tr key={v.id} onClick={() => nav(`/vehiculos/${v.id}`)}
                    className="border-b last:border-0 cursor-pointer hover:bg-slate-50">
                  <td className="p-2 font-medium text-ink">{v.patente ? formatPatente(v.patente) : '—'}</td>
                  <td>
                    {[v.marca, v.modelo].filter(Boolean).join(' ') || '—'}
                    {v.version && <span className="text-slate-400"> {v.version}</span>}
                    {(v.traccion || v.transmision) && (
                      <span className="text-[11px] text-slate-400 block">
                        {[v.traccion, v.transmision].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </td>
                  <td className="truncate max-w-[180px]">{nombreCli(v.clientes)}</td>
                  <td className="text-center text-slate-500">{v.anio || '—'}</td>
                  <td className="text-right text-slate-500">{v.km_ultimo ? v.km_ultimo.toLocaleString('es-CL') : '—'}</td>
                  <td className="text-center">
                    {!a ? <span className="text-[11px] text-slate-300">sin RADAR</span> : (
                      <span className="inline-flex gap-1">
                        {a.critico > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                style={{ background: SEV.critico.bg, color: SEV.critico.color }}>{a.critico}</span>
                        )}
                        {a.pronto > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                style={{ background: SEV.pronto.bg, color: SEV.pronto.color }}>{a.pronto}</span>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
            {!visibles.length && (
              <tr><td colSpan={6} className="p-4 text-slate-400 text-center">Sin vehículos que coincidan.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {visibles.length > 200 && (
        <p className="text-[11px] text-slate-400">Se muestran los primeros 200 de {visibles.length}. Afina la búsqueda.</p>
      )}
    </div>
  )
}

/* -------------------------------- FICHA ---------------------------------- */

function Ficha({ id }) {
  const nav = useNavigate()
  const [v, setV] = useState(null)
  const [ots, setOts] = useState([])
  const [trabajos, setTrabajos] = useState([])
  const [presups, setPresups] = useState([])
  const [radares, setRadares] = useState([])
  const [respuestas, setRespuestas] = useState([])
  const [criterios, setCriterios] = useState([])
  const [tab, setTab] = useState('resumen')
  const [radarAbierto, setRadarAbierto] = useState(null)
  const [pidiendo, setPidiendo] = useState(false)
  const [estado, setEstado] = useState('cargando')

  useEffect(() => { cargar() }, [id]) // eslint-disable-line

  async function cargar() {
    setEstado('cargando')
    const { data: veh } = await supabase.from('vehiculos')
      .select('*, clientes(id,nombre,apellidos,telefono,email,rut)').eq('id', id).maybeSingle()
    if (!veh) { setEstado('noexiste'); return }
    setV(veh)

    const pn = veh.patente_norm || patenteLimpia(veh.patente || '')
    const [o, t, r, c] = await Promise.all([
      supabase.from('servicios').select('*').ilike('patente', `%${veh.patente || ''}%`).order('fecha', { ascending: false }).limit(100),
      supabase.from('trabajos_taller').select('*').eq('vehiculo_id', id).order('creado_en', { ascending: false }),
      supabase.from('radar_inspecciones').select('*, usuarios:tecnico_id(nombre)').eq('vehiculo_id', id).order('iniciada_en', { ascending: false }),
      supabase.from('radar_criterios').select('*').order('orden')
    ])
    setOts(o.data || []); setTrabajos(t.data || []); setRadares(r.data || []); setCriterios(c.data || [])

    // Presupuestos del vehículo: los anclados directamente (migración 60) y los
    // que cuelgan de sus trabajos de taller. Se unen sin duplicar.
    const ids = (t.data || []).map((x) => x.id)
    const consultas = [supabase.from('presupuestos_taller').select('*').eq('vehiculo_id', id)]
    if (ids.length) consultas.push(supabase.from('presupuestos_taller').select('*').in('trabajo_id', ids))
    const res = await Promise.all(consultas)
    const mapa = new Map()
    res.forEach((r) => (r.data || []).forEach((x) => mapa.set(x.id, x)))
    setPresups([...mapa.values()].sort((a2, b2) => (b2.creado_en > a2.creado_en ? 1 : -1)))
    const rids = (r.data || []).map((x) => x.id)
    if (rids.length) {
      const { data: rr } = await supabase.from('radar_respuestas').select('*').in('inspeccion_id', rids)
      setRespuestas(rr || [])
    }
    setEstado('listo')
  }

  const K = useMemo(() => {
    const facturado = ots.reduce((s, x) => s + (Number(x.monto) || 0), 0)
    return {
      visitas: ots.length,
      facturado,
      ticket: ots.length ? facturado / ots.length : 0,
      ultima: ots[0]?.fecha,
      primera: ots[ots.length - 1]?.fecha,
      radares: radares.length,
      presups: presups.length
    }
  }, [ots, radares, presups])

  if (estado === 'cargando') return <div className="text-slate-400 text-sm">Cargando ficha…</div>
  if (estado === 'noexiste') return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">Este vehículo no existe.</p>
      <button onClick={() => nav('/vehiculos')} className="btn-soft text-sm mt-2">← Volver</button>
    </div>
  )

  const TABS = [
    ['resumen', 'Resumen'],
    ['radar', `RADAR (${radares.length})`],
    ['presupuestos', `Presupuestos (${presups.length})`],
    ['servicios', `Servicios (${ots.length})`],
    ['taller', `Taller (${trabajos.length})`]
  ]

  return (
    <div className="space-y-4">
      <button onClick={() => nav('/vehiculos')} className="text-sm text-slate-400 hover:text-slate-600">← Vehículos</button>

      {/* Cabecera */}
      <div className="card p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-ink">{v.patente ? formatPatente(v.patente) : 'Sin patente'}</h1>
            <p className="text-slate-500">
              {[v.marca, v.modelo, v.version].filter(Boolean).join(' ')} {v.anio ? `· ${v.anio}` : ''}
            </p>
            {v.clientes && (
              <button onClick={() => nav(`/clientes/${v.clientes.id}`)}
                      className="text-sm text-blue-700 hover:underline mt-1 block">
                {nombreCli(v.clientes)} →
              </button>
            )}
            <button onClick={() => setPidiendo(true)} className="btn-accion mt-2">
              💰 Solicitar presupuesto
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-3 text-sm w-full sm:w-auto">
            <div><div className="text-[11px] text-slate-400">Visitas</div><div className="font-semibold text-ink">{K.visitas}</div></div>
            <div><div className="text-[11px] text-slate-400">Facturado</div><div className="font-semibold text-ink">{fmtCLP(K.facturado)}</div></div>
            <div><div className="text-[11px] text-slate-400">Ticket prom.</div><div className="font-semibold text-ink">{fmtCLP(K.ticket)}</div></div>
            <div><div className="text-[11px] text-slate-400">Última visita</div><div className="font-semibold text-ink">{fecha(K.ultima)}</div></div>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${tab === k ? 'bg-deep text-white' : 'bg-white border border-slate-200 text-slate-500'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <PanelVehiculo vehiculoId={id} />
          <div className="card p-4">
            <h3 className="font-semibold text-ink mb-2">Datos del vehículo</h3>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ['Patente', v.patente ? formatPatente(v.patente) : '—'],
                  ['Marca', v.marca || '—'], ['Modelo', v.modelo || '—'],
                  ['Versión', v.version || '—'], ['Año', v.anio || '—'],
                  ['Cilindrada', v.cilindrada || '—'],
                  ['Tracción', v.traccion || '—'], ['Transmisión', v.transmision || '—'],
                  ['Tipo', v.tipo_vehiculo || '—'], ['Color', v.color || '—'],
                  ['Km último', v.km_ultimo ? v.km_ultimo.toLocaleString('es-CL') : '—'],
                  ['Teléfono', v.clientes?.telefono || '—'],
                  ['Correo', v.clientes?.email || '—']
                ].map(([k, val]) => (
                  <tr key={k} className="border-b last:border-0">
                    <td className="py-1.5 text-slate-400 w-32">{k}</td>
                    <td className="font-medium text-ink">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'radar' && (
        <div className="space-y-3">
          {!radares.length && <div className="card p-4 text-sm text-slate-500">Este vehículo no tiene inspecciones RADAR.</div>}
          {radares.map((r) => {
            const rs = respuestas.filter((x) => x.inspeccion_id === r.id)
            const cnt = { critico: 0, pronto: 0, ok: 0, na: 0 }
            rs.forEach((x) => { if (cnt[x.severidad] !== undefined) cnt[x.severidad]++ })
            const abierto = radarAbierto === r.id
            return (
              <div key={r.id} className="card p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-semibold text-ink">RADAR del {fecha(r.iniciada_en)}</div>
                    <div className="text-[11px] text-slate-400">
                      {r.usuarios?.nombre || 'Sin técnico'} · {r.km ? r.km.toLocaleString('es-CL') + ' km' : 'sin km'} ·{' '}
                      {r.estado === 'completada' ? 'Completada' : 'En proceso'}
                    </div>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    {Object.entries(cnt).filter(([, n]) => n > 0).map(([s, n]) => (
                      <span key={s} className="px-2 py-1 rounded text-xs font-semibold"
                            style={{ background: SEV[s].bg, color: SEV[s].color }}>{n} {SEV[s].label}</span>
                    ))}
                    <button onClick={() => setRadarAbierto(abierto ? null : r.id)} className="btn-soft text-sm">
                      {abierto ? 'Ocultar' : 'Ver los 45 criterios'}
                    </button>
                  </div>
                </div>
                {abierto && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    {criterios.length === 0 && <p className="text-xs text-slate-400">Catálogo no disponible.</p>}
                    {Object.entries(
                      criterios.reduce((acc, c) => { (acc[c.categoria] = acc[c.categoria] || []).push(c); return acc }, {})
                    ).map(([catCod, items]) => (
                      <div key={catCod} className="mb-3">
                        <div className="text-xs font-semibold text-slate-400 uppercase mb-1">{catCod.replace(/_/g, ' ')}</div>
                        <table className="w-full text-xs">
                          <tbody>
                            {items.map((c) => {
                              const x = rs.find((y) => y.criterio_codigo === c.codigo)
                              const s = SEV[x?.severidad] || null
                              return (
                                <tr key={c.codigo} className="border-b last:border-0">
                                  <td className="py-1 text-slate-400 w-12">{c.codigo}</td>
                                  <td className="py-1">{c.texto}</td>
                                  <td className="py-1 text-right">
                                    {x ? (
                                      <span className="px-1.5 py-0.5 rounded font-medium"
                                            style={{ background: s.bg, color: s.color }}>{x.opcion}</span>
                                    ) : <span className="text-slate-300">sin responder</span>}
                                    {x?.observacion && (
                                      <span className="block text-slate-400 italic mt-0.5">{x.observacion}</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'presupuestos' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[460px]">
            <thead><tr className="text-slate-400 text-xs border-b">
              <th className="text-left p-2">Fecha</th><th className="text-left">Origen</th><th className="text-left">Estado</th>
              <th className="text-right">Ítems</th><th className="text-right">Monto</th><th className="text-left">Solicitud / Notas</th>
            </tr></thead>
            <tbody>
              {presups.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="p-2">{fecha(p.creado_en)}</td>
                  <td className="text-[11px] text-slate-400">
                    {p.origen === 'radar' ? 'RADAR' : p.origen === 'vehiculo' ? 'Consulta' : 'Taller'}
                  </td>
                  <td><span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">{p.estado}</span></td>
                  <td className="text-right">{Array.isArray(p.items) ? p.items.length : 0}</td>
                  <td className="text-right font-medium">{p.monto ? fmtCLP(p.monto) : '—'}</td>
                  <td className="truncate max-w-[220px] text-slate-500">{p.solicitud || p.notas || '—'}</td>
                </tr>
              ))}
              {!presups.length && <tr><td colSpan={6} className="p-4 text-slate-400 text-center">Sin presupuestos.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'servicios' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead><tr className="text-slate-400 text-xs border-b">
              <th className="text-left p-2">Fecha</th><th className="text-left">OT</th>
              <th className="text-left">Servicio</th><th className="text-right">Km</th>
              <th className="text-left">Documento</th><th className="text-right">Monto</th>
            </tr></thead>
            <tbody>
              {ots.map((o) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="p-2">{fecha(o.fecha)}</td>
                  <td className="text-slate-500">{o.ot_numero || '—'}</td>
                  <td>{o.tipo_servicio || o.descripcion || '—'}</td>
                  <td className="text-right text-slate-500">{o.km ? o.km.toLocaleString('es-CL') : '—'}</td>
                  <td className="text-slate-500">{o.documento || '—'}</td>
                  <td className="text-right font-medium">{o.monto ? fmtCLP(o.monto) : '—'}</td>
                </tr>
              ))}
              {!ots.length && <tr><td colSpan={6} className="p-4 text-slate-400 text-center">Sin servicios registrados.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {pidiendo && (
        <SolicitarPresupuesto vehiculo={v}
          onCerrar={() => setPidiendo(false)}
          onCreado={() => { setPidiendo(false); setTab('presupuestos'); cargar() }} />
      )}

      {tab === 'taller' && (
        <div className="space-y-2">
          {trabajos.map((t) => (
            <div key={t.id} className="card p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-medium text-ink">{t.titulo || 'Trabajo de taller'}</div>
                  <div className="text-[11px] text-slate-400">
                    {fecha(t.creado_en)} · {t.estado} · prioridad {t.prioridad || 'normal'}
                  </div>
                </div>
                {t.clickup_task_id && <span className="text-[10px] text-slate-400">ClickUp ✓</span>}
              </div>
              {t.observaciones_cliente && <p className="text-xs text-slate-500 mt-1">{t.observaciones_cliente}</p>}
            </div>
          ))}
          {!trabajos.length && <div className="card p-4 text-sm text-slate-400">Sin trabajos de taller.</div>}
        </div>
      )}
    </div>
  )
}

export default function Vehiculos() {
  const { id } = useParams()
  return id ? <Ficha id={id} /> : <Listado />
}
