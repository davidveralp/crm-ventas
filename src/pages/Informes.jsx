import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import { supabase, fetchAllRows } from '../lib/supabase'
import { StatCard } from '../components/UI'
import { SEGMENTOS, segLabel, fmtCLP, TIPOS_SERVICIO } from '../lib/helpers'
import * as XLSX from 'xlsx'
import PanelOperativo from './PanelOperativo'
import MapaClientes from './MapaClientes'

export default function Informes() {
  const [d, setD] = useState(null)
  const [vista, setVista] = useState('operativo')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [clientes, { data: usuarios }, { data: estados }, { data: act }, { data: camp }, { data: presup }, { data: srv }, { data: ges }] =
      await Promise.all([
        fetchAllRows('clientes', 'id,segmento,estado_id,vendedor_id,facturacion_total'),
        supabase.from('usuarios').select('id,nombre').in('rol', ['vendedor', 'asesor_toyota', 'asesor_multimarca']).eq('activo', true),
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
      <button onClick={() => setVista('mapa')} className={`px-3 py-1.5 ${vista === 'mapa' ? 'bg-deep text-white' : 'text-slate-500'}`}>Mapa de clientes</button>
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

  if (vista === 'mapa') return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Informes</h1>
          <p className="text-sm text-slate-500">Distribución geográfica de clientes · Región de Coquimbo</p>
        </div>
        <Tabs />
      </div>
      <MapaClientes />
    </div>
  )

  if (!r) return <div className="text-slate-400 text-sm">Cargando informes…</div>

  const hoyStr = new Date().toLocaleString('es-CL')
  const slug = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  /* Referencias de gestión comercial. Fuente: estudio de industria de postventa
     julio 2026 (La Serena–Coquimbo). Órdenes de magnitud, no umbrales contractuales. */
  const refComercial = [
    { ind: 'Conversión de campaña', valor: r.conversionGlobal, unidad: '%', meta: 'Sobre 15%', alerta: 'Bajo 5%',
      estado: r.conversionGlobal >= 15 ? 'En meta' : r.conversionGlobal >= 5 ? 'Vigilar' : 'Fuera de meta',
      rec: 'Revisar calidad de la audiencia y el guion de contacto antes de aumentar el volumen de llamadas.' },
    { ind: 'Tiempo de cierre de gestión', valor: r.gestion.diasCierre, unidad: 'días', meta: 'Bajo 7 días', alerta: 'Sobre 15 días',
      estado: r.gestion.diasCierre <= 7 ? 'En meta' : r.gestion.diasCierre <= 15 ? 'Vigilar' : 'Fuera de meta',
      rec: 'Una gestión que se alarga pierde intención de compra. Definir cierre forzado por antigüedad.' },
    { ind: 'Días entre contactos', valor: r.gestion.diasEntreContactos, unidad: 'días', meta: '3 a 7 días', alerta: 'Sobre 14 días',
      estado: r.gestion.diasEntreContactos >= 3 && r.gestion.diasEntreContactos <= 7 ? 'En meta' : r.gestion.diasEntreContactos <= 14 ? 'Vigilar' : 'Fuera de meta',
      rec: 'Cadencia irregular de seguimiento. Programar el próximo contacto al cerrar cada actividad.' },
    { ind: 'Gestiones abiertas', valor: r.gestion.abiertas, unidad: 'unidades', meta: 'Todas con próximo paso', alerta: 'Sin actividad 30 días',
      estado: 'Vigilar',
      rec: 'Depurar gestiones sin actividad reciente: inflan el pipeline y ocultan el embudo real.' }
  ]

  function exportarComercialPDF() { window.print() }

  function exportarComercialExcel() {
    const wb = XLSX.utils.book_new()
    const add = (nombre, datos, anchos) => {
      const ws = XLSX.utils.json_to_sheet(datos)
      if (anchos) ws['!cols'] = anchos.map((w) => ({ wch: w }))
      XLSX.utils.book_append_sheet(wb, ws, nombre.slice(0, 31))
    }

    add('Resumen', [
      { Indicador: 'Generado', Valor: hoyStr },
      { Indicador: 'Clientes en cartera', Valor: r.totalClientes },
      { Indicador: 'Conversión global (%)', Valor: r.conversionGlobal },
      { Indicador: 'Presupuestos en juego', Valor: Math.round(r.enJuego) },
      { Indicador: 'Presupuestos aprobados', Valor: Math.round(r.ganado) },
      { Indicador: 'Facturación asociada', Valor: Math.round(r.facturacion || 0) },
      { Indicador: 'Gestiones abiertas', Valor: r.gestion.abiertas },
      { Indicador: 'Gestiones cerradas', Valor: r.gestion.cerradas },
      { Indicador: 'Días promedio de cierre', Valor: r.gestion.diasCierre },
      { Indicador: 'Días promedio entre contactos', Valor: r.gestion.diasEntreContactos }
    ], [32, 18])

    add('KPIs con alerta', refComercial.map((x) => ({
      Indicador: x.ind, Valor: x.valor, Unidad: x.unidad, Meta: x.meta,
      'Zona de alerta': x.alerta, Estado: x.estado, 'Recomendación': x.rec
    })), [28, 10, 10, 22, 20, 14, 62])

    add('Embudo estados', r.embudo.map((x) => ({ Estado: x.name, Clientes: x.value })), [26, 12])
    add('Segmentos', r.segs.map((x) => ({ Segmento: x.name, Clientes: x.value })), [26, 12])
    add('Servicios solicitados', r.servicios.map((x) => ({ Servicio: x.name, Solicitudes: x.value })), [30, 12])
    add('Embudo campanas', r.funnel.map((c) => ({
      Campaña: c.nombre, Incluidos: c.incluidos, Contactados: c.contactados, 'No contactados': c.noContactados,
      Devolución: c.devolucion, Agendados: c.agendados, Asistieron: c.asistieron, 'No asistieron': c.noAsistieron,
      Aceptados: c.aceptados, Rechazados: c.rechazados, 'Conversión %': c.conversion
    })), [30, 10, 12, 14, 12, 11, 11, 13, 11, 11, 13])
    add('Vendedores', r.vendedores.map((v) => ({
      Vendedor: v.nombre, Llamadas: v.llamadas, 'Contactabilidad %': v.contactabilidad,
      Agendamientos: v.agendamientos, Asistencias: v.asistencias, 'Conversión %': v.conversion
    })), [24, 11, 17, 14, 12, 13])

    XLSX.writeFile(wb, `informe-comercial-didial-${slug}.xlsx`)
  }

  return (
    <div className="space-y-6" id="panel-print">
      {/* Solo impresión: encabezado y pie repetidos */}
      <div className="solo-impresion encabezado-hoja">
        <img src="/logo-didial.png" alt="DIDIAL" />
        <span>Informe comercial · {hoyStr}</span>
      </div>
      <div className="solo-impresion pie-hoja">
        <span>Servicio Automotriz Didial Ltda. · Gestión comercial</span>
        <span>Rangos de referencia de gestión, no umbrales contractuales</span>
      </div>

      {/* Portada (solo impresión) */}
      <div className="solo-impresion portada">
        <img src="/logo-didial.png" alt="DIDIAL Servicio Automotriz" className="portada-logo" />
        <h1>Informe Comercial</h1>
        <p className="portada-sub">Servicio Automotriz Didial Ltda. · La Serena</p>
        <table className="portada-datos">
          <tbody>
            <tr><td>Clientes en cartera</td><td>{r.totalClientes}</td></tr>
            <tr><td>Conversión global</td><td>{r.conversionGlobal}%</td></tr>
            <tr><td>Presupuestos en juego</td><td>{fmtCLP(r.enJuego)}</td></tr>
            <tr><td>Presupuestos aprobados</td><td>{fmtCLP(r.ganado)}</td></tr>
            <tr><td>Gestiones abiertas</td><td>{r.gestion.abiertas}</td></tr>
            <tr><td>Generado</td><td>{hoyStr}</td></tr>
          </tbody>
        </table>
        <p className="portada-nota">
          Informe de gestión comercial construido sobre los datos del CRM (cartera, campañas y gestiones).
          No incluye la venta de taller, que se reporta en el Panel Operativo a partir de la base de órdenes de trabajo.
        </p>
      </div>

      <div className="flex items-end justify-between flex-wrap gap-3 no-print">
        <div>
          <h1 className="text-xl font-bold text-ink">Informes</h1>
          <p className="text-sm text-slate-500">Resumen de gestión comercial · administración</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportarComercialPDF} className="btn-soft text-sm" title="Abre el diálogo de impresión: elige 'Guardar como PDF'">📄 PDF</button>
          <button onClick={exportarComercialExcel} className="btn-soft text-sm" title="Descarga el detalle comercial">📊 Excel</button>
          <Tabs />
        </div>
      </div>

      {/* Indicadores comerciales con alerta */}
      <div className="card p-5">
        <h3 className="font-semibold text-ink mb-1">Indicadores comerciales con alerta</h3>
        <p className="text-[11px] text-slate-400 mb-3">
          Evaluados contra rangos de gestión de postventa (estudio de industria julio 2026, La Serena–Coquimbo).
          Son órdenes de magnitud de gestión, no percentiles calculados sobre una muestra de talleres chilenos comparables.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {refComercial.map((x) => {
            const col = x.estado === 'En meta' ? '#1f9d57' : x.estado === 'Vigilar' ? '#e0a020' : '#e0382b'
            const bg = x.estado === 'En meta' ? '#e8f6ee' : x.estado === 'Vigilar' ? '#fdf6e3' : '#fdecea'
            return (
              <div key={x.ind} className="card p-3 border-l-4" style={{ borderLeftColor: col }}>
                <div className="flex items-start justify-between gap-1">
                  <span className="text-xs text-slate-500">{x.ind}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap" style={{ background: bg, color: col }}>{x.estado}</span>
                </div>
                <div className="text-2xl font-semibold text-ink mt-0.5">{x.valor}{x.unidad === '%' ? '%' : x.unidad === 'días' ? ' d' : ''}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Meta: {x.meta}</div>
              </div>
            )
          })}
        </div>
        <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] observaciones">
          <strong className="text-slate-500">Observaciones y recomendaciones</strong>
          <ul className="mt-1 space-y-1">
            {refComercial.filter((x) => x.estado !== 'En meta').map((x) => (
              <li key={x.ind} className="text-slate-600"><strong>{x.ind}:</strong> {x.rec}</li>
            ))}
            {refComercial.every((x) => x.estado === 'En meta') && <li className="text-slate-400">Todos los indicadores comerciales están dentro de meta.</li>}
          </ul>
        </div>
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
