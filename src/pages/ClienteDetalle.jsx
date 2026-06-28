import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Pill, Modal, StatCard, SelectMarca, TimePicker } from '../components/UI'
import {
  segLabel, segColor, fmtCLP, fmtFecha, tipoClienteLabel, TIPOS_CLIENTE,
  TIPOS_ACTIVIDAD, RESULTADOS, VENTANAS, ESTADOS_PRESUPUESTO, ETAPAS_OPCIONALES,
  buildOtUrl, formatRut, formatTelefono, formatPatente, patenteLimpia,
  TIPOS_SERVICIO, tipoServicioLabel, RESULTADO_A_ETAPA, fmtHora,
  ESTADOS_GESTION, estadoGestionLabel, estadoGestionColor, ES_CIERRE,
  TIPOS_AGENDA, agendaLabel, colorAgenda,
  TIPOS_CONTACTO, MOTIVOS_CIERRE, motivoCierreLabel
} from '../lib/helpers'

const OT_URL = import.meta.env.VITE_REGISTRO_OT_URL || ''

const ACT_VACIA = {
  tipo: 'llamada', resultado: 'pendiente', tipo_servicio: '',
  fecha: new Date().toISOString().slice(0, 10),
  hora: '', descripcion: '', proxima_accion: '', proxima_fecha: '', proxima_hora: '',
  agenda_tipo: '', recordatorio_min: 15
}
const PRESUP_VACIO = {
  numero: '', descripcion: '', monto: '', estado: 'borrador', tipo_servicio: '',
  fecha_emision: new Date().toISOString().slice(0, 10),
  fecha_validez: '', proxima_gestion: '', notas: ''
}
const VEH_VACIO = {
  id: null, patente: '', marca: '', modelo: '', anio: '',
  km: '', proximo_servicio_km: '', tipo_mantencion: ''
}
const MANT = { basica: 'Básica', intermedia: 'Intermedia', mayor: 'Mayor' }
const ICONO = { llamada: '📞', whatsapp: '💬', email: '✉️', presencial: '🏢', visita: '🚗', propuesta: '📄', agendamiento: '📅' }

