import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtFecha, estadoGestionLabel, estadoGestionColor, motivoCierreLabel } from '../lib/helpers'

const HOY = new Date().toISOString().slice(0, 10)
const FILTROS = ['Abiertas', 'Pendientes', 'Vencidas', 'Cerradas', 'Todas']

export default function Gestiones() {
  const navigate = useNavigate()
  const [gestiones, setGestiones] = useState([])
  const [agenda, setAgenda] = useState({}) // gestion_id -> { prox, pasada }
  const [filtro, setFiltro] = useState('Abiertas')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: g }, { data: a }] = await Promise.all([
      supabase.from('gestiones')
        .select('*, clientes(nombre,apellidos), usuarios(nombre)')
        .order('creado_en', { ascending: false }).limit(1000),
      supabase.from('actividades')
        .select('gestion_id, proxima_fecha')
        .not('proxima_fecha', 'is', null).limit(5000)
    ])
    const map = {}
    ;(a || []).forEach((x) => {
      if (!x.gestion_id) return
      const m = (map[x.gestion_id] ||= { prox: null, pasada: null })
      if (x.proxima_fecha >= HOY) m.prox = !m.prox || x.proxima_fecha < m.prox ? x.proxima_fecha : m.prox
      else m.pasada = !m.pasada || x.proxima_fecha > m.pasada ? x.proxima_fecha : m.pasada
    })
    setGestiones(g || []); setAgenda(map)
  }

  const clasif = (g) => {
    if (!g.abierta) return 'cerrada'
    const m = agenda[g.id] || {}
    if (m.prox) return 'aldia'
    if (m.pasada) return 'vencida'
    return 'pendiente'
  }

  const kpis = useMemo(() => {
    const k = { abiertas: 0, pendientes: 0, vencidas: 0, cerradas: 0 }
    gestiones.forEach((g) => {
      const c = clasif(g)
      if (c === 'cerrada') k.cerradas++
      else { k.abiertas++; if (c === 'vencida') k.vencidas++; if (c === 'pendiente') k.pendientes++ }
    })
    return k
  }, [gestiones, agenda])

  const lista = useMemo(() => gestiones.filter((g) => {
    const c = clasif(g)
    if (filtro === 'Todas') return true
    if (filtro === 'Abiertas') return g.abierta
    if (filtro === 'Cerradas') return c === 'cerrada'
    if (filtro === 'Pendientes') return c === 'pendiente'
    if (filtro === 'Vencidas') return c === 'vencida'
    return true
  }), [gestiones, agenda, filtro])

  const Kpi = ({ n, label, color }) => (
    <div className="card p-4">
      <div className="text-2xl font-bold" style={{ color }}>{n}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink">Gestiones</h1>
        <p className="text-sm text-slate-500">Control del ciclo de vida de los procesos comerciales</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi n={kpis.abiertas}   label="Abiertas"  color="#1D9E75" />
        <Kpi n={kpis.pendientes} label="Pendientes (sin próximo paso)" color="#C98A1B" />
        <Kpi n={kpis.vencidas}   label="Vencidas (seguimiento atrasado)" color="#A32D2D" />
        <Kpi n={kpis.cerradas}   label="Cerradas" color="#64748b" />
      </div>

      <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm flex-wrap">
        {FILTROS.map((f) => (
          <button key={f} onClick={() => setFiltro(f)}
                  className={`px-3 py-1.5 ${filtro === f ? 'bg-deep text-white' : 'text-slate-500 hover:bg-paper'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="card divide-y divide-slate-100">
        {lista.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">No hay gestiones en esta vista.</div>
        ) : lista.map((g) => {
          const c = clasif(g)
          const m = agenda[g.id] || {}
          return (
            <button key={g.id} onClick={() => navigate(`/clientes/${g.cliente_id}`)}
                    className="w-full text-left px-4 py-3 hover:bg-paper flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-ink truncate">{[g.clientes?.nombre, g.clientes?.apellidos].filter(Boolean).join(' ') || 'Cliente'}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ color: estadoGestionColor(g.estado), background: estadoGestionColor(g.estado) + '18' }}>
                    {estadoGestionLabel(g.estado)}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {g.titulo || 'Gestión'} · {g.usuarios?.nombre || 'Sin ejecutivo'} · creada {fmtFecha(g.creado_en?.slice(0,10))}
                  {!g.abierta && g.cerrada_en && <> · cerrada {fmtFecha(g.cerrada_en.slice(0,10))} ({motivoCierreLabel(g.motivo_cierre)})</>}
                </div>
              </div>
              <div className="text-right shrink-0">
                {c === 'aldia'     && <span className="text-xs text-deep">Próximo: {fmtFecha(m.prox)}</span>}
                {c === 'vencida'   && <span className="text-xs text-red-500 font-medium">Vencida: {fmtFecha(m.pasada)}</span>}
                {c === 'pendiente' && <span className="text-xs text-amber-600">Sin próximo paso</span>}
                {c === 'cerrada'   && <span className="text-xs text-slate-400">Cerrada</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
