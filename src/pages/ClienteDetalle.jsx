import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Pill, Modal, StatCard, SelectMarca, TimePicker } from '../components/UI'
import {
  segLabel, segColor, fmtCLP, fmtFecha, tipoClienteLabel, TIPOS_CLIENTE,
  TIPOS_ACTIVIDAD, RESULTADOS, VENTANAS, ESTADOS_PRESUPUESTO, ETAPAS_OPCIONALES,
  formatRut, formatTelefono, formatPatente, patenteLimpia,
  TIPOS_SERVICIO, tipoServicioLabel, RESULTADO_A_ETAPA, fmtHora,
  ESTADOS_GESTION, estadoGestionLabel, estadoGestionColor, ES_CIERRE,
  TIPOS_AGENDA, agendaLabel, colorAgenda,
  TIPOS_CONTACTO, MOTIVOS_CIERRE, motivoCierreLabel,
  ESTADOS_TALLER, OT_SVC_GRUPOS, TIPOS_VEHICULO,
  SECCIONES_PRESUP, seccionDe, nombreCompleto, desgloseIVA, enviarASheet
} from '../lib/helpers'
import { notificar } from '../lib/notificar'


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
  km: '', proximo_servicio_km: '', tipo_mantencion: '', tipo_vehiculo: ''
}
const MANT = { basica: 'Básica', intermedia: 'Intermedia', mayor: 'Mayor' }
const ICONO = { llamada: '📞', whatsapp: '💬', email: '✉️', presencial: '🏢', visita: '🚗', propuesta: '📄', agendamiento: '📅' }

