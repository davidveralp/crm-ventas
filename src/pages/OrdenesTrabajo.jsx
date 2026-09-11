import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmtCLP, formatPatente, patenteLimpia } from '../lib/helpers'

/* ============================================================================
   Órdenes de trabajo · listado y detalle
   ----------------------------------------------------------------------------
   Reemplaza la pestaña "Solo cliente". Muestra todas las OT en orden
   cronológico, con buscador y tres estados que importan para la operación:

     · Abierta               — el vehículo está en el taller
     · Cerrada               — entregada y documentada
     · Cerrada sin documento — entregada pero sin boleta ni factura

   El tercero es el que interesa vigilar: son trabajos hechos que todavía no se
   facturaron. Sin distinguirlo, se pierden entre las cerradas.
   ========================================================================== */

const fecha = (d) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'

const CLASES = {
  abierta:      { label: 'Abierta', color: '#2f6fb0', bg: '#e8f0fa' },
  cerrada:      { label: 'Cerrada', color: '#1f9d57', bg: '#e8f6ee' },
  sin_doc:      { label: 'Sin documento', color: '#e0382b', bg: '#fdecea' }
}

const claseDe = (t) => {
  if (t.cierre_estado !== 'cerrado') return 'abierta'
  return t.nro_documento ? 'cerrada' : 'sin_doc'
}

