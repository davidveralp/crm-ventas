import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import { supabase, fetchAllRows } from '../lib/supabase'
import { StatCard } from '../components/UI'
import { SEGMENTOS, segLabel, fmtCLP, TIPOS_SERVICIO } from '../lib/helpers'
import PanelOperativo from './PanelOperativo'

export default function Informes() {
  const [d, setD] = useState(null)
  const [vista, setVista] = useState('operativo')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [clientes, { data: usuarios }, { data: estados }, { data: act }, { data: camp }, { data: presup }, { data: srv }, { data: ges }] =
      await Promise.all([
        fetchAllRows('clientes', 'id,segmento,estado_id,vendedor_id,facturacion_total'),
        supabase.from('usuarios').select('id,nombre').eq('rol', 'vendedor').eq('activo', true),
        supabase.from('pipeline_estados').select('*').order('orden'),
        supabase.from('actividades').select('cliente_id,vendedor_id,resultado,campana_id,tipo_servicio,gestion_id,fecha,tipo').limit(12000),
        supabase.from('campanas').select('id,nombre,segmento,estado').order('prioridad'),
        supabase.from('presupuestos').select('estado,monto,tipo_servicio,gestion_id,cliente_id').limit(5000),
        supabase.from('servicios').select('tipo_servicio,tipo_servicio_2').limit(20000),
        supabase.from('gestiones').select('id,cliente_id,campana_id,vendedor_id,estado,abierta,creado_en,cerrada_en').limit(12000)
      ])
    setD({ clientes: clientes || [], usuarios: usuarios || [], estados: estados || [],
           act: act || [], camp: camp || [], presup: presup || [], servicios: srv || [], gestiones: ges || [] })
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

    // Servicios más solicitados (actividades + presupuestos + historial de OT)
    const conteoServ = {}
    const sumar = (arr) => arr.forEach((x) => {
      if (x.tipo_servicio) {
        const etiqueta = TIPOS_SERVICIO[x.tipo_servicio] || x.tipo_servicio
        conteoServ[etiqueta] = (conteoServ[etiqueta] || 0) + 1
      }
    })
    sumar(d.act); sumar(d.presup); sumar(d.servicios)
    // El segundo servicio de cada OT también suma
    d.servicios.forEach((x) => {
      if (x.tipo_servicio_2) {
        const etiqueta = TIPOS_SERVICIO[x.tipo_servicio_2] || x.tipo_servicio_2
        conteoServ[etiqueta] = (conteoServ[etiqueta] || 0) + 1
      }
    })
    const servicios = Object.entries(conteoServ)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // ===== Reportes de efectividad comercial =====
    const REAL = (res) => !['pendiente', 'no_contesta', 'numero_erroneo'].includes(res)
    const AGENDA_PLUS = ['agendada', 'asistio', 'presupuesto_entregado', 'pendiente_decision', 'cerrada_ganada']
    const ASISTIO_PLUS = ['asistio', 'presupuesto_entregado', 'pendiente_decision', 'cerrada_ganada']

    // Mapa gestión -> campaña (directo o inferido por sus actividades)
    const gestCampana = {}
    d.gestiones.forEach((g) => { if (g.campana_id) gestCampana[g.id] = g.campana_id })
    d.act.forEach((a) => { if (a.gestion_id && a.campana_id && !gestCampana[a.gestion_id]) gestCampana[a.gestion_id] = a.campana_id })

    // --- Embudo por campaña ---
    const funnel = d.camp.map((cp) => {
      const actsC = d.act.filter((a) => a.campana_id === cp.id)
      const incluidos = new Set(actsC.map((a) => a.cliente_id))
      const contactados = new Set(actsC.filter((a) => REAL(a.resultado)).map((a) => a.cliente_id))
      const devolucion = new Set(actsC.filter((a) => a.resultado === 'reagendar').map((a) => a.cliente_id))
      const agendados = new Set(actsC.filter((a) => a.resultado === 'agendado').map((a) => a.cliente_id))
      const asistieron = new Set(), ventas = new Set()
      d.gestiones.forEach((g) => {
        if (gestCampana[g.id] !== cp.id) return
        if (AGENDA_PLUS.includes(g.estado)) agendados.add(g.cliente_id)
        if (ASISTIO_PLUS.includes(g.estado)) asistieron.add(g.cliente_id)
        if (g.estado === 'cerrada_ganada') ventas.add(g.cliente_id)
      })
      const noAsistieron = [...agendados].filter((id) => !asistieron.has(id)).length
      const presC = d.presup.filter((p) => p.gestion_id && gestCampana[p.gestion_id] === cp.id)
      const aceptados = new Set(presC.filter((p) => p.estado === 'aprobado').map((p) => p.cliente_id)).size
      const rechazados = new Set(presC.filter((p) => p.estado === 'rechazado').map((p) => p.cliente_id)).size
      return {
        nombre: cp.nombre, estado: cp.estado,
        incluidos: incluidos.size, contactados: contactados.size, noContactados: incluidos.size - contactados.size,
        devolucion: devolucion.size, agendados: agendados.size, asistieron: asistieron.size, noAsistieron,
        aceptados, rechazados,
        conversion: incluidos.size ? Math.round((ventas.size / incluidos.size) * 100) : 0
      }
    }).filter((x) => x.incluidos > 0)

    // --- Desempeño por vendedor ---
    const vendedores = d.usuarios.map((u) => {
      const acts = d.act.filter((a) => a.vendedor_id === u.id)
      const llamadas = acts.filter((a) => a.tipo === 'llamada').length
      const contactReal = acts.filter((a) => REAL(a.resultado)).length
      const contactabilidad = acts.length ? Math.round((contactReal / acts.length) * 100) : 0
      const agendamientos = acts.filter((a) => a.resultado === 'agendado').length
      const ges = d.gestiones.filter((g) => g.vendedor_id === u.id)
      const asistencias = ges.filter((g) => ASISTIO_PLUS.includes(g.estado)).length
      const trabajados = new Set(acts.map((a) => a.cliente_id)).size
      const ventas = ges.filter((g) => g.estado === 'cerrada_ganada').length
      return { nombre: u.nombre, llamadas, contactabilidad, agendamientos, asistencias,
               conversion: trabajados ? Math.round((ventas / trabajados) * 100) : 0 }
    })

    // --- Métricas de gestión ---
    const abiertasG = d.gestiones.filter((g) => g.abierta).length
    const cerradasG = d.gestiones.filter((g) => !g.abierta).length
    const cerradasCon = d.gestiones.filter((g) => g.cerrada_en && g.creado_en)
    const diasCierre = cerradasCon.length
      ? Math.round(cerradasCon.reduce((a, g) => a + (new Date(g.cerrada_en) - new Date(g.creado_en)) / 86400000, 0) / cerradasCon.length)
      : 0
    const porGest = {}
    d.act.forEach((a) => { if (a.gestion_id && a.fecha) (porGest[a.gestion_id] ||= []).push(a.fecha) })
    let sumaDifs = 0, cuenta = 0
    Object.values(porGest).forEach((fechas) => {
      const fs = fechas.map((f) => new Date(f)).sort((a, b) => a - b)
      for (let i = 1; i < fs.length; i++) { sumaDifs += (fs[i] - fs[i - 1]) / 86400000; cuenta++ }
    })
    const diasEntreContactos = cuenta ? Math.round(sumaDifs / cuenta) : 0
    const gestion = { abiertas: abiertasG, cerradas: cerradasG, diasCierre, diasEntreContactos }

    return { embudo, segs, porVendedor, porCampana, servicios, enJuego, ganado, facturacion,
             funnel, vendedores, gestion,
             totalClientes: d.clientes.length,
             conversionGlobal: d.clientes.length ? Math.round((convTotal / d.clientes.length) * 100) : 0 }
  }, [d])

  const Tabs = () => (
    <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm">
      <button onClick={() => setVista('operativo')} className={`px-3 py-1.5 ${vista === 'operativo' ? 'bg-deep text-white' : 'text-slate-500'}`}>Panel operativo</button>
      <button onClick={() => setVista('comercial')} className={`px-3 py-1.5 ${vista === 'comercial' ? 'bg-deep text-white' : 'text-slate-500'}`}>Comercial</button>
    </div>
  )

  if (vista === 'operativo') return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Informes</h1>
          <p className="text-sm text-slate-500">Panel operativo en vivo · administración</p>
        </div>
        <Tabs />
      </div>
      <PanelOperativo />
    </div>
  )

  if (!r) return <div className="text-slate-400 text-sm">Cargando informes…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Informes</h1>
          <p className="text-sm text-slate-500">Resumen de gestión comercial · administración</p>
        </div>
        <Tabs />
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
        <h3 className="font-semibold text-ink mb-3">Servicios más solicitados</h3>
        {r.servicios.length ? (
          <ResponsiveContainer width="100%" height={Math.max(180, r.servicios.length * 32)}>
            <BarChart data={r.servicios} layout="vertical">
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#2C5A72" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-400">
            Aún no hay servicios registrados. Empieza a etiquetar el "Tipo de servicio" en cada
            seguimiento o presupuesto para alimentar este análisis.
          </p>
        )}
      </div>

      {/* Métricas de gestión */}
      <div className="card p-5">
        <h3 className="font-semibold text-ink mb-3">Gestión comercial</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg bg-paper p-4">
            <div className="text-2xl font-bold text-[#1D9E75]">{r.gestion.abiertas}</div>
            <div className="text-xs text-slate-500">Gestiones abiertas</div>
          </div>
          <div className="rounded-lg bg-paper p-4">
            <div className="text-2xl font-bold text-slate-500">{r.gestion.cerradas}</div>
            <div className="text-xs text-slate-500">Gestiones cerradas</div>
          </div>
          <div className="rounded-lg bg-paper p-4">
            <div className="text-2xl font-bold text-deep">{r.gestion.diasCierre} d</div>
            <div className="text-xs text-slate-500">Tiempo prom. de cierre</div>
          </div>
          <div className="rounded-lg bg-paper p-4">
            <div className="text-2xl font-bold text-deep">{r.gestion.diasEntreContactos} d</div>
            <div className="text-xs text-slate-500">Prom. entre contactos</div>
          </div>
        </div>
      </div>

      {/* Embudo por campaña */}
      <div className="card p-5">
        <h3 className="font-semibold text-ink mb-3">Embudo por campaña</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left font-medium py-2 pr-3">Campaña</th>
                <th className="text-right font-medium py-2 px-2">Incluidos</th>
                <th className="text-right font-medium py-2 px-2">Contactados</th>
                <th className="text-right font-medium py-2 px-2">No contact.</th>
                <th className="text-right font-medium py-2 px-2">Devolución</th>
                <th className="text-right font-medium py-2 px-2">Agendados</th>
                <th className="text-right font-medium py-2 px-2">Asistieron</th>
                <th className="text-right font-medium py-2 px-2">No asist.</th>
                <th className="text-right font-medium py-2 px-2">Acept.</th>
                <th className="text-right font-medium py-2 px-2">Rechaz.</th>
                <th className="text-right font-medium py-2 pl-2">Conv.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {r.funnel.map((c) => (
                <tr key={c.nombre}>
                  <td className="py-2 pr-3 font-medium text-ink">{c.nombre}</td>
                  <td className="py-2 px-2 text-right">{c.incluidos}</td>
                  <td className="py-2 px-2 text-right">{c.contactados}</td>
                  <td className="py-2 px-2 text-right text-slate-400">{c.noContactados}</td>
                  <td className="py-2 px-2 text-right">{c.devolucion}</td>
                  <td className="py-2 px-2 text-right">{c.agendados}</td>
                  <td className="py-2 px-2 text-right">{c.asistieron}</td>
                  <td className="py-2 px-2 text-right text-slate-400">{c.noAsistieron}</td>
                  <td className="py-2 px-2 text-right text-[#1D9E75]">{c.aceptados}</td>
                  <td className="py-2 px-2 text-right text-[#A32D2D]">{c.rechazados}</td>
                  <td className="py-2 pl-2 text-right font-semibold">{c.conversion}%</td>
                </tr>
              ))}
              {r.funnel.length === 0 && (
                <tr><td colSpan="11" className="py-4 text-center text-slate-400">Aún no hay campañas con clientes cargados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Conversión = clientes con venta cerrada / incluidos. "Asistieron" se cuenta cuando la gestión llega a ese estado o posterior.
        </p>
      </div>

      {/* Desempeño por vendedor */}
      <div className="card p-5">
        <h3 className="font-semibold text-ink mb-3">Desempeño por vendedor</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left font-medium py-2">Vendedor</th>
                <th className="text-right font-medium py-2">Llamadas</th>
                <th className="text-right font-medium py-2">Contactabilidad</th>
                <th className="text-right font-medium py-2">Agendamientos</th>
                <th className="text-right font-medium py-2">Asistencias</th>
                <th className="text-right font-medium py-2">Conversión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {r.vendedores.map((v) => (
                <tr key={v.nombre}>
                  <td className="py-2 font-medium text-ink">{v.nombre}</td>
                  <td className="py-2 text-right">{v.llamadas}</td>
                  <td className="py-2 text-right">{v.contactabilidad}%</td>
                  <td className="py-2 text-right">{v.agendamientos}</td>
                  <td className="py-2 text-right">{v.asistencias}</td>
                  <td className="py-2 text-right font-semibold">{v.conversion}%</td>
                </tr>
              ))}
              {r.vendedores.length === 0 && (
                <tr><td colSpan="6" className="py-4 text-center text-slate-400">Sin vendedores activos.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Contactabilidad = contactos con conversación real / total de intentos. Conversión = ventas cerradas / clientes trabajados.
        </p>
      </div>
    </div>
  )
}