export default function ClienteDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { esAdmin, perfil } = useAuth()
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
  const [trabajos, setTrabajos] = useState([])
  const [presupsTaller, setPresupsTaller] = useState([])
  const [margenes, setMargenes] = useState({ ajuste_asesor_pct: 10 })
  const [modalTaller, setModalTaller] = useState(null) // vehículo a derivar
  const [ft, setFt] = useState({ servicio: '', tareas: [''], obs: '' })
  const [sheetUpdateUrl, setSheetUpdateUrl] = useState('')
  const [tareasCat, setTareasCat] = useState({}) // servicio -> [titulos]

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    const { data: c } = await supabase.from('clientes')
      .select('*, usuarios(nombre)').eq('id', id).single()
    setCliente(c)
    const [vh, est, actv, pre, srv, ges, tt] = await Promise.all([
      supabase.from('vehiculos').select('*').eq('cliente_id', id).order('creado_en'),
      supabase.from('pipeline_estados').select('*').order('orden'),
      supabase.from('actividades').select('*').eq('cliente_id', id).order('fecha', { ascending: false }),
      supabase.from('presupuestos').select('*').eq('cliente_id', id).order('fecha_emision', { ascending: false }),
      supabase.from('servicios').select('*').eq('cliente_id', id).order('fecha', { ascending: false }),
      supabase.from('gestiones').select('*, vehiculos(marca,modelo,patente), campanas(nombre)')
        .eq('cliente_id', id).order('creado_en', { ascending: false }),
      supabase.from('trabajos_taller').select('*').eq('cliente_id', id).order('creado_en', { ascending: false })
    ])
    setVehiculos(vh.data || []); setEstados(est.data || [])
    setActividades(actv.data || []); setPresupuestos(pre.data || [])
    setServicios(srv.data || []); setGestiones(ges.data || [])
    setTrabajos(tt.data || [])
    const ids = (tt.data || []).map((x) => x.id)
    if (ids.length) {
      const [{ data: pp }, { data: mg }] = await Promise.all([
        supabase.from('presupuestos_taller').select('*').in('trabajo_id', ids).order('creado_en', { ascending: false }),
        supabase.from('empresa_config').select('valor').eq('empresa_id', perfil?.empresa_id).eq('clave', 'margenes').maybeSingle()
      ])
      setPresupsTaller(pp || [])
      if (mg?.valor) setMargenes((m) => ({ ...m, ...mg.valor }))
    } else setPresupsTaller([])
    if (esAdmin) {
      const { data: v } = await supabase.from('usuarios')
        .select('id,nombre').eq('rol', 'vendedor').eq('activo', true)
      setVendedores(v || [])
    }
    // v21: URL del Apps Script de actualización de la planilla + tareas predefinidas
    const [{ data: su }, { data: ts }] = await Promise.all([
      supabase.from('empresa_config').select('valor').eq('empresa_id', perfil?.empresa_id).eq('clave', 'sheet_update_url').maybeSingle(),
      supabase.from('tareas_servicio').select('servicio,titulo,orden').order('orden')
    ])
    if (su?.valor) setSheetUpdateUrl(typeof su.valor === 'string' ? su.valor : su.valor.url || '')
    const cat = {}
    ;(ts || []).forEach((t) => { (cat[t.servicio] = cat[t.servicio] || []).push(t.titulo) })
    setTareasCat(cat)
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
    if (!confirm(`¿Eliminar al cliente "${nombreCompleto(cliente)}" y todos sus vehículos, actividades y presupuestos? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    navigate('/clientes')
  }

  async function guardarContacto(e) {
    e.preventDefault()
    const datos = {
      nombre: contacto.nombre.trim(), apellidos: (contacto.apellidos || '').trim(),
      email: contacto.email.trim(),
      telefono: contacto.telefono ? formatTelefono(contacto.telefono) : null,
      ciudad: contacto.ciudad.trim(), tipo: contacto.tipo,
      direccion: contacto.direccion.trim(), comuna: contacto.comuna.trim(),
      rut: contacto.rut ? formatRut(contacto.rut) : null
    }
    const { error } = await supabase.from('clientes').update(datos).eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    // CRM -> planilla: actualiza los datos de contacto en TODAS las filas de
    // la base de OT relacionadas con este cliente (por patente y por N° OT).
    if (sheetUpdateUrl) {
      const patentes = vehiculos.map((v) => patenteLimpia(v.patente)).filter(Boolean)
      const ots = servicios.map((s) => s.ot_numero).filter(Boolean)
      enviarASheet(sheetUpdateUrl, {
        accion: 'actualizar_cliente', patentes, ots,
        propietario: [datos.nombre, datos.apellidos].filter(Boolean).join(' '),
        telefono: datos.telefono || '', email: datos.email || '',
        ciudad: datos.ciudad || '', direccion: datos.direccion || '',
        rut: datos.rut || '', tipo_cliente: tipoClienteLabel(datos.tipo)
      })
    }
    setModalC(false); cargar()
  }

  async function guardarVehiculo(e) {
    e.preventDefault()
    const km = Number(veh.km) || null
    const anterior = veh.id ? vehiculos.find((x) => x.id === veh.id) : null
    const payload = {
      cliente_id: id, empresa_id: cliente.empresa_id,
      patente: veh.patente ? formatPatente(veh.patente) : null, marca: veh.marca || null,
      modelo: veh.modelo || null, anio: Number(veh.anio) || null,
      km_ultimo: km, km_actual_estimado: km,
      proximo_servicio_km: Number(veh.proximo_servicio_km) || null,
      tipo_mantencion: veh.tipo_mantencion || null,
      tipo_vehiculo: veh.tipo_vehiculo || null
    }
    const { error } = veh.id
      ? await supabase.from('vehiculos').update(payload).eq('id', veh.id)
      : await supabase.from('vehiculos').insert(payload)
    if (error) { alert('Error: ' + error.message); return }
    // CRM -> planilla: actualiza marca/modelo/año en las filas de la base
    // de OT que correspondan a esta patente (busca por la patente anterior
    // por si acabas de corregirla).
    if (sheetUpdateUrl && veh.id && (payload.patente || anterior?.patente)) {
      enviarASheet(sheetUpdateUrl, {
        accion: 'actualizar_vehiculo',
        patentes: [patenteLimpia(anterior?.patente || ''), patenteLimpia(payload.patente || '')].filter(Boolean),
        patente_nueva: payload.patente || '',
        marca: payload.marca || '', modelo: payload.modelo || '', anio: payload.anio || ''
      })
    }
    setModalV(false); setVeh(VEH_VACIO); cargar()
  }

  async function borrarVehiculo(vid) {
    if (!confirm('¿Eliminar este vehículo?')) return
    await supabase.from('vehiculos').delete().eq('id', vid); cargar()
  }

  // Deriva a una nueva OT en el módulo interno del CRM, prellenando datos por URL.
  function nuevaOT(vehiculo) {
    const params = {
      nombre: nombreCompleto(cliente) || '', telefono: cliente.telefono || '', email: cliente.email || '',
      ciudad: cliente.ciudad || '', documento: cliente.rut || '',
      direccion: cliente.direccion || '',
      marca: vehiculo?.marca || cliente.marca_principal || '',
      modelo: vehiculo?.modelo || '',
      anio: vehiculo?.anio || '',
      patente: patenteLimpia(vehiculo?.patente) || '',
      km: vehiculo?.km_actual_estimado || vehiculo?.km_ultimo || ''
    }
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString()
    navigate(`/nueva-ot?${qs}`)
  }

  // Deriva el vehículo al taller: crea el trabajo operativo + tareas iniciales.
  async function enviarAlTaller() {
    const v = modalTaller
    if (!ft.servicio.trim()) return alert('Selecciona el servicio solicitado.')
    const titulo = [v?.patente, v?.marca, v?.modelo, nombreCompleto(cliente)].filter(Boolean).join(' ')
    const { data: t, error } = await supabase.from('trabajos_taller').insert({
      empresa_id: perfil.empresa_id, cliente_id: cliente.id, vehiculo_id: v?.id || null,
      titulo, servicio_solicitado: ft.servicio.trim(), observaciones_cliente: ft.obs.trim(),
      asesor_id: perfil.id
    }).select().single()
    if (error) return alert('Error: ' + error.message)
    const tareas = ft.tareas.map((x) => x.trim()).filter(Boolean)
    if (tareas.length) {
      await supabase.from('tareas_taller').insert(tareas.map((titulo, i) => ({
        empresa_id: perfil.empresa_id, trabajo_id: t.id, titulo, orden: i
      })))
    }
    // Gestión comercial abierta pasa a "En taller"
    const abierta = gestiones.find((g) => g.abierta)
    if (abierta) await supabase.from('gestiones').update({ estado: 'en_taller' }).eq('id', abierta.id)
    notificar({ empresa_id: perfil.empresa_id, rol: 'jefe_taller',
      titulo: 'Vehículo enviado a revisión', cuerpo: `${titulo} · ${ft.servicio}`, url: '/taller' })
    setModalTaller(null); setFt({ servicio: '', tareas: [''], obs: '' })
    cargar()
  }

  function abrirEditarVehiculo(v) {
    setVeh({
      id: v.id, patente: v.patente || '', marca: v.marca || '', modelo: v.modelo || '',
      anio: v.anio || '', km: v.km_actual_estimado || v.km_ultimo || '',
      proximo_servicio_km: v.proximo_servicio_km || '', tipo_mantencion: v.tipo_mantencion || '',
      tipo_vehiculo: v.tipo_vehiculo || ''
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
            <h1 className="text-2xl font-bold text-ink">{nombreCompleto(cliente)}</h1>
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
                        nombre: cliente.nombre || '', apellidos: cliente.apellidos || '',
                        email: cliente.email || '', telefono: cliente.telefono || '',
                        ciudad: cliente.ciudad || '',
                        tipo: cliente.tipo === 'PARTICULAR' ? 'PERSONA' : (cliente.tipo || 'PERSONA'),
                        rut: cliente.rut || '',
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
                    <div className="flex items-center gap-2 flex-wrap">
                      {v.ventana && <Pill color={VENTANAS[v.ventana]?.color}>{VENTANAS[v.ventana]?.label}</Pill>}
                      <button onClick={() => nuevaOT(v)}
                              className="text-xs font-medium px-2.5 py-1 rounded-lg border border-didial-red/40 text-didial-red hover:bg-didial-red hover:text-white transition-colors">
                        Nueva OT
                      </button>
                      <button onClick={() => { setModalTaller(v); setFt({ servicio: '', tareas: [''], obs: '' }) }}
                              className="text-xs font-medium px-2.5 py-1 rounded-lg border border-deep/40 text-deep hover:bg-deep hover:text-white transition-colors">
                        Solicitar servicio
                      </button>
                      <button onClick={() => abrirEditarVehiculo(v)} className="text-xs text-deep hover:underline">Editar</button>
                      <button onClick={() => borrarVehiculo(v.id)} className="text-xs text-slate-300 hover:text-red-500">✕</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs text-slate-500">
                    <div><span className="text-slate-400">Tipo:</span> {v.tipo_vehiculo || '—'}</div>
                    <div><span className="text-slate-400">Km actual:</span> {km ? km.toLocaleString('es-CL') : '—'}</div>
                    <div><span className="text-slate-400">Próx. servicio:</span> {v.proximo_servicio_km ? v.proximo_servicio_km.toLocaleString('es-CL') + ' km' : '—'}</div>
                    <div><span className="text-slate-400">Mantención:</span> {MANT[v.tipo_mantencion] || '—'}</div>
                  </div>
                  {(() => {
                    const tt = trabajos.filter((t) => t.vehiculo_id === v.id && t.estado !== 'completada')
                    if (!tt.length) return null
                    const ORDEN = Object.keys(ESTADOS_TALLER)
                    return tt.map((t) => {
                      const idx = ORDEN.indexOf(t.estado)
                      const fechaDe = (e) => {
                        if (e === 'ingreso') return t.creado_en
                        const h = (t.historial || []).filter((x) => x.estado === e).pop()
                        return h?.fecha
                      }
                      return (
                        <div key={t.id} className="mt-3 border-t border-slate-100 pt-2">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-semibold text-slate-400">EN TALLER · {t.servicio_solicitado || 'servicio'}</span>
                            <Pill color={ESTADOS_TALLER[t.estado]?.color}>{ESTADOS_TALLER[t.estado]?.label}</Pill>
                          </div>
                          <div className="flex items-center gap-0 overflow-x-auto pb-1">
                            {ORDEN.filter((e) => !['retroceso'].includes(e)).map((e, i, arr) => {
                              const pos = ORDEN.indexOf(e)
                              const pasado = pos <= idx
                              const f = fechaDe(e)
                              return (
                                <div key={e} className="flex items-center shrink-0" title={ESTADOS_TALLER[e].label + (f ? ' · ' + new Date(f).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '')}>
                                  <span className={`w-3 h-3 rounded-full border-2 ${pasado ? 'border-transparent' : 'border-slate-200 bg-white'}`}
                                        style={pasado ? { background: ESTADOS_TALLER[e].color } : {}} />
                                  {i < arr.length - 1 && <span className={`w-5 h-0.5 ${pos < idx ? 'bg-deep/40' : 'bg-slate-200'}`} />}
                                </div>
                              )
                            })}
                          </div>
                          {t.observaciones_cliente && <div className="text-[11px] text-slate-400 mt-1">💬 {t.observaciones_cliente}</div>}
                        </div>
                      )
                    })
                  })()}
                  {(() => {
                    const hist = servicios.filter((s) =>
                      s.vehiculo_id === v.id ||
                      (s.patente && v.patente && patenteLimpia(s.patente) === patenteLimpia(v.patente)))
                    if (!hist.length) return null
                    return (
                      <div className="mt-3 border-t border-slate-100 pt-2">
                        <div className="text-[11px] font-semibold text-slate-400 mb-1">Historial de servicios ({hist.length})</div>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {hist.map((s) => {
                            const partes = [
                              s.tipo_servicio ? tipoServicioLabel(s.tipo_servicio) : null,
                              s.tipo_servicio_2 ? tipoServicioLabel(s.tipo_servicio_2) : null
                            ].filter(Boolean).join(' + ')
                            const doc = s.nro_documento
                              ? `${s.tipo_documento && s.tipo_documento !== 'Sin Documento' ? s.tipo_documento : 'Doc'} N° ${s.nro_documento}`
                              : null
                            return (
                              <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-slate-400 w-20 shrink-0">{s.fecha ? fmtFecha(s.fecha) : '—'}</span>
                                  <span className="text-ink truncate">
                                    {s.ot_numero ? <b className="text-deep">OT {s.ot_numero}</b> : ''}
                                    {partes ? ` · ${partes}` : (s.ot_numero ? '' : '—')}
                                    {s.descripcion ? ` · ${s.descripcion}` : ''}
                                    {doc ? <span className="text-slate-400"> · {doc}</span> : null}
                                  </span>
                                </div>
                                <span className="text-slate-500 shrink-0">{s.monto ? fmtCLP(s.monto) : ''}</span>
                              </div>
                            )
                          })}
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


      {/* Presupuestos del taller: el asesor los conversa con el cliente */}
      {presupsTaller.some((p) => p.estado === 'enviado') && (
        <div className="card p-5 border-l-4 border-didial-amber">
          <h3 className="font-semibold text-ink mb-1">Presupuestos del taller para conversar</h3>
          <p className="text-xs text-slate-400 mb-3">Ajusta los precios para negociar: los repuestos muestran su rango económico–premium de la base de precios y el resto una referencia de ±{margenes.ajuste_asesor_pct}%. Si sales del rango queda marcado en ámbar (no se bloquea). Genera el PDF listo para imprimir o envíalo por WhatsApp.</p>
          <div className="space-y-3">
            {presupsTaller.filter((p) => p.estado === 'enviado').map((p) => (
              <PresupAsesor key={p.id} p={p} cliente={cliente} margenes={margenes} perfil={perfil}
                            trabajos={trabajos} vehiculos={vehiculos} onChange={cargar} />
            ))}
          </div>
        </div>
      )}

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
                <label className="label">Nombre(s) *</label>
                <input className="input" required value={contacto.nombre}
                       onChange={(e) => setContacto({ ...contacto, nombre: e.target.value })} />
              </div>
              <div>
                <label className="label">Apellido(s) *</label>
                <input className="input" required value={contacto.apellidos}
                       onChange={(e) => setContacto({ ...contacto, apellidos: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">RUT *</label>
                <input className="input" required value={contacto.rut}
                       onChange={(e) => setContacto({ ...contacto, rut: e.target.value })}
                       onBlur={(e) => setContacto({ ...contacto, rut: formatRut(e.target.value) })}
                       placeholder="12.345.678-9" />
              </div>
              <div>
                <label className="label">Tipo *</label>
                <select className="input" required value={contacto.tipo}
                        onChange={(e) => setContacto({ ...contacto, tipo: e.target.value })}>
                  <option value="">Seleccionar…</option>
                  {Object.entries(TIPOS_CLIENTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Teléfono *</label>
                <input className="input" required value={contacto.telefono}
                       onChange={(e) => setContacto({ ...contacto, telefono: e.target.value })} />
              </div>
              <div>
                <label className="label">Correo *</label>
                <input className="input" type="email" required value={contacto.email}
                       onChange={(e) => setContacto({ ...contacto, email: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Dirección *</label>
              <input className="input" required value={contacto.direccion} placeholder="Calle y número"
                     onChange={(e) => setContacto({ ...contacto, direccion: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Comuna *</label>
                <input className="input" required value={contacto.comuna}
                       onChange={(e) => setContacto({ ...contacto, comuna: e.target.value })} />
              </div>
              <div>
                <label className="label">Ciudad *</label>
                <input className="input" required value={contacto.ciudad}
                       onChange={(e) => setContacto({ ...contacto, ciudad: e.target.value })} />
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              La marca ya no es dato de contacto: es segmentación interna y se toma de los vehículos del cliente.
              Al guardar, los cambios se replican en las filas de la base de OT relacionadas.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-soft" onClick={() => setModalC(false)}>Cancelar</button>
              <button className="btn-primary">Guardar cambios</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal solicitar servicio (deriva al taller) */}
      <Modal abierto={!!modalTaller} onClose={() => setModalTaller(null)}
             titulo={`Solicitar servicio · ${modalTaller?.patente || ''} ${modalTaller?.marca || ''} ${modalTaller?.modelo || ''}`}>
        <div className="space-y-4">
          <div>
            <label className="label">Servicio solicitado <span className="text-red-500">*</span></label>
            <select className="input" value={ft.servicio} autoFocus
                    onChange={(e) => {
                      const svc = e.target.value
                      // Autocompleta las tareas predefinidas del servicio (el
                      // asesor puede eliminarlas o agregar otras).
                      const pred = tareasCat[svc]
                      setFt({ ...ft, servicio: svc, tareas: pred?.length ? [...pred, ''] : [''] })
                    }}>
              <option value="">Seleccionar servicio…</option>
              {OT_SVC_GRUPOS.map((g) => (
                <optgroup key={g.bu} label={g.bu}>
                  {g.items.map((s) => <option key={s} value={s}>{s}</option>)}
                </optgroup>
              ))}
            </select>
            {!!tareasCat[ft.servicio]?.length && (
              <p className="text-[11px] text-slate-400 mt-1">
                Este servicio trae {tareasCat[ft.servicio].length} tareas predefinidas. Revísalas: puedes eliminar o agregar.
              </p>
            )}
          </div>
          <div>
            <label className="label">Tareas que implica</label>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {ft.tareas.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded border-2 border-slate-300 shrink-0" />
                  <input className="input flex-1" value={t} placeholder="Ej: Diagnóstico con escáner…"
                         onChange={(e) => setFt({ ...ft, tareas: ft.tareas.map((x, j) => j === i ? e.target.value : x) })}
                         onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setFt({ ...ft, tareas: [...ft.tareas, ''] }) } }} />
                  {ft.tareas.length > 1 && (
                    <button type="button" onClick={() => setFt({ ...ft, tareas: ft.tareas.filter((_, j) => j !== i) })}
                            className="text-slate-300 hover:text-red-500">✕</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setFt({ ...ft, tareas: [...ft.tareas, ''] })}
                      className="text-xs text-deep font-medium hover:underline">+ Agregar tarea</button>
            </div>
          </div>
          <div>
            <label className="label">Observaciones del cliente</label>
            <textarea className="input" rows={2} value={ft.obs} onChange={(e) => setFt({ ...ft, obs: e.target.value })}
                      placeholder="Lo que el cliente describe: ruidos, síntomas, desde cuándo…" />
          </div>
          <p className="text-[11px] text-slate-400">Se notificará al Jefe de Taller para asignar el técnico. La gestión comercial abierta pasará a estado "En taller".</p>
          <div className="flex justify-end gap-2">
            <button className="btn-soft" onClick={() => setModalTaller(null)}>Cancelar</button>
            <button className="btn-primary" onClick={enviarAlTaller}>Solicitar servicio</button>
          </div>
        </div>
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
            <div>
              <label className="label">Tipo de vehículo</label>
              <select className="input" value={veh.tipo_vehiculo}
                      onChange={(e) => setVeh({ ...veh, tipo_vehiculo: e.target.value })}>
                <option value="">—</option>
                {TIPOS_VEHICULO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <p className="text-[10px] text-slate-400 mt-0.5">Define los precios de MO en la base de precios.</p>
            </div>
            <div>
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


/* ---- Presupuesto del taller en manos del asesor -------------------- */
// v21: ítems agrupados en las 4 secciones oficiales (Repuestos, Lubricantes
// y Otros Insumos, Mano de Obra, Servicios Externos), precios editables por
// el asesor con referencia de rango (eco/premium para repuestos, ±% para el
// resto) y PDF imprimible con el formato oficial DIDIAL (NETO/IVA/TOTAL).
function PresupAsesor({ p, cliente, margenes, perfil, trabajos = [], vehiculos = [], onChange }) {
  const a = (margenes?.ajuste_asesor_pct ?? 10) / 100
  const [precios, setPrecios] = useState(() =>
    Object.fromEntries((p.items || []).map((x, i) => [i, x.precio_final ?? x.precio ?? 0])))
  const t = trabajos.find((x) => x.id === p.trabajo_id)
  const v = vehiculos.find((x) => x.id === t?.vehiculo_id)
  const cobrables = (p.items || []).map((x, i) => ({ ...x, i })).filter((x) => !x.en_stock)
  const total = cobrables.reduce((s, x) => s + (+precios[x.i] || 0) * (+x.cant || 1), 0)
  const porSeccion = Object.keys(SECCIONES_PRESUP).map((k) => ({
    k, titulo: SECCIONES_PRESUP[k],
    items: cobrables.filter((x) => seccionDe(x.tipo) === k)
  })).filter((s) => s.items.length)

  // Rango de referencia por ítem: eco/premium (repuestos de la base de
  // precios) o ±ajuste% sobre el precio del coordinador. NO bloquea: el
  // asesor puede negociar fuera del rango, pero queda marcado en ámbar.
  const rangoDe = (x) => {
    if (x.ref_eco || x.ref_premium) return { min: +x.ref_eco || 0, max: +x.ref_premium || Infinity, tipo: 'eco/premium' }
    const base = +(x.precio || 0)
    if (!base) return null
    return { min: Math.round(base * (1 - a)), max: Math.round(base * (1 + a)), tipo: `±${margenes?.ajuste_asesor_pct ?? 10}%` }
  }
  const fueraDeRango = (x) => {
    const r = rangoDe(x); if (!r) return false
    const px = +precios[x.i] || 0
    return px < r.min || px > r.max
  }

  async function guardarAjuste() {
    const items = (p.items || []).map((x, i) => ({ ...x, precio_final: Math.max(0, Math.round(+precios[i] || 0)) }))
    await supabase.from('presupuestos_taller').update({
      items, monto: items.filter((x) => !x.en_stock).reduce((s, x) => s + (+x.precio_final || 0) * (+x.cant || 1), 0)
    }).eq('id', p.id)
    onChange?.()
  }

  function verPDF() {
    const num = (p.numero || String(p.id || '').replace(/-/g, '').slice(-6).toUpperCase())
    const d = desgloseIVA(total)
    const fmt = (n) => (Number(n) || 0).toLocaleString('es-CL')
    const esc = (x) => String(x ?? '').replace(/</g, '&lt;')
    const filaConCant = (x) => `
      <tr><td class="cod">${esc(x.codigo)}</td><td>${esc(x.detalle || x.tipo)}</td>
      <td class="c">${x.cant}</td><td class="r">${fmt(precios[x.i])}</td>
      <td class="r">${fmt((+precios[x.i] || 0) * (+x.cant || 1))}</td></tr>`
    const filaSolo = (x) => `
      <tr><td colspan="4">${esc(x.detalle || x.tipo)}</td>
      <td class="r">${fmt((+precios[x.i] || 0) * (+x.cant || 1))}</td></tr>`
    const secciones = porSeccion.map((sec) => {
      const sub = sec.items.reduce((s, x) => s + (+precios[x.i] || 0) * (+x.cant || 1), 0)
      const conCant = ['repuesto', 'insumo'].includes(sec.k)
      return `
      <div class="sec">
        <div class="sec-t">${sec.titulo}:</div>
        <table>
          ${conCant ? '<thead><tr><th class="cod">CÓDIGO</th><th>DETALLE</th><th class="c">CANTIDAD</th><th class="r">PRECIO</th><th class="r">TOTAL</th></tr></thead>' : ''}
          <tbody>${sec.items.map(conCant ? filaConCant : filaSolo).join('')}</tbody>
        </table>
        <div class="sub">Subtotal ${sec.titulo}: <b>${fmt(sub)}</b></div>
      </div>`
    }).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Presupuesto ${num}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#111922;margin:34px;font-size:13px}
        .top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
        .emp{font-size:11px;line-height:1.45}
        .emp b{font-size:12px}
        .logo{font-size:30px;font-weight:900;letter-spacing:2px;color:#e0382b;text-align:center}
        .logo small{display:block;font-size:10px;letter-spacing:5px;color:#111922;font-weight:600}
        .ppto{font-size:14px;font-weight:bold;text-align:right}
        .datos{margin-top:18px;border-bottom:1.5px solid #111922;padding-bottom:8px;
               display:grid;grid-template-columns:1fr 1fr 1fr;gap:2px 14px;font-size:12px}
        .sol{margin:12px 0 4px}
        .sol b{display:block;margin-bottom:2px}
        .sec{margin-top:14px;border-top:1px solid #9aa6b2;padding-top:8px}
        .sec-t{font-weight:bold;margin-bottom:4px}
        table{width:100%;border-collapse:collapse}
        th{font-size:10px;text-align:left;padding:3px 6px;color:#111922;border-bottom:1px solid #d8dee5}
        td{padding:3px 6px;font-size:12px}
        .c{text-align:center}.r{text-align:right}.cod{width:80px}
        th.r,th.c{text-align:inherit}
        .sub{text-align:right;font-size:12px;margin-top:4px}
        .tot{margin-top:18px;border-top:1.5px solid #111922;padding-top:10px;text-align:right;font-size:14px}
        .tot div{margin:2px 0}
        .pie{margin-top:30px;color:#6b7a8a;font-size:10px}
        @media print{body{margin:14mm}}
      </style></head><body>
      <div class="top">
        <div class="emp">
          <b>SERVICIO AUTOMOTRIZ DIDIAL LTDA</b><br>
          AVDA. CUATRO ESQUINAS 759, LA SERENA<br>
          serviciotecnico@didial.cl<br>+569 89748626
        </div>
        <div class="logo">DIDIAL<small>Servicio Automotriz</small></div>
        <div class="ppto">PRESUPUESTO N° ${num}<br>FECHA: ${new Date().toLocaleDateString('es-CL')}</div>
      </div>
      <div class="datos">
        <div><b>Patente:</b> ${esc(v?.patente ? formatPatente(v.patente) : '')}</div>
        <div></div>
        <div style="text-align:right"><b>R.U.T.:</b> ${esc(cliente?.rut || '')}</div>
        <div><b>Nombre Cliente:</b> ${esc(nombreCompleto(cliente))}</div>
        <div><b>Modelo:</b> ${esc(v?.modelo || '')}</div>
        <div style="text-align:right"><b>Año:</b> ${esc(v?.anio || '')}</div>
        <div><b>Marca:</b> ${esc(v?.marca || '')}</div>
        <div><b>Atendido por:</b> ${esc(perfil?.nombre || '')}</div>
        <div></div>
      </div>
      <div class="sol"><b>Cliente Solicita:</b>${esc(t?.servicio_solicitado || '')}</div>
      ${secciones}
      <div class="tot">
        <div>NETO: <b>${fmt(d.neto)}</b></div>
        <div>I.V.A.: <b>${fmt(d.iva)}</b></div>
        <div style="font-size:16px">TOTAL: <b>${fmt(d.total)}</b></div>
      </div>
      <div class="pie">Presupuesto válido por 15 días. Valores en pesos chilenos, IVA incluido. No incluye trabajos adicionales no detectados en el diagnóstico.</div>
      <script>window.print()</script></body></html>`
    const w = window.open('', '_blank')
    w.document.write(html); w.document.close()
  }

  function enviarWhatsApp() {
    const fono = String(cliente?.telefono || '').replace(/[^0-9]/g, '')
    const num = fono.startsWith('56') ? fono : fono.length === 9 ? '56' + fono : fono.length === 8 ? '569' + fono : fono
    const lineas = porSeccion.map((sec) => {
      const sub = sec.items.reduce((s, x) => s + (+precios[x.i] || 0) * (+x.cant || 1), 0)
      return `*${sec.titulo}*%0A` + sec.items.map((x) => `• ${x.detalle || x.tipo}${+x.cant > 1 ? ' x' + x.cant : ''}: $${(((+precios[x.i]) || 0) * (+x.cant || 1)).toLocaleString('es-CL')}`).join('%0A') + `%0ASubtotal: $${sub.toLocaleString('es-CL')}`
    }).join('%0A%0A')
    const msg = `Hola ${cliente?.nombre?.split(' ')[0] || ''}, te saluda ${perfil?.nombre?.split(' ')[0] || ''} de DIDIAL 👋%0A%0ATe comparto el presupuesto de tu ${v ? v.marca + ' ' + (v.modelo || '') : 'vehículo'}:%0A%0A${lineas}%0A%0A*TOTAL: $${total.toLocaleString('es-CL')}* (IVA incluido)%0A%0AAdjunto el PDF con el detalle. ¿Lo conversamos?`
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank', 'noopener')
  }

  return (
    <div className="rounded-lg border border-slate-100 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-ink">Presupuesto {new Date(p.creado_en).toLocaleDateString('es-CL')}</span>
        {v && <span className="text-xs text-slate-400">{formatPatente(v.patente || '')} {v.marca}</span>}
        <span className="text-xs text-slate-400">{cobrables.length} ítems</span>
        <span className="ml-auto font-bold text-ink">{'$' + total.toLocaleString('es-CL')}</span>
      </div>
      {porSeccion.map((sec) => (
        <div key={sec.k}>
          <div className="text-[11px] font-semibold text-slate-400 uppercase mt-1">{sec.titulo}</div>
          <div className="space-y-1">
            {sec.items.map((x) => {
              const r = rangoDe(x)
              const fuera = fueraDeRango(x)
              return (
                <div key={x.i} className="flex items-center gap-2 text-sm">
                  {x.codigo && <span className="font-mono text-xs text-slate-400 w-16 shrink-0">{x.codigo}</span>}
                  <span className="flex-1 text-ink truncate">{x.detalle || x.tipo}</span>
                  <span className="text-xs text-slate-400">x{x.cant}</span>
                  <input className={`input text-xs w-28 text-right ${fuera ? 'border-didial-amber bg-amber-50' : ''}`}
                         type="number" min="0" value={precios[x.i]}
                         title={r ? `Rango de referencia (${r.tipo}): $${r.min.toLocaleString('es-CL')} – ${isFinite(r.max) ? '$' + r.max.toLocaleString('es-CL') : 'sin tope'}` : 'Sin referencia de rango'}
                         onChange={(e) => setPrecios({ ...precios, [x.i]: e.target.value })} />
                  {fuera && <span className="text-[10px] text-didial-amber shrink-0" title="Fuera del rango de referencia">⚠ rango</span>}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <div className="flex justify-end gap-2 flex-wrap pt-1">
        <button className="btn-soft text-xs" onClick={guardarAjuste}>Guardar ajuste</button>
        <button className="btn-soft text-xs" onClick={verPDF}>📄 PDF para imprimir</button>
        <button className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: '#1f9d57' }} onClick={enviarWhatsApp}>Enviar por WhatsApp</button>
      </div>
    </div>
  )
}