export default function OrdenesTrabajo() {
  const { perfil } = useAuth()
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const [estado, setEstado] = useState('cargando')
  const [errMsg, setErrMsg] = useState('')
  const [sel, setSel] = useState(null)
  // Técnicos por OT, para mostrarlos en la fila sin abrir el detalle.
  const [tecnicosPorOT, setTecnicosPorOT] = useState({})

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setEstado('cargando')
    const { data, error } = await supabase.from('trabajos_taller')
      .select(`id, ot_numero, titulo, estado, cierre_estado, creado_en, entregado_en,
               monto_total, nro_documento, tipo_documento, servicio_solicitado,
               observaciones_cliente, km_ingreso, sucursal, prioridad, fecha_limite,
               progreso_clickup, sugerencias_clickup, inspeccion_id,
               retira_nombre, observaciones_entrega, descuento,
               vehiculo_id, cliente_id,
               vehiculos(patente, marca, modelo, anio, color, version, chasis),
               clientes(nombre, apellidos, telefono, rut, email, direccion)`)
      .order('creado_en', { ascending: false }).limit(500)
    if (error) { setErrMsg(error.message); setEstado('error'); return }
    setRows(data || []); setEstado('listo')

    /* Una sola consulta para todas las tareas: pedir los técnicos OT por OT
       serían 200 consultas y la tabla tardaría en aparecer. */
    const ids = (data || []).map((t) => t.id)
    if (ids.length) {
      const { data: tar } = await supabase.from('tareas_taller')
        .select('trabajo_id, tecnico_id, tecnico_nombre, usuarios:tecnico_id(nombre)')
        .in('trabajo_id', ids.slice(0, 300))
      const m = {}
      ;(tar || []).forEach((x) => {
        const n = x.usuarios?.nombre || x.tecnico_nombre
        if (!n) return
        const corto = n.split(' ')[0]
        m[x.trabajo_id] = m[x.trabajo_id] || []
        if (!m[x.trabajo_id].includes(corto)) m[x.trabajo_id].push(corto)
      })
      setTecnicosPorOT(m)
    }
  }

  const K = useMemo(() => ({
    total: rows.length,
    abierta: rows.filter((t) => claseDe(t) === 'abierta').length,
    cerrada: rows.filter((t) => claseDe(t) === 'cerrada').length,
    sin_doc: rows.filter((t) => claseDe(t) === 'sin_doc').length
  }), [rows])

  const visibles = useMemo(() => {
    let r = rows
    if (filtro !== 'todas') r = r.filter((t) => claseDe(t) === filtro)
    const t = q.trim().toUpperCase()
    if (t) {
      const pn = patenteLimpia(t)
      r = r.filter((x) =>
        (x.ot_numero || '').includes(t) ||
        (x.vehiculos?.patente || '').toUpperCase().replace(/[^A-Z0-9]/g, '').includes(pn) ||
        `${x.clientes?.nombre || ''} ${x.clientes?.apellidos || ''}`.toUpperCase().includes(t) ||
        (x.vehiculos?.marca || '').toUpperCase().includes(t) ||
        (x.vehiculos?.modelo || '').toUpperCase().includes(t))
    }
    return r
  }, [rows, q, filtro])

  if (estado === 'cargando') return <div className="text-slate-400 text-sm">Cargando órdenes…</div>
  if (estado === 'error') return (
    <div className="card p-4">
      <p className="text-sm text-slate-600">No se pudieron cargar las órdenes.</p>
      <p className="text-xs text-slate-400 mt-1">{errMsg}</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[['todas', 'Total', K.total, '#6b7a8a'],
          ['abierta', 'Abiertas', K.abierta, CLASES.abierta.color],
          ['cerrada', 'Cerradas', K.cerrada, CLASES.cerrada.color],
          ['sin_doc', 'Sin documento', K.sin_doc, CLASES.sin_doc.color]].map(([k, l, v, c]) => (
          <button key={k} onClick={() => setFiltro(k)}
            className="card p-3 text-left border-l-4 transition-opacity"
            style={{ borderLeftColor: c, opacity: filtro === k || filtro === 'todas' ? 1 : 0.55 }}>
            <div className="text-xs text-slate-500">{l}</div>
            <div className="text-2xl font-semibold" style={{ color: k === 'sin_doc' && v ? c : '#111922' }}>{v}</div>
          </button>
        ))}
      </div>

      {filtro === 'sin_doc' && K.sin_doc > 0 && (
        <p className="text-[11px] px-2 py-1.5 rounded" style={{ background: '#fdecea', color: '#8a1f18' }}>
          Trabajos entregados sin boleta ni factura. Cada uno es un cobro pendiente de documentar.
        </p>
      )}

      <input className="input w-full" placeholder="Buscar por N° de OT, patente, cliente, marca o modelo…"
             value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="text-slate-400 text-xs border-b">
              <th className="text-left p-2">OT</th>
              <th className="text-left">Fecha</th>
              <th className="text-left">Patente</th>
              <th className="text-left">Vehículo</th>
              <th className="text-left">Cliente</th>
              <th className="text-left">Técnicos</th>
              <th className="text-center">Estado</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {visibles.slice(0, 200).map((t) => {
              const c = CLASES[claseDe(t)]
              return (
                <tr key={t.id} onClick={() => setSel(t)}
                    className="border-b last:border-0 cursor-pointer hover:bg-slate-50">
                  <td className="p-2 font-medium text-ink">{t.ot_numero || '—'}</td>
                  <td className="text-slate-500">{fecha(t.creado_en)}</td>
                  <td className="font-medium">{t.vehiculos?.patente ? formatPatente(t.vehiculos.patente) : '—'}</td>
                  <td className="truncate max-w-[150px] text-slate-600">
                    {[t.vehiculos?.marca, t.vehiculos?.modelo].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="truncate max-w-[160px] text-slate-600">
                    {`${t.clientes?.nombre || ''} ${t.clientes?.apellidos || ''}`.trim() || '—'}
                  </td>
                  <td className="text-xs text-slate-500 truncate max-w-[130px]">
                    {(tecnicosPorOT[t.id] || []).join(', ') || '—'}
                  </td>
                  <td className="text-center">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{ background: c.bg, color: c.color }}>{c.label}</span>
                  </td>
                  <td className="text-right font-medium">{t.monto_total ? fmtCLP(t.monto_total) : '—'}</td>
                </tr>
              )
            })}
            {!visibles.length && (
              <tr><td colSpan={8} className="p-4 text-center text-slate-400">Sin órdenes que coincidan.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {visibles.length > 200 && (
        <p className="text-[11px] text-slate-400">Se muestran las primeras 200 de {visibles.length}.</p>
      )}

      {sel && <DetalleOT ot={sel} perfil={perfil} onCerrar={() => setSel(null)}
                         onCambio={cargar} />}
    </div>
  )
}

/* ------------------------------- Detalle ---------------------------------- */

const AREAS = [
  ['servicio', 'Mano de obra'],
  ['repuesto', 'Repuestos'],
  ['insumo', 'Lubricantes e insumos'],
  ['servicio_externo', 'Servicio externo']
]

