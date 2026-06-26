import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import { supabase, fetchAllRows } from '../lib/supabase'
import { StatCard } from '../components/UI'
import { SEGMENTOS, segLabel, fmtCLP } from '../lib/helpers'

export default function Informes() {
  const [d, setD] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [clientes, { data: usuarios }, { data: estados }, { data: act }, { data: camp }, { data: presup }] =
      await Promise.all([
        fetchAllRows('clientes', 'id,segmento,estado_id,vendedor_id,facturacion_total'),
        supabase.from('usuarios').select('id,nombre').eq('rol', 'vendedor').eq('activo', true),
        supabase.from('pipeline_estados').select('*').order('orden'),
        supabase.from('actividades').select('cliente_id,vendedor_id,resultado,campana_id').limit(8000),
        supabase.from('campanas').select('id,nombre,segmento').order('prioridad'),
        supabase.from('presupuestos').select('estado,monto').limit(5000)
      ])
    setD({ clientes: clientes || [], usuarios: usuarios || [], estados: estados || [],
           act: act || [], camp: camp || [], presup: presup || [] })
  }

  const r = useMemo(() => {
    if (!d) return null
    const wonEstado = d.estados.find((e) => e.clave === 'servicio' || e.nombre === 'Servicio realizado' || e.nombre === 'Vendido')
    const wonId = wonEstado?.id

    const embudo = d.estados.map((e) => ({
      name: e.nombre, value: d.clientes.filter((c) => c.estado_id === e.id).length, fill: e.color
    }))
    const segs = Object.keys(SEGMENTOS).map((k) => ({
      name: SEGMENTOS[k].label, value: d.clientes.filter((c) => c.segmento === k).length, fill: SEGMENTOS[k].color
    })).filter((s) => s.value > 0)

    const porVendedor = d.usuarios.map((u) => {
      const asignados = d.clientes.filter((c) => c.vendedor_id === u.id)
      const contactos = d.act.filter((a) => a.vendedor_id === u.id && a.resultado !== 'pendiente').length
      const conv = wonId ? asignados.filter((c) => c.estado_id === wonId).length : 0
      return { nombre: u.nombre, asignados: asignados.length, contactos, conv,
               tasa: asignados.length ? Math.round((conv / asignados.length) * 100) : 0 }
    })

    const porCampana = d.camp.map((cp) => {
      const ids = new Set(d.act.filter((a) => a.campana_id === cp.id).map((a) => a.cliente_id))
      let cohorte = ids
      if (!cohorte.size && cp.segmento) cohorte = new Set(d.clientes.filter((c) => c.segmento === cp.segmento).map((c) => c.id))
      const contactados = new Set(d.act.filter((a) => a.campana_id === cp.id && a.resultado !== 'pendiente').map((a) => a.cliente_id))
      const conv = wonId ? [...cohorte].filter((id) => d.clientes.find((c) => c.id === id)?.estado_id === wonId).length : 0
      return { nombre: cp.nombre, cohorte: cohorte.size, contactados: contactados.size, conv,
               tasa: cohorte.size ? Math.round((conv / cohorte.size) * 100) : 0 }
    }).filter((x) => x.cohorte > 0)

    const enJuego = d.presup.filter((p) => ['enviado', 'en_seguimiento'].includes(p.estado))
      .reduce((a, p) => a + Number(p.monto || 0), 0)
    const ganado = d.presup.filter((p) => p.estado === 'aprobado').reduce((a, p) => a + Number(p.monto || 0), 0)

    const facturacion = d.clientes.reduce((a, c) => a + Number(c.facturacion_total || 0), 0)
    const convTotal = wonId ? d.clientes.filter((c) => c.estado_id === wonId).length : 0

    return { embudo, segs, porVendedor, porCampana, enJuego, ganado, facturacion,
             totalClientes: d.clientes.length,
             conversionGlobal: d.clientes.length ? Math.round((convTotal / d.clientes.length) * 100) : 0 }
  }, [d])

  if (!r) return <div className="text-slate-400 text-sm">Cargando informes…</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Informes</h1>
        <p className="text-sm text-slate-500">Resumen de gestión comercial · administración</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard titulo="Clientes" valor={r.totalClientes} />
        <StatCard titulo="Conversión global" valor={`${r.conversionGlobal}%`} />
        <StatCard titulo="Presupuestos en juego" valor={fmtCLP(r.enJuego)} />
        <StatCard titulo="Presupuestos aprobados" valor={fmtCLP(r.ganado)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <h3 className="font-semibold text-ink mb-3">Embudo por estado</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={r.embudo}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value">{r.embudo.map((e, i) => <Cell key={i} fill={e.fill} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-ink mb-3">Clientes por segmento</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={r.segs} layout="vertical">
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value">{r.segs.map((e, i) => <Cell key={i} fill={e.fill} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-ink mb-3">Desempeño por vendedor</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left font-medium py-2">Vendedor</th>
                <th className="text-right font-medium py-2">Asignados</th>
                <th className="text-right font-medium py-2">Contactos</th>
                <th className="text-right font-medium py-2">Convertidos</th>
                <th className="text-right font-medium py-2">Conversión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {r.porVendedor.map((v) => (
                <tr key={v.nombre}>
                  <td className="py-2 font-medium text-ink">{v.nombre}</td>
                  <td className="py-2 text-right">{v.asignados}</td>
                  <td className="py-2 text-right">{v.contactos}</td>
                  <td className="py-2 text-right">{v.conv}</td>
                  <td className="py-2 text-right font-medium">{v.tasa}%</td>
                </tr>
              ))}
              {r.porVendedor.length === 0 && (
                <tr><td colSpan="5" className="py-4 text-center text-slate-400">Sin vendedores activos.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-ink mb-3">Efectividad por campaña</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left font-medium py-2">Campaña</th>
                <th className="text-right font-medium py-2">Cohorte</th>
                <th className="text-right font-medium py-2">Contactados</th>
                <th className="text-right font-medium py-2">Convertidos</th>
                <th className="text-right font-medium py-2">Conversión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {r.porCampana.map((c) => (
                <tr key={c.nombre}>
                  <td className="py-2 font-medium text-ink">{c.nombre}</td>
                  <td className="py-2 text-right">{c.cohorte}</td>
                  <td className="py-2 text-right">{c.contactados}</td>
                  <td className="py-2 text-right">{c.conv}</td>
                  <td className="py-2 text-right font-medium">{c.tasa}%</td>
                </tr>
              ))}
              {r.porCampana.length === 0 && (
                <tr><td colSpan="5" className="py-4 text-center text-slate-400">Aún no hay campañas con clientes cargados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
