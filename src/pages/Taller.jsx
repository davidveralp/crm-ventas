import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, fetchAllRows } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Modal, Pill } from '../components/UI'
import { notificar } from '../lib/notificar'
import {
  ESTADOS_TALLER, PRIORIDADES_TALLER, ESTADOS_PRESUP_TALLER, fmtCrono, fmtCLP
} from '../lib/helpers'

const ORDEN_ESTADOS = Object.keys(ESTADOS_TALLER)
const ahoraISO = () => new Date().toISOString()

/* Cronómetro del trabajo: tiempo desde el ingreso (vivo si no está cerrado) */
function crono(trabajo, now) {
  const fin = trabajo.cerrado_en ? new Date(trabajo.cerrado_en).getTime() : now
  return Math.floor((fin - new Date(trabajo.creado_en).getTime()) / 1000)
}
const Avatar = ({ nombre }) => (
  <span className="grid place-items-center w-6 h-6 rounded-full bg-deep text-white text-[10px] font-bold uppercase"
        title={nombre}>{(nombre || '?').split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
)
const Bandera = ({ p }) => p !== 'normal' ? (
  <span className="text-[11px] font-semibold" style={{ color: PRIORIDADES_TALLER[p]?.color }}>⚑ {PRIORIDADES_TALLER[p]?.label}</span>
) : null

export default function Taller() {
  const { perfil, esAdmin } = useAuth()
  const rol = perfil?.rol
  const esJefe = esAdmin || rol === 'jefe_taller' || rol === 'supervisor'
  const esTecnico = rol === 'tecnico'
  const esCompras = rol === 'coordinador_adquisiciones' || rol === 'encargado_bodega'

  const [trabajos, setTrabajos] = useState([])
  const [tareas, setTareas] = useState([])
  const [presups, setPresups] = useState([])
  const [diags, setDiags] = useState([])
  const [margenes, setMargenes] = useState({ repuesto: 35, lubricante: 30, filtro: 30, consumible: 25, ajuste_asesor_pct: 10 })
  const [usuarios, setUsuarios] = useState([])
  const [vista, setVista] = useState('tablero') // tablero | lista | tecnicos | indicadores
  const [sel, setSel] = useState(null)          // trabajo abierto en detalle
  const [now, setNow] = useState(Date.now())
  const [cargando, setCargando] = useState(true)

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [t, ta, pr, us, dg, mg] = await Promise.all([
      supabase.from('trabajos_taller').select('*, clientes(nombre), vehiculos(patente,marca,modelo)').order('creado_en', { ascending: false }),
      supabase.from('tareas_taller').select('*').order('orden'),
      supabase.from('presupuestos_taller').select('*').order('creado_en', { ascending: false }),
      supabase.from('usuarios').select('id,nombre,rol,activo'),
      supabase.from('diagnosticos_taller').select('*').order('creado_en'),
      supabase.from('empresa_config').select('valor').eq('empresa_id', perfil.empresa_id).eq('clave', 'margenes').maybeSingle()
    ])
    setTrabajos(t.data || []); setTareas(ta.data || []); setPresups(pr.data || [])
    setDiags(dg.data || [])
    if (mg.data?.valor) setMargenes((m) => ({ ...m, ...mg.data.valor }))
    setUsuarios((us.data || []).filter((u) => u.activo !== false))
    setCargando(false)
  }

  const tecnicos = usuarios.filter((u) => u.rol === 'tecnico' || u.rol === 'jefe_taller')
  const tareasDe = (tid) => tareas.filter((x) => x.trabajo_id === tid)
  const presupsDe = (tid) => presups.filter((x) => x.trabajo_id === tid)
  const nombreDe = (uid) => usuarios.find((u) => u.id === uid)?.nombre || ''
  const tituloDe = (t) => t.titulo || [t.vehiculos?.patente, t.vehiculos?.marca, t.vehiculos?.modelo, t.clientes?.nombre, t.ot_numero ? 'OT ' + t.ot_numero : ''].filter(Boolean).join(' ')

  /* ---- Acciones ---------------------------------------------------- */
  async function moverEstado(t, estado) {
    // Compuerta de garantía: para reparar se exige presupuesto resuelto
    // (aprobado o parcial) + OT firmada + video de respaldo enviado.
    if (estado === 'en_reparacion') {
      const resuelto = presupsDe(t.id).some((p) => ['aprobado', 'parcial'].includes(p.estado))
      const faltas = []
      if (!resuelto) faltas.push('presupuesto aprobado o parcial')
      if (!t.respaldo_ot_firmada) faltas.push('OT firmada ✓')
      if (!t.respaldo_video) faltas.push('video de respaldo enviado ✓')
      if (faltas.length) { alert('Para pasar a Reparación falta: ' + faltas.join(', ') + '.'); return }
    }
    const historial = [...(t.historial || []), { estado, fecha: ahoraISO(), por: perfil?.nombre }]
    const upd = { estado, historial }
    if (estado === 'en_reparacion') { upd.autorizado_por = perfil.id; upd.autorizado_en = ahoraISO() }
    if (estado === 'completada') upd.cerrado_en = ahoraISO()
    await supabase.from('trabajos_taller').update(upd).eq('id', t.id)
    const lbl = ESTADOS_TALLER[estado]?.label || estado
    if (estado === 'listo_entrega' && t.asesor_id) {
      notificar({ empresa_id: perfil.empresa_id, usuario_id: t.asesor_id, titulo: 'Vehículo listo para retiro', cuerpo: tituloDe(t), url: '/taller' })
    } else if (estado === 'esperando_aprobacion' && t.asesor_id) {
      notificar({ empresa_id: perfil.empresa_id, usuario_id: t.asesor_id, titulo: 'Presupuesto listo · conversar con el cliente', cuerpo: tituloDe(t), url: '/taller' })
    } else if (estado === 'compra_repuestos') {
      notificar({ empresa_id: perfil.empresa_id, rol: 'coordinador_adquisiciones', titulo: 'Gestionar adquisición de repuestos', cuerpo: tituloDe(t), url: '/taller' })
    } else if (t.asesor_id) {
      notificar({ empresa_id: perfil.empresa_id, usuario_id: t.asesor_id, titulo: `Taller: ${lbl}`, cuerpo: tituloDe(t), url: '/taller' })
    }
    cargar()
  }
  async function guardarTrabajo(t, campos) {
    await supabase.from('trabajos_taller').update(campos).eq('id', t.id); cargar()
  }
  async function agregarTarea(t, titulo, tecnico_id) {
    if (!titulo.trim()) return
    await supabase.from('tareas_taller').insert({
      empresa_id: perfil.empresa_id, trabajo_id: t.id, titulo: titulo.trim(),
      tecnico_id: tecnico_id || null, orden: tareasDe(t.id).length
    })
    if (tecnico_id) notificar({ empresa_id: perfil.empresa_id, usuario_id: tecnico_id, titulo: 'Nueva tarea asignada', cuerpo: `${titulo} · ${tituloDe(t)}`, url: '/taller' })
    cargar()
  }
  async function asignarTarea(tarea, tecnico_id) {
    await supabase.from('tareas_taller').update({ tecnico_id: tecnico_id || null }).eq('id', tarea.id)
    if (tecnico_id) notificar({ empresa_id: perfil.empresa_id, usuario_id: tecnico_id, titulo: 'Tarea asignada', cuerpo: tarea.titulo, url: '/taller' })
    cargar()
  }
  async function iniciarTarea(tarea) {
    await supabase.from('tareas_taller').update({ estado: 'en_curso', iniciada_en: ahoraISO() }).eq('id', tarea.id)
    cargar()
  }
  async function terminarTarea(tarea, observacion) {
    if (!observacion?.trim()) return alert('La observación es obligatoria al terminar la tarea.')
    const extra = tarea.iniciada_en ? Math.floor((Date.now() - new Date(tarea.iniciada_en).getTime()) / 1000) : 0
    await supabase.from('tareas_taller').update({
      estado: 'terminada', observacion: observacion.trim(),
      terminada_en: ahoraISO(), tiempo_seg: (tarea.tiempo_seg || 0) + extra, iniciada_en: null
    }).eq('id', tarea.id)
    cargar()
  }
  async function terminarTodas(t) {
    notificar({ empresa_id: perfil.empresa_id, rol: 'jefe_taller', titulo: 'Tareas terminadas · pendiente prueba en ruta', cuerpo: tituloDe(t), url: '/taller' })
    await moverEstado(t, 'prueba_ruta')
  }
  async function eliminarTarea(tarea) { await supabase.from('tareas_taller').delete().eq('id', tarea.id); cargar() }

  async function agregarDiag(t, d) {
    if (!d.item?.trim()) return
    await supabase.from('diagnosticos_taller').insert({
      empresa_id: perfil.empresa_id, trabajo_id: t.id, item: d.item.trim(),
      severidad: d.severidad || 'preventivo', recomendacion: (d.recomendacion || '').trim(),
      tecnico_id: perfil.id
    })
    cargar()
  }
  async function borrarDiag(id) { await supabase.from('diagnosticos_taller').delete().eq('id', id); cargar() }

  // Diagnóstico → presupuesto en un clic (hallazgos como ítems a cotizar)
  async function diagAPresupuesto(t) {
    const hallazgos = diags.filter((d) => d.trabajo_id === t.id && d.severidad !== 'ok')
    if (!hallazgos.length) return alert('No hay hallazgos del diagnóstico para presupuestar.')
    const items = hallazgos.map((d) => ({
      tipo: 'repuesto', codigo: '', detalle: d.item + (d.recomendacion ? ' — ' + d.recomendacion : ''),
      cant: 1, costo: 0, precio: 0, en_stock: null, severidad: d.severidad
    }))
    await supabase.from('presupuestos_taller').insert({
      empresa_id: perfil.empresa_id, trabajo_id: t.id, items,
      notas: 'Generado desde el diagnóstico', solicitado_por: perfil.id, estado: 'cotizando'
    })
    notificar({ empresa_id: perfil.empresa_id, rol: 'coordinador_adquisiciones', titulo: 'Diagnóstico listo · cotizar presupuesto', cuerpo: tituloDe(t), url: '/taller' })
    notificar({ empresa_id: perfil.empresa_id, rol: 'encargado_bodega', titulo: 'Revisar stock para presupuesto', cuerpo: tituloDe(t), url: '/taller' })
    cargar()
  }

  async function marcarRespaldo(t, campo, valor) {
    await supabase.from('trabajos_taller').update({ [campo]: valor }).eq('id', t.id); cargar()
  }

  async function solicitarPresupuesto(t, notas) {
    await supabase.from('presupuestos_taller').insert({
      empresa_id: perfil.empresa_id, trabajo_id: t.id, notas: notas || '', solicitado_por: perfil.id
    })
    notificar({ empresa_id: perfil.empresa_id, rol: 'coordinador_adquisiciones', titulo: 'Cotización y presupuesto solicitados', cuerpo: tituloDe(t), url: '/taller' })
    notificar({ empresa_id: perfil.empresa_id, rol: 'encargado_bodega', titulo: 'Revisar stock para presupuesto', cuerpo: tituloDe(t), url: '/taller' })
    cargar()
  }
  async function guardarPresup(p, campos, aviso) {
    await supabase.from('presupuestos_taller').update(campos).eq('id', p.id)
    if (aviso) notificar({ empresa_id: perfil.empresa_id, ...aviso })
    cargar()
  }

  /* ---- Tarjeta ------------------------------------------------------ */
  function Card({ t }) {
    const ts = tareasDe(t.id)
    const done = ts.filter((x) => x.estado === 'terminada').length
    const vencida = t.fecha_limite && !t.cerrado_en && new Date(t.fecha_limite) < new Date()
    return (
      <button onClick={() => setSel(t)} draggable={esJefe}
        onDragStart={(e) => { e.dataTransfer.setData('text/trabajo', t.id); e.dataTransfer.effectAllowed = 'move' }}
        className="w-full text-left card p-3 hover:shadow-md transition space-y-1.5 cursor-grab active:cursor-grabbing">
        <div className="text-[13px] font-semibold text-ink uppercase leading-snug">{tituloDe(t)}</div>
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
          <span className="font-mono">⏱ {fmtCrono(crono(t, now))}</span>
          {ts.length > 0 && <span className={done === ts.length ? 'text-green-600 font-semibold' : ''}>✓ {done}/{ts.length}</span>}
          {t.fecha_limite && <span className={vencida ? 'text-red-500 font-semibold' : ''}>{new Date(t.fecha_limite + 'T12:00').toLocaleDateString('es-CL')}</span>}
          <Bandera p={t.prioridad} />
        </div>
        <div className="flex items-center gap-1">
          {[...new Set(ts.map((x) => x.tecnico_id).filter(Boolean))].slice(0, 4).map((uid) => <Avatar key={uid} nombre={nombreDe(uid)} />)}
          {presupsDe(t.id).length > 0 && <span className="ml-auto text-[10px] text-slate-400">📄 {presupsDe(t.id).length}</span>}
        </div>
      </button>
    )
  }

  const activos = trabajos.filter((t) => t.estado !== 'completada')

  /* ---- Indicadores --------------------------------------------------- */
  const IND = useMemo(() => {
    const term = tareas.filter((x) => x.estado === 'terminada')
    const porTec = {}
    tareas.forEach((x) => {
      const k = x.tecnico_id || 'sin'
      if (!porTec[k]) porTec[k] = { total: 0, term: 0, seg: 0 }
      porTec[k].total++
      if (x.estado === 'terminada') { porTec[k].term++; porTec[k].seg += (x.tiempo_seg || 0) }
    })
    const tecArr = Object.entries(porTec).map(([k, v]) => ({
      nombre: k === 'sin' ? 'Sin asignar' : nombreDe(k), ...v,
      prom: v.term ? v.seg / v.term : 0
    })).sort((a, b) => b.term - a.term)
    const cerrados = trabajos.filter((t) => t.cerrado_en)
    const promTrabajo = cerrados.length ? cerrados.reduce((s, t) => s + crono(t, now), 0) / cerrados.length : 0
    const vencidos = trabajos.filter((t) => t.fecha_limite && !t.cerrado_en && new Date(t.fecha_limite) < new Date()).length

    // Tiempo promedio por ETAPA: recorre el historial de cada trabajo y
    // acumula cuánto permaneció en cada estado (el actual cuenta hasta ahora).
    const etapa = {}
    trabajos.forEach((t) => {
      const eventos = [{ estado: 'por_designar', fecha: t.creado_en }, ...(t.historial || [])]
        .filter((h) => h.fecha).sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      eventos.forEach((h, i) => {
        const fin = i + 1 < eventos.length ? new Date(eventos[i + 1].fecha)
          : (t.cerrado_en ? new Date(t.cerrado_en) : new Date(now))
        const seg = Math.max(0, (fin - new Date(h.fecha)) / 1000)
        if (!etapa[h.estado]) etapa[h.estado] = { seg: 0, n: 0 }
        etapa[h.estado].seg += seg; etapa[h.estado].n++
      })
    })
    const etapaArr = Object.entries(etapa)
      .filter(([k]) => ESTADOS_TALLER[k])
      .map(([k, v]) => ({ k, label: ESTADOS_TALLER[k].label, color: ESTADOS_TALLER[k].color, prom: v.seg / v.n, n: v.n }))
      .sort((a, b) => b.prom - a.prom)

    return { tecArr, term: term.length, totalTareas: tareas.length, promTrabajo, vencidos, etapaArr,
             enCurso: tareas.filter((x) => x.estado === 'en_curso').length }
  }, [tareas, trabajos, usuarios, now])

  if (cargando) return <div className="text-slate-400 text-sm py-10 text-center">Cargando taller…</div>

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Taller</h1>
          <p className="text-sm text-slate-500">{activos.length} vehículos activos · {IND.enCurso} tareas en curso</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          {[['tablero', 'Tablero'], ['lista', 'Lista'], ['tecnicos', 'Técnicos'], ['indicadores', 'Indicadores']].map(([v, l]) => (
            <button key={v} onClick={() => setVista(v)} className={`px-3 py-1.5 ${vista === v ? 'bg-deep text-white' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* ---- TABLERO (kanban) ---- */}
      {vista === 'tablero' && (
        <div className="flex gap-3 overflow-x-auto pb-3 items-start">
          {ORDEN_ESTADOS.map((e) => {
            const col = trabajos.filter((t) => t.estado === e)
            return (
              <div key={e} className="min-w-[250px] w-[250px] shrink-0 rounded-xl bg-mist/50 p-2"
                   onDragOver={(ev) => { if (esJefe) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move' } }}
                   onDrop={(ev) => {
                     if (!esJefe) return
                     ev.preventDefault()
                     const id = ev.dataTransfer.getData('text/trabajo')
                     const tr = trabajos.find((x) => x.id === id)
                     if (tr && tr.estado !== e) moverEstado(tr, e)
                   }}>
                <div className="flex items-center gap-2 px-1 py-1.5">
                  <span className="pill text-white text-[10px]" style={{ background: ESTADOS_TALLER[e].color }}>{ESTADOS_TALLER[e].label.toUpperCase()}</span>
                  <span className="text-xs text-slate-400">{col.length}</span>
                </div>
                <div className="space-y-2 mt-1">{col.map((t) => <Card key={t.id} t={t} />)}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* ---- LISTA agrupada ---- */}
      {vista === 'lista' && (
        <div className="space-y-5">
          {ORDEN_ESTADOS.map((e) => {
            const col = trabajos.filter((t) => t.estado === e)
            if (!col.length) return null
            return (
              <div key={e} className="card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-paper border-b">
                  <span className="pill text-white text-[10px]" style={{ background: ESTADOS_TALLER[e].color }}>{ESTADOS_TALLER[e].label.toUpperCase()}</span>
                  <span className="text-xs text-slate-400">{col.length}</span>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="text-slate-400 text-xs border-b">
                    <th className="text-left px-4 py-2 font-medium">Nombre</th>
                    <th className="text-left px-2 font-medium hidden sm:table-cell">Asignados</th>
                    <th className="text-left px-2 font-medium hidden md:table-cell">Fecha límite</th>
                    <th className="text-left px-2 font-medium hidden md:table-cell">Prioridad</th>
                    <th className="text-right px-4 font-medium">⏱</th>
                  </tr></thead>
                  <tbody>
                    {col.map((t) => {
                      const ts = tareasDe(t.id); const done = ts.filter((x) => x.estado === 'terminada').length
                      const vencida = t.fecha_limite && !t.cerrado_en && new Date(t.fecha_limite) < new Date()
                      return (
                        <tr key={t.id} onClick={() => setSel(t)} className="border-b last:border-0 hover:bg-paper cursor-pointer">
                          <td className="px-4 py-2.5">
                            <span className="font-medium text-ink uppercase text-[13px]">{tituloDe(t)}</span>
                            {ts.length > 0 && <span className="ml-2 text-[11px] text-slate-400">✓ {done}/{ts.length}</span>}
                          </td>
                          <td className="px-2 hidden sm:table-cell"><div className="flex gap-1">{[...new Set(ts.map((x) => x.tecnico_id).filter(Boolean))].slice(0, 3).map((uid) => <Avatar key={uid} nombre={nombreDe(uid)} />)}</div></td>
                          <td className={`px-2 hidden md:table-cell text-xs ${vencida ? 'text-red-500 font-semibold' : 'text-slate-500'}`}>{t.fecha_limite ? new Date(t.fecha_limite + 'T12:00').toLocaleDateString('es-CL') : '—'}</td>
                          <td className="px-2 hidden md:table-cell"><Bandera p={t.prioridad} /></td>
                          <td className="px-4 text-right font-mono text-xs text-slate-500">{fmtCrono(crono(t, now))}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {/* ---- TÉCNICOS ---- */}
      {vista === 'tecnicos' && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...tecnicos, { id: null, nombre: 'Sin asignar' }].map((u) => {
            const ts = tareas.filter((x) => x.tecnico_id === (u.id || null) && x.estado !== 'terminada')
              .concat(tareas.filter((x) => x.tecnico_id === (u.id || null) && x.estado === 'terminada' && x.terminada_en && new Date(x.terminada_en).toDateString() === new Date().toDateString()))
            if (!u.id && !ts.length) return null
            return (
              <div key={u.id || 'sin'} className="card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar nombre={u.nombre} />
                  <span className="font-semibold text-ink text-sm">{u.nombre}</span>
                  <span className="text-xs text-slate-400 ml-auto">{ts.filter((x) => x.estado !== 'terminada').length} pendientes hoy</span>
                </div>
                <div className="space-y-1.5">
                  {ts.map((x) => {
                    const t = trabajos.find((w) => w.id === x.trabajo_id)
                    return (
                      <button key={x.id} onClick={() => t && setSel(t)} className="w-full text-left rounded-lg border border-slate-100 px-2.5 py-2 hover:bg-paper">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${x.estado === 'terminada' ? 'bg-green-500' : x.estado === 'en_curso' ? 'bg-amber-400' : 'bg-slate-300'}`} />
                          <span className={`text-[13px] ${x.estado === 'terminada' ? 'line-through text-slate-400' : 'text-ink'}`}>{x.titulo}</span>
                          {x.estado === 'en_curso' && x.iniciada_en && (
                            <span className="ml-auto font-mono text-[10px] text-amber-600">{fmtCrono((x.tiempo_seg || 0) + (now - new Date(x.iniciada_en).getTime()) / 1000)}</span>
                          )}
                        </div>
                        {t && <div className="text-[10px] text-slate-400 uppercase mt-0.5 truncate">{tituloDe(t)}</div>}
                      </button>
                    )
                  })}
                  {!ts.length && <p className="text-xs text-slate-400 py-2">Sin tareas hoy.</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ---- INDICADORES ---- */}
      {vista === 'indicadores' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card p-4"><div className="text-xs text-slate-500">Tareas completadas</div><div className="text-2xl font-bold text-ink">{IND.term}<span className="text-sm text-slate-400 font-normal"> / {IND.totalTareas}</span></div></div>
            <div className="card p-4"><div className="text-xs text-slate-500">Tareas en curso</div><div className="text-2xl font-bold text-ink">{IND.enCurso}</div></div>
            <div className="card p-4"><div className="text-xs text-slate-500">Tiempo prom. por trabajo</div><div className="text-2xl font-bold text-ink font-mono">{fmtCrono(IND.promTrabajo)}</div></div>
            <div className="card p-4 border-t-4" style={{ borderTopColor: IND.vencidos ? '#e0382b' : '#1f9d57' }}><div className="text-xs text-slate-500">Trabajos atrasados</div><div className="text-2xl font-bold text-ink">{IND.vencidos}</div></div>
          </div>
          <div className="card p-4">
            <h3 className="font-semibold text-ink mb-1">Tiempo promedio por etapa</h3>
            <p className="text-[11px] text-slate-400 mb-3">Dónde pasan más tiempo los vehículos. Las etapas de espera largas son el primer lugar donde atacar la permanencia.</p>
            <div className="space-y-1.5">
              {(() => {
                const max = Math.max(...IND.etapaArr.map((x) => x.prom), 1)
                return IND.etapaArr.map((x) => (
                  <div key={x.k} className="flex items-center gap-2 text-sm">
                    <span className="w-44 shrink-0 text-slate-600 text-xs">{x.label}</span>
                    <div className="flex-1 h-2.5 rounded bg-mist overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${Math.round((x.prom / max) * 100)}%`, background: x.color }} />
                    </div>
                    <span className="w-20 text-right font-mono text-xs text-ink">{fmtCrono(x.prom)}</span>
                    <span className="w-10 text-right text-[10px] text-slate-400">{x.n}×</span>
                  </div>
                ))
              })()}
              {!IND.etapaArr.length && <p className="text-sm text-slate-400">Aún no hay historial de etapas.</p>}
            </div>
          </div>
          <div className="card p-4">
            <h3 className="font-semibold text-ink mb-2">Rendimiento por técnico</h3>
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400 text-xs border-b">
                <th className="text-left py-1.5">Técnico</th><th className="text-right">Asignadas</th>
                <th className="text-right">Completadas</th><th className="text-right">% avance</th>
                <th className="text-right">Tiempo prom. tarea</th>
              </tr></thead>
              <tbody>
                {IND.tecArr.map((x) => (
                  <tr key={x.nombre} className="border-b last:border-0">
                    <td className="py-2">{x.nombre}</td>
                    <td className="text-right">{x.total}</td>
                    <td className="text-right font-semibold text-green-600">{x.term}</td>
                    <td className="text-right">{x.total ? Math.round(x.term / x.total * 100) : 0}%</td>
                    <td className="text-right font-mono text-xs">{fmtCrono(x.prom)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- DETALLE ---- */}
      {sel && (
        <Detalle t={trabajos.find((x) => x.id === sel.id) || sel} onClose={() => setSel(null)}
          tareas={tareasDe(sel.id)} presups={presupsDe(sel.id)} tecnicos={tecnicos} nombreDe={nombreDe}
          diags={diags.filter((d) => d.trabajo_id === sel.id)} margenes={margenes}
          esJefe={esJefe} esTecnico={esTecnico} esCompras={esCompras} perfil={perfil} now={now} tituloDe={tituloDe}
          acciones={{ moverEstado, guardarTrabajo, agregarTarea, asignarTarea, iniciarTarea, terminarTarea, terminarTodas, eliminarTarea, solicitarPresupuesto, guardarPresup, agregarDiag, borrarDiag, diagAPresupuesto, marcarRespaldo }} />
      )}
    </div>
  )
}

/* ================= Detalle del trabajo ================= */
function Detalle({ t, onClose, tareas, presups, tecnicos, nombreDe, diags, margenes, esJefe, esTecnico, esCompras, perfil, now, tituloDe, acciones }) {
  const [nueva, setNueva] = useState(''); const [nuevaTec, setNuevaTec] = useState('')
  const [obs, setObs] = useState({})       // observación por tarea al terminar
  const [notaPresup, setNotaPresup] = useState('')
  const pend = tareas.filter((x) => x.estado !== 'terminada')
  const misTareas = tareas.filter((x) => x.tecnico_id === perfil?.id)

  return (
    <Modal abierto titulo={tituloDe(t)} onClose={onClose} ancho="max-w-3xl">
      <div className="space-y-5">
        {/* Estado + prioridad + fecha */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Etapa</label>
            <select className="input" value={t.estado} disabled={!esJefe}
                    onChange={(e) => acciones.moverEstado(t, e.target.value)}>
              {Object.entries(ESTADOS_TALLER).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Prioridad</label>
            <select className="input" value={t.prioridad || 'normal'} disabled={!esJefe}
                    onChange={(e) => acciones.guardarTrabajo(t, { prioridad: e.target.value })}>
              {Object.entries(PRIORIDADES_TALLER).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Fecha límite</label>
            <input type="date" className="input" value={t.fecha_limite || ''} disabled={!esJefe}
                   onChange={(e) => acciones.guardarTrabajo(t, { fecha_limite: e.target.value || null })} />
          </div>
        </div>

        {(t.servicio_solicitado || t.observaciones_cliente) && (
          <div className="rounded-lg bg-paper p-3 text-sm space-y-1">
            {t.servicio_solicitado && <div><span className="text-slate-400 text-xs">Servicio solicitado:</span> <b>{t.servicio_solicitado}</b></div>}
            {t.observaciones_cliente && <div><span className="text-slate-400 text-xs">Indica el cliente:</span> {t.observaciones_cliente}</div>}
          </div>
        )}

        {/* Línea de tiempo */}
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Línea de tiempo</div>
          <div className="flex flex-wrap gap-1.5">
            {[{ estado: 'ingreso', fecha: t.creado_en }, ...(t.historial || [])].map((h, i) => (
              <span key={i} className="pill bg-mist text-deep text-[10px]" title={h.por || ''}>
                {h.estado === 'ingreso' ? 'Ingreso' : (ESTADOS_TALLER[h.estado]?.label || h.estado)} · {new Date(h.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })} {new Date(h.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            ))}
            <span className="pill bg-deep text-white text-[10px] font-mono">⏱ {fmtCrono((t.cerrado_en ? new Date(t.cerrado_en).getTime() : now) / 1000 - new Date(t.creado_en).getTime() / 1000)}</span>
          </div>
        </div>

        {/* Diagnóstico técnico */}
        <SeccionDiag t={t} diags={diags} esJefe={esJefe} esTecnico={esTecnico} nombreDe={nombreDe} acciones={acciones} />

        {/* Respaldos de garantía */}
        <div className="rounded-lg border border-slate-100 p-3">
          <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Respaldo de garantía <span className="normal-case font-normal">(requisito para reparar)</span></div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={!!t.respaldo_ot_firmada}
                     onChange={(e) => acciones.marcarRespaldo(t, 'respaldo_ot_firmada', e.target.checked)} />
              OT firmada por el cliente
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={!!t.respaldo_video}
                     onChange={(e) => acciones.marcarRespaldo(t, 'respaldo_video', e.target.checked)} />
              Video enviado al grupo de respaldo
            </label>
            {t.autorizado_en && (
              <span className="text-[11px] text-slate-400 self-center">Reparación autorizada por {nombreDe(t.autorizado_por)} · {new Date(t.autorizado_en).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </div>
        </div>

        {/* Tareas */}
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Tareas ({tareas.filter((x) => x.estado === 'terminada').length}/{tareas.length})</div>
          <div className="space-y-2">
            {tareas.map((x) => {
              const mia = x.tecnico_id === perfil?.id
              const enCurso = x.estado === 'en_curso'
              return (
                <div key={x.id} className="rounded-lg border border-slate-100 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded grid place-items-center text-[10px] text-white shrink-0 ${x.estado === 'terminada' ? 'bg-green-500' : enCurso ? 'bg-amber-400' : 'bg-slate-300'}`}>
                      {x.estado === 'terminada' ? '✓' : ''}
                    </span>
                    <span className={`text-sm flex-1 ${x.estado === 'terminada' ? 'line-through text-slate-400' : 'text-ink'}`}>{x.titulo}</span>
                    {enCurso && x.iniciada_en && <span className="font-mono text-[11px] text-amber-600">{fmtCrono((x.tiempo_seg || 0) + (now - new Date(x.iniciada_en).getTime()) / 1000)}</span>}
                    {x.estado === 'terminada' && <span className="font-mono text-[11px] text-slate-400">{fmtCrono(x.tiempo_seg)}</span>}
                    <select className="text-xs border border-slate-200 rounded px-1 py-0.5 max-w-[110px]" value={x.tecnico_id || ''} disabled={!esJefe}
                            onChange={(e) => acciones.asignarTarea(x, e.target.value || null)}>
                      <option value="">Sin asignar</option>
                      {tecnicos.map((u) => <option key={u.id} value={u.id}>{u.nombre.split(' ')[0]}</option>)}
                    </select>
                    {esJefe && x.estado !== 'terminada' && <button onClick={() => acciones.eliminarTarea(x)} className="text-slate-300 hover:text-red-500 text-sm">✕</button>}
                  </div>
                  {x.estado !== 'terminada' && (mia || esJefe) && (
                    <div className="mt-2 pl-6 flex flex-wrap items-center gap-2">
                      {!enCurso && <button className="btn-soft text-xs" onClick={() => acciones.iniciarTarea(x)}>▶ Iniciar</button>}
                      {enCurso && <>
                        <input className="input text-xs flex-1 min-w-[180px]" placeholder="Observación (obligatoria al terminar)…"
                               value={obs[x.id] || ''} onChange={(e) => setObs({ ...obs, [x.id]: e.target.value })} />
                        <button className="btn-primary text-xs" onClick={() => acciones.terminarTarea(x, obs[x.id])}>✓ Terminar</button>
                      </>}
                    </div>
                  )}
                  {x.observacion && <div className="mt-1.5 pl-6 text-xs text-slate-500">💬 {x.observacion} <span className="text-slate-300">— {nombreDe(x.tecnico_id)}</span></div>}
                </div>
              )
            })}
            {!tareas.length && <p className="text-sm text-slate-400">Sin tareas aún.</p>}
          </div>

          {esJefe && (
            <div className="flex gap-2 mt-2">
              <input className="input flex-1" placeholder="+ Nueva tarea…" value={nueva}
                     onChange={(e) => setNueva(e.target.value)}
                     onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); acciones.agregarTarea(t, nueva, nuevaTec); setNueva('') } }} />
              <select className="input w-36" value={nuevaTec} onChange={(e) => setNuevaTec(e.target.value)}>
                <option value="">Sin asignar</option>
                {tecnicos.map((u) => <option key={u.id} value={u.id}>{u.nombre.split(' ')[0]}</option>)}
              </select>
              <button className="btn-soft" onClick={() => { acciones.agregarTarea(t, nueva, nuevaTec); setNueva('') }}>Agregar</button>
            </div>
          )}
          {esTecnico && misTareas.length > 0 && !pend.filter((x) => x.tecnico_id === perfil.id).length && t.estado !== 'prueba_ruta' && t.estado !== 'listo_entrega' && t.estado !== 'completada' && (
            <button className="btn-primary w-full mt-3" onClick={() => acciones.terminarTodas(t)}>✓ Terminar tareas — enviar a prueba en ruta</button>
          )}
        </div>

        {/* Presupuestos del taller */}
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Presupuestos del taller</div>
          <div className="space-y-2">
            {presups.map((p) => (
              <PresupCard key={p.id} p={p} t={t} esJefe={esJefe} esCompras={esCompras} perfil={perfil}
                          guardar={acciones.guardarPresup} tituloDe={tituloDe} margenes={margenes} />
            ))}
            {!presups.length && <p className="text-sm text-slate-400">Sin presupuestos solicitados.</p>}
          </div>
          {esJefe && (
            <div className="flex gap-2 mt-2">
              <input className="input flex-1" placeholder="Notas para adquisiciones (repuestos requeridos)…"
                     value={notaPresup} onChange={(e) => setNotaPresup(e.target.value)} />
              <button className="btn-soft" onClick={() => { acciones.solicitarPresupuesto(t, notaPresup); setNotaPresup('') }}>Solicitar presupuesto</button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ---- Presupuesto de taller: cotización, ítems, stock y resolución ---- */
function PresupCard({ p, t, esJefe, esCompras, perfil, guardar, tituloDe, margenes }) {
  const [abierto, setAbierto] = useState(false)
  const [items, setItems] = useState(p.items || [])
  const [monto, setMonto] = useState(p.monto || 0)
  const puedeEditar = esCompras || esJefe
  const est = ESTADOS_PRESUP_TALLER[p.estado] || {}

  const setItem = (i, campo, v) => { const n = items.map((x, j) => j === i ? { ...x, [campo]: v } : x); setItems(n) }
  const agregar = (tipo) => setItems([...items, { tipo, codigo: '', detalle: '', cant: 1, costo: 0, precio: 0, en_stock: null }])
  // Margen de administración: precio = costo * (1 + margen%)
  const conMargen = (tipo, costo) => Math.round((+costo || 0) * (1 + ((margenes?.[tipo] ?? 30) / 100)))
  const setCosto = (i, v) => {
    const n = items.map((x, j) => j === i ? { ...x, costo: v, precio: conMargen(x.tipo, v) } : x)
    setItems(n)
  }
  const totalItems = items.reduce((s, x) => s + (x.en_stock ? 0 : (+x.precio || 0) * (+x.cant || 1)), 0)

  async function guardarItems(estado) {
    const campos = { items, monto: totalItems || +monto || 0 }
    let aviso = null
    if (estado) {
      campos.estado = estado
      if (estado === 'enviado') { campos.elaborado_por = perfil.id; aviso = { usuario_id: t.asesor_id, rol: t.asesor_id ? null : 'vendedor', titulo: 'Presupuesto listo para entregar al cliente', cuerpo: tituloDe(t), url: '/taller', empresa_id: perfil.empresa_id } }
      if (estado === 'aprobado') { campos.resuelto_en = new Date().toISOString(); aviso = { rol: 'coordinador_adquisiciones', titulo: 'Presupuesto APROBADO · gestionar adquisición', cuerpo: tituloDe(t), url: '/taller', empresa_id: perfil.empresa_id } }
      if (estado === 'rechazado' || estado === 'parcial') { campos.resuelto_en = new Date().toISOString(); aviso = { rol: 'jefe_taller', titulo: `Presupuesto ${estado === 'parcial' ? 'RECHAZADO · entrega parcial' : 'RECHAZADO'}`, cuerpo: tituloDe(t), url: '/taller', empresa_id: perfil.empresa_id } }
    }
    await guardar(p, campos, aviso)
  }

  return (
    <div className="rounded-lg border border-slate-100">
      <button onClick={() => setAbierto(!abierto)} className="w-full flex items-center gap-2 px-3 py-2 text-sm">
        <Pill color={est.color}>{est.label}</Pill>
        <span className="text-slate-500 text-xs">{new Date(p.creado_en).toLocaleDateString('es-CL')}</span>
        {p.notas && <span className="text-xs text-slate-400 truncate flex-1 text-left">· {p.notas}</span>}
        <span className="ml-auto font-semibold text-ink">{fmtCLP(p.monto || 0)}</span>
        <span className="text-slate-300">{abierto ? '▾' : '▸'}</span>
      </button>
      {abierto && (
        <div className="px-3 pb-3 space-y-2 border-t pt-2">
          {items.map((x, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span className="pill bg-mist text-deep shrink-0 capitalize">{x.tipo}</span>
              <input className="input text-xs w-24" placeholder="Cód." value={x.codigo || ''} disabled={!puedeEditar}
                     onChange={(e) => setItem(i, 'codigo', e.target.value)} />
              <input className="input text-xs flex-1" placeholder="Descripción del producto…" value={x.detalle} disabled={!puedeEditar}
                     onChange={(e) => setItem(i, 'detalle', e.target.value)} />
              <input className="input text-xs w-12" type="number" min="1" value={x.cant} disabled={!puedeEditar}
                     onChange={(e) => setItem(i, 'cant', e.target.value)} />
              <input className="input text-xs w-20" type="number" min="0" placeholder="$ costo" title="Costo neto (proveedor)" value={x.costo ?? ''} disabled={!puedeEditar || x.en_stock}
                     onChange={(e) => setCosto(i, e.target.value)} />
              <input className="input text-xs w-24 bg-mist/60" type="number" min="0" placeholder="$ venta" title={`Precio venta (margen ${margenes?.[x.tipo] ?? 30}% aplicado)`} value={x.precio} disabled={!puedeEditar || x.en_stock}
                     onChange={(e) => setItem(i, 'precio', e.target.value)} />
              <button type="button" disabled={!puedeEditar} title="¿Hay stock en bodega?"
                      onClick={() => setItem(i, 'en_stock', !x.en_stock)}
                      className={`px-2 py-1 rounded border ${x.en_stock ? 'bg-green-50 border-green-300 text-green-600' : 'border-slate-200 text-slate-400'}`}>
                {x.en_stock ? 'Stock ✓' : 'Sin stock'}
              </button>
              {puedeEditar && <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-500">✕</button>}
            </div>
          ))}
          {puedeEditar && (
            <div className="flex flex-wrap gap-1.5">
              {['repuesto', 'lubricante', 'filtro', 'consumible'].map((tp) => (
                <button key={tp} className="btn-soft text-xs capitalize" onClick={() => agregar(tp)}>+ {tp}</button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-500">Total a cotizar (sin stock): <b className="text-ink">{fmtCLP(totalItems)}</b></span>
            <div className="flex gap-1.5 flex-wrap">
              {puedeEditar && ['solicitado', 'cotizando'].includes(p.estado) && <>
                <button className="btn-soft text-xs" onClick={() => guardarItems('cotizando')}>Guardar cotización</button>
                <button className="btn-primary text-xs" onClick={() => guardarItems('enviado')}>Enviar al asesor</button>
              </>}
              {(esJefe || perfil?.rol === 'vendedor' || perfil?.rol === 'admin') && p.estado === 'enviado' && <>
                <button className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white" onClick={() => guardarItems('aprobado')}>Cliente aprueba</button>
                <button className="text-xs px-3 py-1.5 rounded-lg bg-didial-amber text-ink" onClick={() => guardarItems('parcial')}>Entrega parcial</button>
                <button className="text-xs px-3 py-1.5 rounded-lg bg-didial-red text-white" onClick={() => guardarItems('rechazado')}>Cliente rechaza</button>
              </>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


const SEVERIDADES = {
  critico:    { label: 'Crítico',    color: '#e0382b' },
  pronto:     { label: 'Atender pronto', color: '#e0a020' },
  preventivo: { label: 'Preventivo', color: '#2f6fb0' },
  ok:         { label: 'En buen estado', color: '#1f9d57' }
}

function SeccionDiag({ t, diags, esJefe, esTecnico, nombreDe, acciones }) {
  const [d, setD] = useState({ item: '', severidad: 'preventivo', recomendacion: '' })
  const puede = esJefe || esTecnico
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-slate-400 uppercase">Diagnóstico técnico ({diags.length})</div>
        {esJefe && diags.some((x) => x.severidad !== 'ok') && (
          <button className="btn-soft text-xs" onClick={() => acciones.diagAPresupuesto(t)}>→ Pasar a presupuesto</button>
        )}
      </div>
      <div className="space-y-1.5">
        {diags.map((x) => (
          <div key={x.id} className="flex items-start gap-2 rounded-lg border border-slate-100 px-2.5 py-2 text-sm">
            <span className="pill text-white text-[10px] shrink-0 mt-0.5" style={{ background: SEVERIDADES[x.severidad]?.color }}>
              {SEVERIDADES[x.severidad]?.label}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-ink">{x.item}</div>
              {x.recomendacion && <div className="text-xs text-slate-500">↳ {x.recomendacion}</div>}
              <div className="text-[10px] text-slate-300">{nombreDe(x.tecnico_id)}</div>
            </div>
            {puede && <button onClick={() => acciones.borrarDiag(x.id)} className="text-slate-300 hover:text-red-500">✕</button>}
          </div>
        ))}
        {!diags.length && <p className="text-sm text-slate-400">Sin hallazgos registrados aún.</p>}
      </div>
      {puede && (
        <div className="mt-2 grid sm:grid-cols-[1fr_auto] gap-2">
          <input className="input" placeholder="Hallazgo (ej: pastillas de freno al 10%)…" value={d.item}
                 onChange={(e) => setD({ ...d, item: e.target.value })} />
          <select className="input" value={d.severidad} onChange={(e) => setD({ ...d, severidad: e.target.value })}>
            {Object.entries(SEVERIDADES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <input className="input sm:col-span-2" placeholder="Recomendación (ej: reemplazar pastillas y rectificar discos)…" value={d.recomendacion}
                 onChange={(e) => setD({ ...d, recomendacion: e.target.value })}
                 onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); acciones.agregarDiag(t, d); setD({ item: '', severidad: 'preventivo', recomendacion: '' }) } }} />
          <button className="btn-soft sm:col-span-2" onClick={() => { acciones.agregarDiag(t, d); setD({ item: '', severidad: 'preventivo', recomendacion: '' }) }}>+ Agregar hallazgo</button>
        </div>
      )}
    </div>
  )
}