export default function ClienteDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { esAdmin } = useAuth()
  const [cliente, setCliente] = useState(null)
  const [vehiculos, setVehiculos] = useState([])
  const [estados, setEstados] = useState([])
  const [actividades, setActividades] = useState([])
  const [presupuestos, setPresupuestos] = useState([])
  const [servicios, setServicios] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [gestiones, setGestiones] = useState([])
  const [gestionTarget, setGestionTarget] = useState(null) // gestión a la que se agrega (null = nueva)
  const [modal, setModal] = useState(false)
  const [modalC, setModalC] = useState(false)
  const [modalV, setModalV] = useState(false)
  const [act, setAct] = useState(ACT_VACIA)
  const [conPresup, setConPresup] = useState(false)
  const [conAgenda, setConAgenda] = useState(false)
  const [presup, setPresup] = useState(PRESUP_VACIO)
  const [contacto, setContacto] = useState(null)
  const [veh, setVeh] = useState(VEH_VACIO)
  const [detalle, setDetalle] = useState(null) // {tipo:'act'|'presup', data}
  const [expandida, setExpandida] = useState({}) // gestion_id -> bool
  const [cerrando, setCerrando] = useState(null)  // { g, estado } al cerrar una gestión
  const [motivoCierre, setMotivoCierre] = useState('venta_concretada')

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    const { data: c } = await supabase.from('clientes')
      .select('*, usuarios(nombre)').eq('id', id).single()
    setCliente(c)
    const [vh, est, actv, pre, srv, ges] = await Promise.all([
      supabase.from('vehiculos').select('*').eq('cliente_id', id).order('creado_en'),
      supabase.from('pipeline_estados').select('*').order('orden'),
      supabase.from('actividades').select('*').eq('cliente_id', id).order('fecha', { ascending: false }),
      supabase.from('presupuestos').select('*').eq('cliente_id', id).order('fecha_emision', { ascending: false }),
      supabase.from('servicios').select('*').eq('cliente_id', id).order('fecha', { ascending: false }),
      supabase.from('gestiones').select('*, vehiculos(marca,modelo,patente), campanas(nombre)')
        .eq('cliente_id', id).order('creado_en', { ascending: false })
    ])
    setVehiculos(vh.data || []); setEstados(est.data || [])
    setActividades(actv.data || []); setPresupuestos(pre.data || [])
    setServicios(srv.data || []); setGestiones(ges.data || [])
    if (esAdmin) {
      const { data: v } = await supabase.from('usuarios')
        .select('id,nombre').eq('rol', 'vendedor').eq('activo', true)
      setVendedores(v || [])
    }
  }

  // --- Línea de tiempo de estado -------------------------------------
  const esPerdido = (e) => e.clave === 'perdido' || e.nombre === 'Perdido'
  const pasos = useMemo(
    () => estados.filter((e) => !esPerdido(e)).sort((a, b) => a.orden - b.orden),
    [estados]
  )
  const perdido = estados.find(esPerdido)
  const idxActual = pasos.findIndex((e) => e.id === cliente?.estado_id)

  async function cambiarEstado(estado_id) {
    await supabase.from('clientes').update({ estado_id }).eq('id', id); cargar()
  }
  async function cambiarVendedor(vendedor_id) {
    await supabase.from('clientes').update({ vendedor_id: vendedor_id || null }).eq('id', id); cargar()
  }

  // --- Guardados ------------------------------------------------------
  // Avanza el estado del cliente según el resultado de la actividad.
  // No retrocede (salvo que el destino sea "Perdido").
  async function avanzarEstadoPorResultado(resultado) {
    const clave = RESULTADO_A_ETAPA[resultado]
    if (!clave) return
    const destino = estados.find((e) => e.clave === clave) ||
                    estados.find((e) => e.nombre.toLowerCase() === clave)
    if (!destino) return
    const actual = estados.find((e) => e.id === cliente.estado_id)
    const esPerdido = destino.clave === 'perdido' || destino.nombre === 'Perdido'
    if (!esPerdido && actual && destino.orden <= actual.orden) return
    await supabase.from('clientes').update({ estado_id: destino.id }).eq('id', id)
  }

  // ---- Gestiones ----------------------------------------------------
  function nuevaGestion() {
    setGestionTarget(null)
    setAct(ACT_VACIA); setPresup(PRESUP_VACIO); setConPresup(false); setConAgenda(false)
    setModal(true)
  }
  function continuarGestion(g) {
    setGestionTarget(g)
    setAct(ACT_VACIA); setPresup(PRESUP_VACIO); setConPresup(false); setConAgenda(false)
    setModal(true)
  }
  async function cambiarEstadoGestion(g, estado) {
    if (ES_CIERRE.includes(estado)) {
      setMotivoCierre(estado === 'cerrada_perdida' ? 'cliente_rechazo' : 'venta_concretada')
      setCerrando({ g, estado })
      return
    }
    await supabase.from('gestiones').update({
      estado, abierta: true, cerrada_en: null, motivo_cierre: null
    }).eq('id', g.id)
    cargar()
  }
  async function confirmarCierre() {
    if (!cerrando) return
    await supabase.from('gestiones').update({
      estado: cerrando.estado, abierta: false,
      cerrada_en: new Date().toISOString(), motivo_cierre: motivoCierre
    }).eq('id', cerrando.g.id)
    setCerrando(null); cargar()
  }

  // Registro: agrega un contacto (y opcionalmente presupuesto y/o
  // agendamiento) a una gestión. Si es nueva, primero crea la gestión.
  async function guardarRegistro(e) {
    e.preventDefault()
    let gestionId = gestionTarget?.id

    if (!gestionId) {
      const v0 = vehiculos[0]
      const titulo = v0 ? `${v0.marca || ''} ${v0.modelo || ''}`.trim() || 'Gestión' : 'Gestión'
      const { data: ng, error: eg } = await supabase.from('gestiones').insert({
        empresa_id: cliente.empresa_id, cliente_id: id, vendedor_id: cliente.vendedor_id,
        vehiculo_id: v0?.id || null, titulo, estado: 'en_seguimiento', abierta: true
      }).select('id').single()
      if (eg) { alert('No se pudo crear la gestión: ' + eg.message); return }
      gestionId = ng.id
    }

    const { error } = await supabase.from('actividades').insert({
      tipo: act.tipo, resultado: act.resultado, fecha: act.fecha,
      hora: act.hora || null, descripcion: act.descripcion || null,
      proxima_accion: conAgenda ? (act.proxima_accion || null) : null,
      proxima_fecha: conAgenda ? (act.proxima_fecha || null) : null,
      proxima_hora: conAgenda ? (act.proxima_hora || null) : null,
      agenda_tipo: conAgenda ? (act.agenda_tipo || null) : null,
      recordatorio_min: conAgenda ? (act.recordatorio_min || null) : null,
      tipo_servicio: act.tipo_servicio || null,
      cliente_id: id, empresa_id: cliente.empresa_id,
      vendedor_id: cliente.vendedor_id, gestion_id: gestionId
    })
    if (error) { alert('Error: ' + error.message); return }

    if (conPresup && (presup.monto || presup.descripcion || presup.numero)) {
      const { error: e2 } = await supabase.from('presupuestos').insert({
        ...presup, cliente_id: id, empresa_id: cliente.empresa_id,
        vendedor_id: cliente.vendedor_id, monto: Number(presup.monto) || 0,
        fecha_validez: presup.fecha_validez || null,
        proxima_gestion: presup.proxima_gestion || null,
        tipo_servicio: presup.tipo_servicio || act.tipo_servicio || null,
        gestion_id: gestionId
      })
      if (e2) { alert('Contacto guardado, pero el presupuesto falló: ' + e2.message) }
    }

    // Avance suave del estado de la gestión (no retrocede; respeta cierres)
    const g = gestiones.find((x) => x.id === gestionId)
    if (g && !ES_CIERRE.includes(g.estado)) {
      let nuevo = g.estado
      if (conAgenda && act.agenda_tipo) nuevo = 'agendada'
      if (conPresup) nuevo = 'presupuesto_entregado'
      if (nuevo !== g.estado) await supabase.from('gestiones').update({ estado: nuevo }).eq('id', gestionId)
    }

    await avanzarEstadoPorResultado(act.resultado)
    setModal(false); setAct(ACT_VACIA); setPresup(PRESUP_VACIO)
    setConPresup(false); setConAgenda(false); setGestionTarget(null); cargar()
  }

  async function cambiarEstadoPresup(pid, estado) {
    await supabase.from('presupuestos').update({ estado }).eq('id', pid)
    setDetalle((d) => d && d.tipo === 'presup' && d.data.id === pid
      ? { ...d, data: { ...d.data, estado } } : d)
    cargar()
  }

  async function eliminarCliente() {
    if (!confirm(`¿Eliminar al cliente "${cliente.nombre}" y todos sus vehículos, actividades y presupuestos? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    navigate('/clientes')
  }

  async function guardarContacto(e) {
    e.preventDefault()
    const { error } = await supabase.from('clientes').update({
      nombre: contacto.nombre, email: contacto.email,
      telefono: contacto.telefono ? formatTelefono(contacto.telefono) : null,
      ciudad: contacto.ciudad, tipo: contacto.tipo, marca_principal: contacto.marca_principal,
      direccion: contacto.direccion || null, comuna: contacto.comuna || null,
      rut: contacto.rut ? formatRut(contacto.rut) : null
    }).eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    setModalC(false); cargar()
  }

  async function guardarVehiculo(e) {
    e.preventDefault()
    const km = Number(veh.km) || null
    const payload = {
      cliente_id: id, empresa_id: cliente.empresa_id,
      patente: veh.patente ? formatPatente(veh.patente) : null, marca: veh.marca || null,
      modelo: veh.modelo || null, anio: Number(veh.anio) || null,
      km_ultimo: km, km_actual_estimado: km,
      proximo_servicio_km: Number(veh.proximo_servicio_km) || null,
      tipo_mantencion: veh.tipo_mantencion || null
    }
    const { error } = veh.id
      ? await supabase.from('vehiculos').update(payload).eq('id', veh.id)
      : await supabase.from('vehiculos').insert(payload)
    if (error) { alert('Error: ' + error.message); return }
    setModalV(false); setVeh(VEH_VACIO); cargar()
  }

  async function borrarVehiculo(vid) {
    if (!confirm('¿Eliminar este vehículo?')) return
    await supabase.from('vehiculos').delete().eq('id', vid); cargar()
  }

  // Deriva a una nueva OT en el formulario externo, prellenando datos.
  function nuevaOT(vehiculo) {
    if (!OT_URL) {
      alert('Configura la URL del registro de OT en VITE_REGISTRO_OT_URL (Vercel) para habilitar este botón.')
      return
    }
    const params = {
      nombre: cliente.nombre, telefono: cliente.telefono, email: cliente.email,
      ciudad: cliente.ciudad, documento: cliente.rut,
      marca: vehiculo?.marca || cliente.marca_principal,
      modelo: vehiculo?.modelo || '',
      anio: vehiculo?.anio || '',
      patente: patenteLimpia(vehiculo?.patente),
      km: vehiculo?.km_actual_estimado || vehiculo?.km_ultimo || ''
    }
    window.open(buildOtUrl(OT_URL, params), '_blank', 'noopener')
  }

  function abrirEditarVehiculo(v) {
    setVeh({
      id: v.id, patente: v.patente || '', marca: v.marca || '', modelo: v.modelo || '',
      anio: v.anio || '', km: v.km_actual_estimado || v.km_ultimo || '',
      proximo_servicio_km: v.proximo_servicio_km || '', tipo_mantencion: v.tipo_mantencion || ''
    })
    setModalV(true)
  }

  if (!cliente) return <div className="text-slate-400 text-sm">Cargando…</div>

  const estadoActual = estados.find((e) => e.id === cliente.estado_id)

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => navigate('/clientes')}
              className="text-sm text-slate-500 hover:text-deep">← Volver a clientes</button>

      {/* Cabecera: quién es el cliente */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-ink">{cliente.nombre}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {cliente.segmento && <Pill color={segColor(cliente.segmento)}>{segLabel(cliente.segmento)}</Pill>}
              <span className="pill bg-mist text-deep">{tipoClienteLabel(cliente.tipo)}</span>
              {cliente.marca_principal && (
                <span className="pill bg-ink text-white">{cliente.marca_principal}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-slate-400">Facturación histórica</div>
              <div className="text-xl font-bold text-ink">{fmtCLP(cliente.facturacion_total)}</div>
            </div>
            <div className="flex flex-col gap-2">
              <button className="btn-primary text-xs py-1.5" onClick={() => nuevaOT(vehiculos[0])}>
                + Nueva OT
              </button>
              <button className="btn-soft text-xs py-1.5"
                      onClick={() => { setContacto({
                        nombre: cliente.nombre, email: cliente.email || '', telefono: cliente.telefono || '',
                        ciudad: cliente.ciudad || '', tipo: cliente.tipo || 'PERSONA',
                        marca_principal: cliente.marca_principal || '', rut: cliente.rut || '',
                        direccion: cliente.direccion || '', comuna: cliente.comuna || ''
                      }); setModalC(true) }}>
                Editar
              </button>
              {esAdmin && (
                <button className="text-xs py-1.5 text-red-500 hover:text-red-600 hover:underline"
                        onClick={eliminarCliente}>
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Resumen rápido para el vendedor */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <StatCard titulo="Visitas (OT)" valor={cliente.num_ot || 0} />
          <StatCard titulo="Ticket promedio" valor={fmtCLP(cliente.ticket_promedio)} />
          <StatCard titulo="Última visita" valor={fmtFecha(cliente.ultima_visita)}
                    sub={cliente.recencia_dias != null ? `hace ${cliente.recencia_dias} días` : ''} />
          <StatCard titulo="Vehículos" valor={vehiculos.length} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 text-sm border-t border-slate-100 pt-4">
          <div><div className="text-xs text-slate-400">RUT</div>{cliente.rut || '—'}</div>
          <div><div className="text-xs text-slate-400">Teléfono</div>{cliente.telefono ? formatTelefono(cliente.telefono) : '—'}</div>
          <div><div className="text-xs text-slate-400">Correo</div>{cliente.email || '—'}</div>
          <div><div className="text-xs text-slate-400">Ciudad</div>{cliente.ciudad || '—'}</div>
          <div className="col-span-2"><div className="text-xs text-slate-400">Dirección</div>{cliente.direccion || '—'}</div>
          <div><div className="text-xs text-slate-400">Comuna</div>{cliente.comuna || '—'}</div>
        </div>

        {/* Asignación de vendedor */}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="text-xs text-slate-400 mb-1">Vendedor asignado</div>
          {esAdmin ? (
            <select className="input sm:max-w-xs" value={cliente.vendedor_id || ''}
                    onChange={(e) => cambiarVendedor(e.target.value)}>
              <option value="">Sin asignar</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
          ) : (
            <div className="text-sm font-medium text-ink">{cliente.usuarios?.nombre || 'Sin asignar'}</div>
          )}
        </div>

        {cliente.accion_recomendada && (
          <div className="mt-4 rounded-lg bg-sky/10 px-4 py-3 text-sm text-deep">
            <span className="font-medium">Acción recomendada:</span> {cliente.accion_recomendada}
          </div>
        )}
      </div>

      {/* Línea de tiempo de estado */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-ink">Estado de gestión</h3>
          {perdido && (
            <button onClick={() => cambiarEstado(perdido.id)}
                    className={`pill border transition ${cliente.estado_id === perdido.id ? '' : 'text-slate-500'}`}
                    style={cliente.estado_id === perdido.id
                      ? { background: perdido.color, borderColor: perdido.color, color: '#fff' }
                      : { borderColor: '#e2e8f0' }}>
              Perdido
            </button>
          )}
        </div>
        <div className="stepper">
          {pasos.map((e, i) => {
            const alcanzado = idxActual >= 0 && i <= idxActual
            const actual = cliente.estado_id === e.id
            const opcional = ETAPAS_OPCIONALES.includes(e.clave)
            return (
              <div key={e.id} className="flex items-center" style={{ flex: i < pasos.length - 1 ? 1 : '0 0 auto' }}>
                <button onClick={() => cambiarEstado(e.id)} className="flex flex-col items-center gap-1 shrink-0"
                        title={e.nombre}>
                  <span className="step-dot"
                        style={alcanzado
                          ? { background: e.color, borderColor: e.color, color: '#fff' }
                          : { background: '#fff', borderColor: opcional ? '#cbd5e1' : '#e2e8f0',
                              color: '#94a3b8', borderStyle: opcional ? 'dashed' : 'solid' }}>
                    {alcanzado ? '✓' : i + 1}
                  </span>
                  <span className={`text-[10px] text-center leading-tight max-w-[64px] ${actual ? 'font-semibold text-ink' : 'text-slate-400'}`}>
                    {e.nombre}{opcional ? ' *' : ''}
                  </span>
                </button>
                {i < pasos.length - 1 && (
                  <span className="step-line" style={{ background: i < idxActual ? e.color : '#e2e8f0' }} />
                )}
              </div>
            )
          })}
        </div>
        {estadoActual && (
          <div className="text-xs text-slate-400 mt-3">
            Estado actual: <span className="font-medium" style={{ color: estadoActual.color }}>{estadoActual.nombre}</span>
            {ETAPAS_OPCIONALES.length > 0 && <span className="ml-2">· (*) etapa opcional</span>}
          </div>
        )}
      </div>

      {/* Vehículos + historial de mantención */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-ink">Vehículos ({vehiculos.length})</h3>
          <button className="btn-primary text-xs py-1.5"
                  onClick={() => { setVeh(VEH_VACIO); setModalV(true) }}>+ Agregar vehículo</button>
        </div>
        {vehiculos.length ? (
          <div className="space-y-3">
            {vehiculos.map((v) => {
              const km = v.km_actual_estimado || v.km_ultimo
              return (
                <div key={v.id} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-ink">
                        {v.marca} {v.modelo}{v.anio ? <span className="text-slate-400"> · {v.anio}</span> : null}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">Patente {v.patente ? formatPatente(v.patente) : '—'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {v.ventana && <Pill color={VENTANAS[v.ventana]?.color}>{VENTANAS[v.ventana]?.label}</Pill>}
                      <button onClick={() => nuevaOT(v)} className="text-xs text-didial-red font-medium hover:underline">Nueva OT</button>
                      <button onClick={() => abrirEditarVehiculo(v)} className="text-xs text-deep hover:underline">Editar</button>
                      <button onClick={() => borrarVehiculo(v.id)} className="text-xs text-slate-300 hover:text-red-500">✕</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-slate-500">
                    <div><span className="text-slate-400">Km actual:</span> {km ? km.toLocaleString('es-CL') : '—'}</div>
                    <div><span className="text-slate-400">Próx. servicio:</span> {v.proximo_servicio_km ? v.proximo_servicio_km.toLocaleString('es-CL') + ' km' : '—'}</div>
                    <div><span className="text-slate-400">Mantención:</span> {MANT[v.tipo_mantencion] || '—'}</div>
                  </div>
                  {(() => {
                    const hist = servicios.filter((s) =>
                      s.vehiculo_id === v.id ||
                      (s.patente && v.patente && patenteLimpia(s.patente) === patenteLimpia(v.patente)))
                    if (!hist.length) return null
                    return (
                      <div className="mt-3 border-t border-slate-100 pt-2">
                        <div className="text-[11px] font-semibold text-slate-400 mb-1">Historial de servicios ({hist.length})</div>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {hist.map((s) => (
                            <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-slate-400 w-20 shrink-0">{s.fecha ? fmtFecha(s.fecha) : '—'}</span>
                                <span className="text-ink truncate">
                                  {tipoServicioLabel(s.tipo_servicio)}
                                  {s.tipo_servicio_2 ? ` + ${tipoServicioLabel(s.tipo_servicio_2)}` : ''}
                                  {s.descripcion ? ` · ${s.descripcion}` : ''}
                                </span>
                              </div>
                              <span className="text-slate-500 shrink-0">{s.monto ? fmtCLP(s.monto) : ''}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        ) : <p className="text-sm text-slate-400">Sin vehículos registrados.</p>}
        <p className="text-[11px] text-slate-400 mt-3">
          El historial de OT por patente se alimenta desde la base de OT (sincronización). Aquí ves la mantención vigente de cada vehículo.
        </p>
      </div>

      {/* Gestiones: procesos comerciales abiertos */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <div>
            <h3 className="font-semibold text-ink">Gestiones</h3>
            <p className="text-xs text-slate-400">
              {gestiones.filter((g) => g.abierta).length} abierta(s) · {gestiones.length} en total
            </p>
          </div>
          <button className="btn-primary text-xs py-1.5" onClick={nuevaGestion}>+ Nueva gestión</button>
        </div>

        {gestiones.length === 0 ? (
          <p className="text-sm text-slate-400">Sin gestiones. Crea la primera para registrar el contacto con el cliente.</p>
        ) : (
          <div className="space-y-3">
            {gestiones.map((g) => {
              const evs = [
                ...actividades.filter((a) => a.gestion_id === g.id).map((a) => ({ kind: 'act', d: a, f: a.fecha })),
                ...presupuestos.filter((p) => p.gestion_id === g.id).map((p) => ({ kind: 'presup', d: p, f: p.fecha_emision }))
              ].sort((a, b) => (a.f < b.f ? -1 : a.f > b.f ? 1 : 0))
              const abierto = expandida[g.id] ?? g.abierta
              return (
                <div key={g.id} className={`border rounded-xl ${g.abierta ? 'border-slate-200' : 'border-slate-100 bg-slate-50'}`}>
                  <div className="p-3 flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-ink text-sm">{g.titulo || 'Gestión'}</span>
                        {g.vehiculos?.patente && <span className="pill bg-ink text-white">{g.vehiculos.marca} {g.vehiculos.modelo}</span>}
                        {g.campanas?.nombre && <span className="pill bg-mist text-deep">{g.campanas.nombre}</span>}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Abierta {fmtFecha(g.creado_en?.slice(0,10))} · {evs.length} evento(s)
                        {!g.abierta && g.cerrada_en && (
                          <span className="text-slate-500"> · Cerrada {fmtFecha(g.cerrada_en.slice(0,10))} · {motivoCierreLabel(g.motivo_cierre)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={g.estado} onChange={(e) => cambiarEstadoGestion(g, e.target.value)}
                              className="text-xs rounded-md border px-2 py-1 font-medium"
                              style={{ color: estadoGestionColor(g.estado), borderColor: estadoGestionColor(g.estado) + '55' }}>
                        {Object.entries(ESTADOS_GESTION).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                      <button onClick={() => setExpandida((p) => ({ ...p, [g.id]: !abierto }))}
                              className="text-xs text-slate-400 hover:text-deep">{abierto ? '▲' : '▼'}</button>
                    </div>
                  </div>

                  {abierto && (
                    <div className="px-3 pb-3">
                      {/* Timeline de la gestión */}
                      {evs.length ? (
                        <div className="relative pl-5 border-l-2 border-slate-100 space-y-3 ml-1">
                          {evs.map((ev, i) => (
                            <div key={i} className="relative cursor-pointer"
                                 onClick={() => setDetalle(ev.kind === 'act' ? { tipo: 'act', data: ev.d } : { tipo: 'presup', data: ev.d })}>
                              <span className="absolute -left-[26px] top-0.5 text-sm">
                                {ev.kind === 'presup' ? '📄' : (ICONO[ev.d.tipo] || '•')}
                              </span>
                              {ev.kind === 'act' ? (
                                <div className="hover:bg-paper rounded p-1 -m-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium text-ink">{TIPOS_ACTIVIDAD[ev.d.tipo]}</span>
                                    <span className="text-xs text-slate-400">{fmtFecha(ev.d.fecha)}</span>
                                  </div>
                                  <div className="text-xs text-slate-500">{RESULTADOS[ev.d.resultado]}
                                    {ev.d.tipo_servicio && <span className="ml-1 pill bg-mist text-deep">{tipoServicioLabel(ev.d.tipo_servicio)}</span>}
                                  </div>
                                  {ev.d.descripcion && <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">{ev.d.descripcion}</p>}
                                  {ev.d.proxima_fecha && (
                                    <div className="mt-1 inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full text-white"
                                         style={{ background: colorAgenda(ev.d.agenda_tipo) }}>
                                      📅 {agendaLabel(ev.d.agenda_tipo)} · {fmtFecha(ev.d.proxima_fecha)}{ev.d.proxima_hora ? ' ' + fmtHora(ev.d.proxima_hora) : ''}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="hover:bg-paper rounded p-1 -m-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium text-ink">Presupuesto {ev.d.numero ? `N° ${ev.d.numero}` : ''} · {fmtCLP(ev.d.monto)}</span>
                                    <span className="text-xs" style={{ color: ESTADOS_PRESUPUESTO[ev.d.estado]?.color }}>{ESTADOS_PRESUPUESTO[ev.d.estado]?.label}</span>
                                  </div>
                                  {ev.d.descripcion && <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">{ev.d.descripcion}</p>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-sm text-slate-400">Sin eventos todavía.</p>}

                      {g.abierta && (
                        <button onClick={() => continuarGestion(g)}
                                className="btn-soft text-xs py-1.5 mt-3">+ Continuar gestión</button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal registrar gestión: Contacto / Presupuesto / Agendamiento */}
      <Modal abierto={modal} onClose={() => setModal(false)}
             titulo={gestionTarget ? 'Continuar gestión' : 'Nueva gestión'} ancho="max-w-xl">
        <form onSubmit={guardarRegistro} className="space-y-4">
          {gestionTarget && (
            <div className="rounded-lg bg-sky/10 px-3 py-2 text-xs text-deep">
              Agregando al historial de: <span className="font-medium">{gestionTarget.titulo || 'gestión'}</span>
            </div>
          )}

          {/* ---- Paso 1: Contacto (lo que ya ocurrió) ---- */}
          <div className="rounded-xl border border-slate-200 p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="w-5 h-5 rounded-full bg-deep text-white text-xs flex items-center justify-center">1</span>
              Contacto
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Tipo de contacto</label>
                <select className="input" value={act.tipo} onChange={(e) => setAct({ ...act, tipo: e.target.value })}>
                  {TIPOS_CONTACTO.map((k) => <option key={k} value={k}>{TIPOS_ACTIVIDAD[k]}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Fecha</label>
                <input className="input" type="date" value={act.fecha} onChange={(e) => setAct({ ...act, fecha: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Resultado del contacto *</label>
              <select className="input" value={act.resultado} required
                      onChange={(e) => setAct({ ...act, resultado: e.target.value })}>
                {Object.entries(RESULTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tipo de servicio solicitado</label>
              <select className="input" value={act.tipo_servicio}
                      onChange={(e) => setAct({ ...act, tipo_servicio: e.target.value })}>
                <option value="">— Sin especificar —</option>
                {Object.entries(TIPOS_SERVICIO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Observaciones</label>
              <textarea className="input" rows="3" value={act.descripcion}
                        onChange={(e) => setAct({ ...act, descripcion: e.target.value })}
                        placeholder="¿Qué dijo el cliente? Detalles relevantes de la conversación." />
            </div>
          </div>

          {/* ---- Paso 2: Presupuesto (opcional) ---- */}
          <div className="rounded-xl border border-slate-200">
            <label className="flex items-center gap-2 px-3 py-2.5 cursor-pointer">
              <input type="checkbox" checked={conPresup} onChange={(e) => setConPresup(e.target.checked)} />
              <span className="w-5 h-5 rounded-full bg-mist text-deep text-xs flex items-center justify-center">2</span>
              <span className="text-sm font-semibold text-ink">Presupuesto</span>
              <span className="text-xs text-slate-400">(opcional)</span>
            </label>
            {conPresup && (
              <div className="px-3 pb-3 space-y-3 border-t border-slate-100 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">N° presupuesto</label>
                    <input className="input" value={presup.numero} onChange={(e) => setPresup({ ...presup, numero: e.target.value })} placeholder="Opcional" />
                  </div>
                  <div>
                    <label className="label">Monto (CLP)</label>
                    <input className="input" type="number" value={presup.monto} onChange={(e) => setPresup({ ...presup, monto: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="label">Detalle del trabajo</label>
                  <textarea className="input" rows="2" value={presup.descripcion} onChange={(e) => setPresup({ ...presup, descripcion: e.target.value })}
                            placeholder="Ej: cambio de embrague + revisión frenos" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Estado</label>
                    <select className="input" value={presup.estado} onChange={(e) => setPresup({ ...presup, estado: e.target.value })}>
                      {Object.entries(ESTADOS_PRESUPUESTO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Validez hasta</label>
                    <input className="input" type="date" value={presup.fecha_validez} onChange={(e) => setPresup({ ...presup, fecha_validez: e.target.value })} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ---- Paso 3: Agendamiento (opcional, apariencia de agenda) ---- */}
          <div className={`rounded-xl border ${conAgenda ? 'border-deep/30' : 'border-slate-200'}`}>
            <label className="flex items-center gap-2 px-3 py-2.5 cursor-pointer">
              <input type="checkbox" checked={conAgenda} onChange={(e) => setConAgenda(e.target.checked)} />
              <span className="w-5 h-5 rounded-full bg-mist text-deep text-xs flex items-center justify-center">3</span>
              <span className="text-sm font-semibold text-ink">Agendamiento</span>
              <span className="text-xs text-slate-400">(acción futura · opcional)</span>
            </label>
            {conAgenda && (
              <div className="px-3 pb-3 pt-1 border-t border-slate-100">
                <div className="rounded-lg bg-paper p-3 space-y-3">
                  <div>
                    <label className="label">Tipo de agendamiento</label>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(TIPOS_AGENDA).map(([k, v]) => (
                        <button type="button" key={k}
                                onClick={() => setAct({ ...act, agenda_tipo: k })}
                                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs
                                  ${act.agenda_tipo === k ? 'border-transparent text-white' : 'border-slate-200 text-slate-600 bg-white'}`}
                                style={act.agenda_tipo === k ? { background: v.color } : {}}>
                          <span className="w-2 h-2 rounded-full" style={{ background: act.agenda_tipo === k ? '#fff' : v.color }} />
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">Próxima acción</label>
                    <input className="input" value={act.proxima_accion}
                           onChange={(e) => setAct({ ...act, proxima_accion: e.target.value })}
                           placeholder="Ej: confirmar hora de la visita" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label">Fecha</label>
                      <input className="input" type="date" value={act.proxima_fecha}
                             onChange={(e) => setAct({ ...act, proxima_fecha: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Hora</label>
                      <TimePicker value={act.proxima_hora} onChange={(v) => setAct({ ...act, proxima_hora: v })} />
                    </div>
                    <div>
                      <label className="label">Recordatorio</label>
                      <select className="input" value={act.recordatorio_min}
                              onChange={(e) => setAct({ ...act, recordatorio_min: Number(e.target.value) })}>
                        <option value="0">Sin aviso</option>
                        <option value="15">15 min antes</option>
                        <option value="30">30 min antes</option>
                        <option value="60">1 hora antes</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-soft" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary">{gestionTarget ? 'Agregar al historial' : 'Crear gestión'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal cerrar gestión */}
      <Modal abierto={!!cerrando} onClose={() => setCerrando(null)} titulo="Cerrar gestión">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Vas a marcar esta gestión como <span className="font-semibold" style={{ color: estadoGestionColor(cerrando?.estado) }}>{estadoGestionLabel(cerrando?.estado)}</span>. Indica el motivo de cierre:
          </p>
          <div>
            <label className="label">Motivo de cierre</label>
            <select className="input" value={motivoCierre} onChange={(e) => setMotivoCierre(e.target.value)}>
              {Object.entries(MOTIVOS_CIERRE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-soft" onClick={() => setCerrando(null)}>Cancelar</button>
            <button className="btn-primary" onClick={confirmarCierre}>Cerrar gestión</button>
          </div>
        </div>
      </Modal>

      {/* Modal detalle de registro (solo lectura) */}
      <Modal abierto={!!detalle} onClose={() => setDetalle(null)}
             titulo={detalle?.tipo === 'presup' ? 'Detalle del presupuesto' : 'Detalle del seguimiento'}>
        {detalle?.tipo === 'act' && (
          <div className="space-y-2 text-sm">
            <Campo k="Tipo de contacto" v={TIPOS_ACTIVIDAD[detalle.data.tipo]} />
            <Campo k="Fecha" v={`${fmtFecha(detalle.data.fecha)}${detalle.data.hora ? ' · ' + detalle.data.hora.slice(0,5) : ''}`} />
            <Campo k="Resultado / estado" v={RESULTADOS[detalle.data.resultado]} />
            <Campo k="Tipo de servicio" v={tipoServicioLabel(detalle.data.tipo_servicio)} />
            <Campo k="Observaciones" v={detalle.data.descripcion || '—'} />
            <Campo k="Próxima acción" v={detalle.data.proxima_accion
              ? `${detalle.data.proxima_accion}${detalle.data.proxima_fecha ? ' · ' + fmtFecha(detalle.data.proxima_fecha) : ''}${detalle.data.proxima_hora ? ' ' + fmtHora(detalle.data.proxima_hora) : ''}` : '—'} />
            {detalle.data.monto_recuperado ? <Campo k="Monto recuperado" v={fmtCLP(detalle.data.monto_recuperado)} /> : null}
          </div>
        )}
        {detalle?.tipo === 'presup' && (
          <div className="space-y-2 text-sm">
            <Campo k="N° presupuesto" v={detalle.data.numero || '—'} />
            <Campo k="Monto" v={fmtCLP(detalle.data.monto)} />
            <Campo k="Estado" v={ESTADOS_PRESUPUESTO[detalle.data.estado]?.label} />
            <Campo k="Tipo de servicio" v={tipoServicioLabel(detalle.data.tipo_servicio)} />
            <Campo k="Detalle" v={detalle.data.descripcion || '—'} />
            <Campo k="Emitido" v={fmtFecha(detalle.data.fecha_emision)} />
            <Campo k="Validez" v={detalle.data.fecha_validez ? fmtFecha(detalle.data.fecha_validez) : '—'} />
            <Campo k="Próxima gestión" v={detalle.data.proxima_gestion ? fmtFecha(detalle.data.proxima_gestion) : '—'} />
            {detalle.data.notas ? <Campo k="Notas" v={detalle.data.notas} /> : null}
          </div>
        )}
      </Modal>

      {/* Modal editar contacto */}
      <Modal abierto={modalC} onClose={() => setModalC(false)} titulo="Editar datos de contacto">
        {contacto && (
          <form onSubmit={guardarContacto} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" required value={contacto.nombre}
                       onChange={(e) => setContacto({ ...contacto, nombre: e.target.value })} />
              </div>
              <div>
                <label className="label">RUT</label>
                <input className="input" value={contacto.rut}
                       onChange={(e) => setContacto({ ...contacto, rut: e.target.value })}
                       onBlur={(e) => setContacto({ ...contacto, rut: formatRut(e.target.value) })}
                       placeholder="12.345.678-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Teléfono</label>
                <input className="input" value={contacto.telefono}
                       onChange={(e) => setContacto({ ...contacto, telefono: e.target.value })} />
              </div>
              <div>
                <label className="label">Correo</label>
                <input className="input" type="email" value={contacto.email}
                       onChange={(e) => setContacto({ ...contacto, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Ciudad</label>
                <input className="input" value={contacto.ciudad}
                       onChange={(e) => setContacto({ ...contacto, ciudad: e.target.value })} />
              </div>
              <div>
                <label className="label">Tipo</label>
                <select className="input" value={contacto.tipo}
                        onChange={(e) => setContacto({ ...contacto, tipo: e.target.value })}>
                  {Object.entries(TIPOS_CLIENTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Marca</label>
                <input className="input" value={contacto.marca_principal}
                       onChange={(e) => setContacto({ ...contacto, marca_principal: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div>
              <label className="label">Dirección</label>
              <input className="input" value={contacto.direccion} placeholder="Calle y número"
                     onChange={(e) => setContacto({ ...contacto, direccion: e.target.value })} />
            </div>
            <div>
              <label className="label">Comuna</label>
              <input className="input" value={contacto.comuna}
                     onChange={(e) => setContacto({ ...contacto, comuna: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-soft" onClick={() => setModalC(false)}>Cancelar</button>
              <button className="btn-primary">Guardar cambios</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal vehículo (agregar/editar) */}
      <Modal abierto={modalV} onClose={() => { setModalV(false); setVeh(VEH_VACIO) }}
             titulo={veh.id ? 'Editar vehículo' : 'Agregar vehículo'}>
        <form onSubmit={guardarVehiculo} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Marca</label>
              <SelectMarca value={veh.marca} onChange={(v) => setVeh({ ...veh, marca: v })} />
            </div>
            <div>
              <label className="label">Modelo</label>
              <input className="input" value={veh.modelo}
                     onChange={(e) => setVeh({ ...veh, modelo: e.target.value })} />
            </div>
            <div>
              <label className="label">Año</label>
              <input className="input" type="number" value={veh.anio}
                     onChange={(e) => setVeh({ ...veh, anio: e.target.value })} />
            </div>
            <div>
              <label className="label">Patente</label>
              <input className="input" value={veh.patente}
                     onChange={(e) => setVeh({ ...veh, patente: e.target.value.toUpperCase() })}
                     onBlur={(e) => setVeh({ ...veh, patente: formatPatente(e.target.value) })}
                     placeholder="XX XX XX" />
            </div>
            <div>
              <label className="label">Kilometraje</label>
              <input className="input" type="number" value={veh.km}
                     onChange={(e) => setVeh({ ...veh, km: e.target.value })} />
            </div>
            <div>
              <label className="label">Próximo servicio (km)</label>
              <input className="input" type="number" value={veh.proximo_servicio_km}
                     onChange={(e) => setVeh({ ...veh, proximo_servicio_km: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="label">Tipo de mantención</label>
              <select className="input" value={veh.tipo_mantencion}
                      onChange={(e) => setVeh({ ...veh, tipo_mantencion: e.target.value })}>
                <option value="">—</option>
                {Object.entries(MANT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-soft" onClick={() => { setModalV(false); setVeh(VEH_VACIO) }}>Cancelar</button>
            <button className="btn-primary">{veh.id ? 'Guardar cambios' : 'Agregar vehículo'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function Campo({ k, v }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-400 w-36 shrink-0">{k}</span>
      <span className="text-ink whitespace-pre-wrap">{v || '—'}</span>
    </div>
  )
}
