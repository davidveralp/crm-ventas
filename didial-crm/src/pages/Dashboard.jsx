import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, FunnelChart, Funnel, LabelList
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { StatCard } from '../components/UI'
import { SEGMENTOS, fmtCLP, fmtFecha, TIPOS_ACTIVIDAD } from '../lib/helpers'

export default function Dashboard() {
  const { perfil, esAdmin } = useAuth()
  const [m, setM] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [clientes, estados, actividades] = await Promise.all([
      supabase.from('clientes').select('id,segmento,facturacion_total,estado_id,ultima_visita'),
      supabase.from('pipeline_estados').select('id,nombre,orden,color').order('orden'),
      supabase.from('actividades')
        .select('id,tipo,fecha,resultado,clientes(nombre)')
        .order('fecha', { ascending: false }).limit(8)
    ])

    const cs = clientes.data || []
    const es = estados.data || []

    // Embudo por estado
    const embudo = es.map((e) => ({
      name: e.nombre,
      value: cs.filter((c) => c.estado_id === e.id).length,
      fill: e.color
    }))

    // Distribución por segmento
    const segs = Object.keys(SEGMENTOS).map((k) => ({
      name: SEGMENTOS[k].label,
      value: cs.filter((c) => c.segmento === k).length,
      fill: SEGMENTOS[k].color
    })).filter((s) => s.value > 0)

    const vendido = es.find((e) => e.nombre === 'Vendido')
    const cerrados = vendido ? cs.filter((c) => c.estado_id === vendido.id).length : 0
    const conversion = cs.length ? Math.round((cerrados / cs.length) * 100) : 0

    setM({
      totalClientes: cs.length,
      facturacion: cs.reduce((a, c) => a + Number(c.facturacion_total || 0), 0),
      conversion,
      embudo,
      segs,
      actividades: actividades.data || []
    })
  }

  if (!m) return <div className="text-slate-400 text-sm">Cargando dashboard…</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Hola, {perfil?.nombre?.split(' ')[0]}</h1>
        <p className="text-sm text-slate-500">
          {esAdmin ? 'Vista general de la cartera comercial' : 'Tu cartera asignada'}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard titulo="Clientes" valor={m.totalClientes} />
        <StatCard titulo="Facturación cartera" valor={fmtCLP(m.facturacion)} />
        <StatCard titulo="Tasa de conversión" valor={`${m.conversion}%`} sub="Vendidos / total" />
        <StatCard titulo="Actividades recientes" valor={m.actividades.length} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-semibold text-ink mb-4">Embudo de ventas</h3>
          {m.embudo.some((e) => e.value > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <FunnelChart>
                <Tooltip />
                <Funnel dataKey="value" data={m.embudo} isAnimationActive>
                  <LabelList position="right" fill="#0A0B0C" stroke="none"
                             dataKey="name" className="text-xs" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-slate-400">Sin clientes en el pipeline aún.</p>}
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-ink mb-4">Clientes por segmento</h3>
          {m.segs.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Tooltip />
                <Pie data={m.segs} dataKey="value" nameKey="name"
                     cx="50%" cy="50%" outerRadius={90} label={(e) => e.value}>
                  {m.segs.map((s, i) => <Cell key={i} fill={s.fill} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-slate-400">Aún no hay segmentos cargados.</p>}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-ink mb-4">Actividad reciente</h3>
        {m.actividades.length ? (
          <div className="divide-y divide-slate-100">
            {m.actividades.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2.5">
                <div>
                  <span className="text-sm font-medium text-ink">
                    {a.clientes?.nombre || 'Cliente'}
                  </span>
                  <span className="text-sm text-slate-500"> · {TIPOS_ACTIVIDAD[a.tipo] || a.tipo}</span>
                </div>
                <span className="text-xs text-slate-400">{fmtFecha(a.fecha)}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-slate-400">Sin actividades registradas.</p>}
      </div>
    </div>
  )
}