function DetalleOT({ ot, perfil, onCerrar, onCambio }) {
  const [lineas, setLineas] = useState([])
  const [tareas, setTareas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(null)   // área en edición
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const editable = ot.cierre_estado !== 'cerrado'

  const num = (x) => Number(String(x ?? '').replace(/[^0-9.]/g, '')) || 0

  const editarLinea = (id, campo, valor) =>
    setLineas((x) => x.map((l) => (l.id === id ? { ...l, [campo]: valor, _sucia: true } : l)))

  const quitarLinea = (id) =>
    setLineas((x) => x.map((l) => (l.id === id ? { ...l, _borrar: true } : l)).filter((l) => !(l._borrar && l._nueva)))

  const agregarLinea = (tipo) =>
    setLineas((x) => [...x, {
      id: 'nueva' + Date.now() + Math.random().toString(36).slice(2, 5),
      trabajo_id: ot.id, tipo, codigo: '', detalle: '', cantidad: '1',
      precio_unit: '', costo_unit: '', _nueva: true, _sucia: true
    }])

  /* Guarda solo lo que cambió. Recorrer todas las líneas en cada guardado
     sobrescribiría datos que otro usuario pudo modificar entremedio. */
  async function guardarCambios() {
    setGuardando(true); setMsg('')
    try {
      for (const l of lineas.filter((x) => x._borrar && !x._nueva)) {
        await supabase.from('ot_detalle').delete().eq('id', l.id)
      }
      for (const l of lineas.filter((x) => x._sucia && !x._borrar && x.detalle?.trim())) {
        const fila = {
          tipo: l.tipo, codigo: l.codigo?.trim() || null, detalle: l.detalle.trim(),
          cantidad: num(l.cantidad) || 1, precio_unit: num(l.precio_unit),
          costo_unit: num(l.costo_unit) || null,
          valorizado_por: num(l.precio_unit) ? perfil.id : null,
          valorizado_en: num(l.precio_unit) ? new Date().toISOString() : null
        }
        if (l._nueva) {
          await supabase.from('ot_detalle').insert({ ...fila, empresa_id: perfil.empresa_id, trabajo_id: ot.id })
        } else {
          await supabase.from('ot_detalle').update(fila).eq('id', l.id)
        }
      }
      await supabase.rpc('recalcular_total_ot', { p_trabajo: ot.id })
      setMsg('Cambios guardados')
      setEditando(null)
      onCambio?.()
    } catch (e) {
      setMsg('No se pudo guardar: ' + (e?.message || e))
    }
    setGuardando(false)
  }

  const [insp, setInsp] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('ot_detalle').select('*').eq('trabajo_id', ot.id).order('orden'),
      supabase.from('tareas_taller').select('*, usuarios:tecnico_id(nombre)').eq('trabajo_id', ot.id).order('orden'),
      // La inspección trae las observaciones del asesor y los hallazgos de la
      // recepción, que no están en el trabajo.
      ot.inspeccion_id
        ? supabase.from('inspecciones_ingreso').select('*').eq('id', ot.inspeccion_id).maybeSingle()
        : Promise.resolve({ data: null })
    ]).then(([d, t, i]) => {
      setLineas(d.data || []); setTareas(t.data || [])
      setInsp(i.data || null); setCargando(false)
    })
  }, [ot.id, ot.inspeccion_id])

  /* Hallazgos: solo rojos y amarillos. Los que salieron bien no aportan a una
     vista de orden de trabajo. */
  const hallazgos = useMemo(() => {
    const r = insp?.revision_recepcion || {}
    return Object.entries(r)
      .filter(([, v]) => v && v.sev && v.sev !== 'ok' && v.sev !== 'na')
      .map(([k, v]) => ({ k, ...v }))
  }, [insp])

  // Se calcula desde los valores en pantalla, no desde `total` de la base: si
  // el asesor está editando precios, el resumen debe reflejar lo que ve.
  const total = lineas.filter((l) => !l._borrar)
    .reduce((a, l) => a + num(l.cantidad) * num(l.precio_unit), 0)
  const porValorizar = lineas.filter((l) => !l._borrar && !num(l.precio_unit)).length
  const c = CLASES[claseDe(ot)]

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white sm:rounded-xl w-full max-w-2xl max-h-[100dvh] sm:max-h-[92vh] overflow-y-auto">
        <div className="p-4 border-b border-slate-100 sticky top-0 bg-white flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-ink text-lg">
              OT {ot.ot_numero || 's/n'}
              <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-semibold align-middle"
                    style={{ background: c.bg, color: c.color }}>{c.label}</span>
            </h3>
            <p className="text-xs text-slate-400">
              {ot.vehiculos?.patente ? formatPatente(ot.vehiculos.patente) : ''} ·{' '}
              {[ot.vehiculos?.marca, ot.vehiculos?.modelo, ot.vehiculos?.version, ot.vehiculos?.anio]
                .filter(Boolean).join(' ')}
              {ot.vehiculos?.color ? ` · ${ot.vehiculos.color}` : ''}
            </p>
          </div>
          <button onClick={onCerrar} className="text-slate-400 text-xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[11px] text-slate-400 uppercase">Cliente</p>
              <p className="font-medium text-ink">
                {`${ot.clientes?.nombre || ''} ${ot.clientes?.apellidos || ''}`.trim() || '—'}
              </p>
              <p className="text-xs text-slate-500">
                {[ot.clientes?.rut, ot.clientes?.telefono].filter(Boolean).join(' · ')}
              </p>
              {ot.clientes?.email && <p className="text-xs text-slate-400">{ot.clientes.email}</p>}
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase">Ingreso</p>
              <p className="font-medium text-ink">{fecha(ot.creado_en)}</p>
              {ot.km_ingreso ? <p className="text-xs text-slate-500">{ot.km_ingreso.toLocaleString('es-CL')} km</p> : null}
              {ot.sucursal && <p className="text-xs text-slate-400">{ot.sucursal}</p>}
              {ot.entregado_en && (
                <p className="text-xs text-slate-400">Entregado {fecha(ot.entregado_en)}</p>
              )}
            </div>
          </div>

          {ot.servicio_solicitado && (
            <div>
              <p className="text-[11px] text-slate-400 uppercase mb-0.5">Trabajo solicitado</p>
              <p className="text-sm text-slate-700">{ot.servicio_solicitado}</p>
            </div>
          )}

          {/* Lo que dijo el cliente y lo que anotó el asesor son cosas
              distintas: el primero describe el síntoma, el segundo el criterio
              técnico. Mezclarlos pierde información. */}
          {(ot.observaciones_cliente || insp?.observaciones_cliente) && (
            <div className="rounded-lg p-2" style={{ background: '#f8fafc' }}>
              <p className="text-[11px] text-slate-400 uppercase mb-0.5">Observaciones del cliente</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {ot.observaciones_cliente || insp?.observaciones_cliente}
              </p>
            </div>
          )}

          {insp?.observaciones_asesor && (
            <div className="rounded-lg p-2" style={{ background: '#f8fafc' }}>
              <p className="text-[11px] text-slate-400 uppercase mb-0.5">Observaciones del asesor</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{insp.observaciones_asesor}</p>
            </div>
          )}

          {/* Hallazgos de la revisión de recepción: lo que se detectó al
              recibir y todavía puede convertirse en venta. */}
          {hallazgos.length > 0 && (
            <div className="rounded-lg border p-2" style={{ borderColor: '#e0a02055' }}>
              <p className="text-[11px] uppercase mb-1" style={{ color: '#8a6d1f' }}>
                Hallazgos de la recepción ({hallazgos.length})
              </p>
              {hallazgos.map((h, i) => (
                <div key={i} className="flex gap-2 text-sm py-0.5">
                  <span style={{ color: h.sev === 'critico' ? '#e0382b' : '#e0a020' }}>●</span>
                  <span className="flex-1 text-slate-700">{h.texto || h.k}</span>
                  <span className="text-xs text-slate-400">{h.v}</span>
                </div>
              ))}
            </div>
          )}

          {ot.progreso_clickup != null && (
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400 uppercase">Avance en taller</span>
                <span className="text-slate-600 font-medium">{ot.progreso_clickup}%</span>
              </div>
              <div className="h-2 rounded bg-slate-100 overflow-hidden">
                <div className="h-full rounded" style={{ width: `${ot.progreso_clickup}%`, background: '#7b68ee' }} />
              </div>
            </div>
          )}

          {cargando ? <p className="text-sm text-slate-400">Cargando detalle…</p> : (
            <>
              {/* Cada área se edita por separado con su lápiz. Editar todo de
                  una vez en una OT con veinte líneas es incómodo y arriesga
                  cambios accidentales. */}
              {AREAS.map(([tipo, titulo]) => {
                const ls = lineas.filter((l) => l.tipo === tipo)
                const sub = ls.reduce((a, l) => a + (num(l.cantidad) * num(l.precio_unit)), 0)
                const enEdicion = editando === tipo
                const faltan = ls.filter((l) => !num(l.precio_unit)).length
                return (
                  <div key={tipo} className="rounded-lg border p-2"
                       style={{ borderColor: faltan ? '#e0a02055' : '#e2e8f0' }}>
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-sm font-medium text-ink">
                        {titulo}
                        {faltan > 0 && (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded"
                                style={{ background: '#fdf6e3', color: '#8a6d1f' }}>
                            {faltan} por valorizar
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{sub ? fmtCLP(sub) : '—'}</span>
                        {editable && (
                          <button type="button" title={enEdicion ? 'Terminar' : 'Editar'}
                            onClick={() => setEditando(enEdicion ? null : tipo)}
                            className="text-sm px-1.5 rounded"
                            style={enEdicion
                              ? { background: '#111922', color: '#fff' }
                              : { color: '#64748b' }}>
                            {enEdicion ? '✓' : '✏️'}
                          </button>
                        )}
                      </div>
                    </div>

                    {ls.map((l) => enEdicion ? (
                      <div key={l.id} className="grid grid-cols-12 gap-1 mb-1 items-center">
                        {tipo === 'repuesto' && (
                          <input className="input col-span-3" style={{ minHeight: '34px', fontSize: '13px' }}
                                 placeholder="Código" value={l.codigo || ''}
                                 onChange={(e) => editarLinea(l.id, 'codigo', e.target.value)} />
                        )}
                        <input className={tipo === 'repuesto' ? 'input col-span-4' : 'input col-span-7'}
                               style={{ minHeight: '34px', fontSize: '13px' }}
                               value={l.detalle}
                               onChange={(e) => editarLinea(l.id, 'detalle', e.target.value)} />
                        <input className="input col-span-1" style={{ minHeight: '34px', fontSize: '13px' }}
                               inputMode="decimal" value={l.cantidad}
                               onChange={(e) => editarLinea(l.id, 'cantidad', e.target.value.replace(/[^0-9.]/g, ''))} />
                        {tipo !== 'servicio' && (
                          <input className="input col-span-2" style={{ minHeight: '34px', fontSize: '13px' }}
                                 inputMode="numeric" placeholder="Costo" value={l.costo_unit || ''}
                                 onChange={(e) => editarLinea(l.id, 'costo_unit', e.target.value.replace(/[^0-9]/g, ''))} />
                        )}
                        <input className={tipo === 'servicio' ? 'input col-span-3' : 'input col-span-2'}
                               style={{ minHeight: '34px', fontSize: '13px' }}
                               inputMode="numeric" placeholder="Precio" value={l.precio_unit || ''}
                               onChange={(e) => editarLinea(l.id, 'precio_unit', e.target.value.replace(/[^0-9]/g, ''))} />
                        <button type="button" className="col-span-1 text-slate-300 text-lg leading-none"
                                onClick={() => quitarLinea(l.id)}>×</button>
                      </div>
                    ) : (
                      <div key={l.id} className="flex justify-between gap-2 text-sm py-0.5">
                        <span className="text-slate-700 flex-1 min-w-0 truncate">
                          {l.codigo ? <span className="text-slate-400">{l.codigo} · </span> : null}
                          {l.detalle}
                          {Number(l.cantidad) > 1 && <span className="text-slate-400"> ×{l.cantidad}</span>}
                        </span>
                        <span className="text-slate-500 shrink-0">
                          {num(l.precio_unit)
                            ? fmtCLP(num(l.cantidad) * num(l.precio_unit))
                            : <span style={{ color: '#e0a020' }}>sin valorizar</span>}
                        </span>
                      </div>
                    ))}

                    {enEdicion && (
                      <button type="button" className="text-xs text-blue-700 font-medium mt-1"
                              onClick={() => agregarLinea(tipo)}>+ Agregar línea</button>
                    )}
                    {!ls.length && !enEdicion && <p className="text-xs text-slate-300">Sin líneas.</p>}
                  </div>
                )
              })}

              {tareas.length > 0 && (
                <div className="rounded-lg border border-slate-200 p-2">
                  <p className="text-sm font-medium text-ink mb-1">
                    Tareas ({tareas.filter((t) => t.estado === 'terminada').length}/{tareas.length})
                  </p>
                  {tareas.map((t) => (
                    <div key={t.id} className="py-1 border-b border-slate-50 last:border-0">
                      <div className="flex gap-2 text-sm items-start">
                        <span className="shrink-0" style={{ color: t.estado === 'terminada' ? '#1f9d57' : '#cbd5e1' }}>
                          {t.estado === 'terminada' ? '✓' : '○'}
                        </span>
                        <span className="flex-1 text-slate-700">{t.titulo}</span>
                        {/* Quién la hizo: el dato con el que se calculan las
                            comisiones y se siguen los reprocesos. */}
                        <span className="text-[11px] px-1.5 py-0.5 rounded shrink-0"
                              style={t.usuarios?.nombre || t.tecnico_nombre
                                ? { background: '#f1f5f9', color: '#475569' }
                                : { color: '#cbd5e1' }}>
                          {t.usuarios?.nombre || t.tecnico_nombre || 'sin asignar'}
                        </span>
                      </div>
                      {t.observacion && (
                        <p className="text-xs text-slate-500 italic pl-5 mt-0.5">💬 {t.observacion}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {(total > 0 || porValorizar > 0) && (
                <div className="flex justify-between items-center rounded-lg p-3"
                     style={{ background: porValorizar ? '#fdf6e3' : '#f1f5f9' }}>
                  <span className="text-sm" style={{ color: porValorizar ? '#8a6d1f' : '#475569' }}>
                    {porValorizar
                      ? `Falta valorizar ${porValorizar} línea(s)`
                      : (ot.nro_documento ? `${ot.tipo_documento} ${ot.nro_documento}` : 'Sin documento emitido')}
                  </span>
                  <span className="text-lg font-semibold text-ink">{fmtCLP(total)}</span>
                </div>
              )}

              {!lineas.length && !tareas.length && (
                <p className="text-sm text-slate-400 text-center py-3">
                  Esta orden no tiene detalle cargado.
                </p>
              )}
            </>
          )}

          {ot.observaciones_entrega && (
            <div className="rounded-lg p-2" style={{ background: '#f8fafc' }}>
              <p className="text-[11px] text-slate-400 uppercase mb-0.5">Observaciones de entrega</p>
              <p className="text-sm text-slate-700">{ot.observaciones_entrega}</p>
              {ot.retira_nombre && (
                <p className="text-xs text-slate-400 mt-0.5">Retiró: {ot.retira_nombre}</p>
              )}
            </div>
          )}

          {msg && (
            <p className="text-xs px-2 py-1.5 rounded"
               style={{ background: msg.startsWith('No') ? '#fdecea' : '#e8f6ee',
                        color: msg.startsWith('No') ? '#8a1f18' : '#1f7a45' }}>{msg}</p>
          )}
          {!editable && (
            <p className="text-[11px] px-2 py-1.5 rounded" style={{ background: '#f1f5f9', color: '#64748b' }}>
              La orden está cerrada: el detalle no se puede modificar. Para corregir un monto o
              un documento hay que reabrirla desde administración.
            </p>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex gap-2 justify-end sticky bottom-0 bg-white">
          <button className="btn-soft text-sm" onClick={onCerrar}>Cerrar</button>
          {editable && lineas.some((l) => l._sucia || l._borrar) && (
            <button className="btn-primary text-sm" disabled={guardando} onClick={guardarCambios}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          )}
          {editable && !lineas.some((l) => l._sucia || l._borrar) && (
            <button className="btn-primary text-sm"
                    onClick={() => window.location.assign('/cierres')}>
              Registrar salida
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
