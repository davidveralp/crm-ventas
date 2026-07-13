import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, fetchAllRows } from '../lib/supabase'
import { StatCard } from '../components/UI'
import { fmtCLP } from '../lib/helpers'

export default function Pipeline() {
  const navigate = useNavigate()
  const [estados, setEstados] = useState([])
  const [clientes, setClientes] = useState([])
  const [campanas, setCampanas] = useState([])
  const [actividades, setActividades] = useState([])
  const [auditoria, setAuditoria] = useState([])
  const [campFiltro, setCampFiltro] = useState('')
  const [arrastrado, setArrastrado] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: e }, c, { data: camp }, { data: act }, { data: aud }] = await Promise.all([
      supabase.from('pipeline_estados').select('*').order('orden'),
      fetchAllRows('clientes', 'id,nombre,facturacion_total,estado_id,segmento,vendedor_id'),
      supabase.from('campanas').select('id,nombre,segmento').order('prioridad'),
      supabase.from('actividades').select('cliente_id,resultado,campana_id').limit(5000),
      supabase.from('auditoria').select('entidad_id,ocurrido_en').eq('entidad', 'cliente').eq('campo', 'estado_id').limit(8000)
    ])
    setEstados(e || []); setClientes(c || [])
    setCampanas(camp || []); setActividades(act || []); setAuditoria(aud || [])
  }

  async function soltar(estado_id) {
    if (!arrastrado) return
    setClientes((prev) => prev.map((c) => c.id === arrastrado ? { ...c, estado_id } : c))
    await supabase.from('clientes').update({ estado_id }).eq('id', arrastrado)
    setArrastrado(null)
  }

  // Cohorte según filtro de campaña
  const campSel = campanas.find((c) => c.id === campFiltro)
  const cohorteIds = useMemo(() => {
    if (!campSel) return null
    const porTarea = new Set(actividades.filter((a) => a.campana_id === campSel.id).map((a) => a.cliente_id))
    if (porTarea.size) return porTarea
    // Fallback: por segmento de la campaña
    return new Set(clientes.filter((c) => campSel.segmento && c.segmento === campSel.segmento).map((c) => c.id))
  }, [campSel, actividades, clientes])

  const visibles = useMemo(
    () => (cohorteIds ? clientes.filter((c) => cohorteIds.has(c.id)) : clientes),
    [clientes, cohorteIds]
  )

  // Métricas
  const m = useMemo(() => {
    const cohorte = visibles
    const total = cohorte.length
    const ids = new Set(cohorte.map((c) => c.id))
    const wonEstado = estados.find((e) => e.clave === 'servicio' || e.nombre === 'Servicio realizado' || e.nombre === 'Vendido')
    const contactados = new Set(
      actividades.filter((a) => ids.has(a.cliente_id) && a.resultado && a.resultado !== 'pendiente')
                 .map((a) => a.cliente_id)
    )
    const convertidos = wonEstado ? cohorte.filter((c) => c.estado_id === wonEstado.id).length : 0

    // Tiempo promedio entre etapas (días) desde auditoría
    const porCliente = {}
    auditoria.forEach((a) => {
      if (!ids.has(a.entidad_id)) return
      ;(porCliente[a.entidad_id] ||= []).push(new Date(a.ocurrido_en).getTime())
    })
    let suma = 0, n = 0
    Object.values(porCliente).forEach((ts) => {
      ts.sort((a, b) => a - b)
      for (let i = 1; i < ts.length; i++) { suma += (ts[i] - ts[i - 1]); n++ }
    })
    const diasProm = n ? (suma / n) / 864e5 : null

    return {
      total,
      tasaContacto: total ? Math.round((contactados.size / total) * 100) : 0,
      tasaConversion: total ? Math.round((convertidos / total) * 100) : 0,
      efectividad: contactados.size ? Math.round((convertidos / contactados.size) * 100) : 0,
      diasProm
    }
  }, [visibles, actividades, auditoria, estados])

  const sinEstado = visibles.filter((c) => !c.estado_id)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-ink">Pipeline</h1>
          <p className="text-sm text-slate-500">Arrastra las tarjetas para cambiar de etapa</p>
        </div>
        <select className="input md:max-w-xs" value={campFiltro} onChange={(e) => setCampFiltro(e.target.value)}>
          <option value="">Todas las campañas</option>
          {campanas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard titulo="En cohorte" valor={m.total} sub={campSel ? campSel.nombre : 'Todos'} />
        <StatCard titulo="Tasa de contacto" valor={`${m.tasaContacto}%`} />
        <StatCard titulo="Tasa de conversión" valor={`${m.tasaConversion}%`} />
        <StatCard titulo="Efectividad" valor={`${m.efectividad}%`} sub="cierre sobre contactados" />
        <StatCard titulo="Tiempo entre etapas" valor={m.diasProm != null ? `${m.diasProm.toFixed(1)} d` : '—'} />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {sinEstado.length > 0 && (
          <Columna titulo="Sin clasificar" color="#94a3b8" clientes={sinEstado}
                   onDragStart={setArrastrado} onDrop={() => soltar(null)} navigate={navigate} />
        )}
        {estados.map((e) => (
          <Columna key={e.id} titulo={e.nombre} color={e.color}
                   clientes={visibles.filter((c) => c.estado_id === e.id)}
                   onDragStart={setArrastrado} onDrop={() => soltar(e.id)} navigate={navigate} />
        ))}
      </div>
    </div>
  )
}

function Columna({ titulo, color, clientes, onDragStart, onDrop, navigate }) {
  const total = clientes.reduce((a, c) => a + Number(c.facturacion_total || 0), 0)
  return (
    <div className="w-72 shrink-0" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          <span className="text-sm font-semibold text-ink">{titulo}</span>
          <span className="text-xs text-slate-400">{clientes.length}</span>
        </div>
      </div>
      <div className="text-[11px] text-slate-400 px-1 mb-2">{fmtCLP(total)}</div>
      <div className="space-y-2 min-h-[120px] bg-paper rounded-xl p-2">
        {clientes.map((c) => (
          <div key={c.id} draggable
               onDragStart={() => onDragStart(c.id)}
               onClick={() => navigate(`/clientes/${c.id}`)}
               className="card p-3 cursor-grab active:cursor-grabbing hover:border-sky">
            <div className="text-sm font-medium text-ink truncate">{c.nombre}</div>
            <div className="text-xs text-slate-400 mt-0.5">{fmtCLP(c.facturacion_total)}</div>
          </div>
        ))}
        {clientes.length === 0 && (
          <div className="text-center text-xs text-slate-300 py-6">Vacío</div>
        )}
      </div>
    </div>
  )
}
