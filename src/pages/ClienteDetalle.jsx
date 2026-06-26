import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Pill, Modal, StatCard } from '../components/UI'
import {
  segLabel, segColor, fmtCLP, fmtFecha, tipoClienteLabel, TIPOS_CLIENTE,
  TIPOS_ACTIVIDAD, RESULTADOS, VENTANAS, ESTADOS_PRESUPUESTO, ETAPAS_OPCIONALES, buildOtUrl, formatRut
} from '../lib/helpers'

const OT_URL = import.meta.env.VITE_REGISTRO_OT_URL || ''

const ACT_VACIA = {
  tipo: 'llamada', resultado: 'pendiente',
  fecha: new Date().toISOString().slice(0, 10),
  hora: '', descripcion: '', proxima_accion: '', proxima_fecha: ''
}
const PRESUP_VACIO = {
  numero: '', descripcion: '', monto: '', estado: 'borrador',
  fecha_emision: new Date().toISOString().slice(0, 10),
  fecha_validez: '', proxima_gestion: '', notas: ''
}
const VEH_VACIO = {
  id: null, patente: '', marca: '', modelo: '', anio: '',
  km: '', proximo_servicio_km: '', tipo_mantencion: ''
}
const MANT = { basica: 'Básica', intermedia: 'Intermedia', mayor: 'Mayor' }

export default function ClienteDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { esAdmin } = useAuth()
  const [cliente, setCliente] = useState(null)
  const [vehiculos, setVehiculos] = useState([])
  const [estados, setEstados] = useState([])
  const [actividades, setActividades] = useState([])
  const [presupuestos, setPresupuestos] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [tab, setTab] = useState('actividades')
  const [modal, setModal] = useState(false)
  const [modalP, setModalP] = useState(false)
  const [modalC, setModalC] = useState(false)
  const [modalV, setModalV] = useState(false)
  const [act, setAct] = useState(ACT_VACIA)
  const [presup, setPresup] = useState(PRESUP_VACIO)
  const [contacto, setContacto] = useState(null)
  const [veh, setVeh] = useState(VEH_VACIO)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    const { data: c } = await supabase.from('clientes')
      .select('*, usuarios(nombre)').eq('id', id).single()
    setCliente(c)
    const [vh, est, actv, pre] = await Promise.all([
      supabase.from('vehiculos').select('*').eq('cliente_id', id).order('creado_en'),
      supabase.from('pipeline_estados').select('*').order('orden'),
      supabase.from('actividades').select('*').eq('cliente_id', id).order('fecha', { ascending: false }),
      supabase.from('presupuestos').select('*').eq('cliente_id', id).order('fecha_emision', { ascending: false })
    ])
    setVehiculos(vh.data || []); setEstados(est.data || [])
    setActividades(actv.data || []); setPresupuestos(pre.data || [])
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
  async function guardarActividad(e) {
    e.preventDefault()
    const { error } = await supabase.from('actividades').insert({
      ...act, cliente_id: id, empresa_id: cliente.empresa_id,
      vendedor_id: cliente.vendedor_id, hora: act.hora || null,
      proxima_fecha: act.proxima_fecha || null
    })
    if (error) { alert('Error: ' + error.message); return }
    setModal(false); setAct(ACT_VACIA); cargar()
  }

  async function guardarPresupuesto(e) {
    e.preventDefault()
    const { error } = await supabase.from('presupuestos').insert({
      ...presup, cliente_id: id, empresa_id: cliente.empresa_id,
      vendedor_id: cliente.vendedor_id, monto: Number(presup.monto) || 0,
      fecha_validez: presup.fecha_validez || null,
      proxima_gestion: presup.proxima_gestion || null
    })
    if (error) { alert('Error: ' + error.message); return }
    setModalP(false); setPresup(PRESUP_VACIO); cargar()
  }

  async function cambiarEstadoPresup(pid, estado) {
    await supabase.from('presupuestos').update({ estado }).eq('id', pid); cargar()
  }

  async function guardarContacto(e) {
    e.preventDefault()
    const { error } = await supabase.from('clientes').update({
      nombre: contacto.nombre, email: contacto.email, telefono: contacto.telefono,
      ciudad: contacto.ciudad, tipo: contacto.tipo, marca_principal: contacto.marca_principal,
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
      patente: veh.patente || null, marca: veh.marca || null,
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
      patente: vehiculo?.patente || '',
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
                        marca_principal: cliente.marca_principal || '', rut: cliente.rut || ''
                      }); setModalC(true) }}>
                Editar
              </button>
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
          <div><div className="text-xs text-slate-400">Teléfono</div>{cliente.telefono || '—'}</div>
          <div><div className="text-xs text-slate-400">Correo</div>{cliente.email || '—'}</div>
          <div><div className="text-xs text-slate-400">Ciudad</div>{cliente.ciudad || '—'}</div>
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
                      <div className="text-xs text-slate-400 mt-0.5">Patente {v.patente || '—'}</div>
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
                </div>
              )
            })}
          </div>
        ) : <p className="text-sm text-slate-400">Sin vehículos registrados.</p>}
        <p className="text-[11px] text-slate-400 mt-3">
          El historial de OT por patente se alimenta desde la base de OT (sincronización). Aquí ves la mantención vigente de cada vehículo.
        </p>
      </div>

      {/* Panel unificado de actividades */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h3 className="font-semibold text-ink">Panel de actividades</h3>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-xs">
              <button onClick={() => setTab('actividades')}
                      className={`px-3 py-1.5 ${tab === 'actividades' ? 'bg-deep text-white' : 'text-slate-500'}`}>
                Seguimiento ({actividades.length})
              </button>
              <button onClick={() => setTab('presupuestos')}
                      className={`px-3 py-1.5 ${tab === 'presupuestos' ? 'bg-deep text-white' : 'text-slate-500'}`}>
                Presupuestos ({presupuestos.length})
              </button>
            </div>
            {tab === 'actividades'
              ? <button className="btn-primary text-xs py-1.5" onClick={() => setModal(true)}>+ Registrar</button>
              : <button className="btn-primary text-xs py-1.5" onClick={() => setModalP(true)}>+ Presupuesto</button>}
          </div>
        </div>

        {tab === 'actividades' ? (
          actividades.length ? (
            <div className="space-y-3">
              {actividades.map((a) => (
                <div key={a.id} className="border-l-2 border-sky pl-3 py-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink">{TIPOS_ACTIVIDAD[a.tipo]}</span>
                    <span className="text-xs text-slate-400">{fmtFecha(a.fecha)}{a.hora ? ` · ${a.hora.slice(0,5)}` : ''}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{RESULTADOS[a.resultado]}</div>
                  {a.descripcion && <p className="text-sm text-slate-600 mt-1">{a.descripcion}</p>}
                  {a.proxima_accion && (
                    <p className="text-xs text-deep mt-1">→ {a.proxima_accion}{a.proxima_fecha ? ` · ${fmtFecha(a.proxima_fecha)}` : ''}</p>
                  )}
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400">Sin actividades. Registra la primera llamada o contacto.</p>
        ) : (
          presupuestos.length ? (
            <div className="space-y-2">
              {presupuestos.map((p) => (
                <div key={p.id} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">{p.numero ? `N° ${p.numero}` : 'Presupuesto'}</span>
                      <span className="text-sm text-slate-500">· {fmtCLP(p.monto)}</span>
                    </div>
                    <select className="text-xs rounded-md border border-slate-200 px-2 py-1"
                            value={p.estado} onChange={(e) => cambiarEstadoPresup(p.id, e.target.value)}
                            style={{ color: ESTADOS_PRESUPUESTO[p.estado]?.color }}>
                      {Object.entries(ESTADOS_PRESUPUESTO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  {p.descripcion && <p className="text-sm text-slate-600 mt-1">{p.descripcion}</p>}
                  <div className="flex gap-4 text-xs text-slate-400 mt-2">
                    <span>Emitido {fmtFecha(p.fecha_emision)}</span>
                    {p.proxima_gestion && <span className="text-deep">Gestionar: {fmtFecha(p.proxima_gestion)}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400">Sin presupuestos. Crea uno para darle seguimiento.</p>
        )}
      </div>

      {/* Modal actividad */}
      <Modal abierto={modal} onClose={() => setModal(false)} titulo="Registrar seguimiento">
        <form onSubmit={guardarActividad} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo de contacto</label>
              <select className="input" value={act.tipo} onChange={(e) => setAct({ ...act, tipo: e.target.value })}>
                {Object.entries(TIPOS_ACTIVIDAD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fecha</label>
              <input className="input" type="date" value={act.fecha} onChange={(e) => setAct({ ...act, fecha: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Resultado / estado del cliente *</label>
            <select className="input" value={act.resultado} required
                    onChange={(e) => setAct({ ...act, resultado: e.target.value })}>
              {Object.entries(RESULTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Observaciones</label>
            <textarea className="input" rows="3" value={act.descripcion}
                      onChange={(e) => setAct({ ...act, descripcion: e.target.value })}
                      placeholder="¿Qué dijo el cliente? Detalles relevantes de la conversación." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Próxima acción</label>
              <input className="input" value={act.proxima_accion}
                     onChange={(e) => setAct({ ...act, proxima_accion: e.target.value })}
                     placeholder="Ej: confirmar hora" />
            </div>
            <div>
              <label className="label">¿Cuándo? (va a tu Calendario)</label>
              <input className="input" type="date" value={act.proxima_fecha}
                     onChange={(e) => setAct({ ...act, proxima_fecha: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-soft" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary">Guardar</button>
          </div>
        </form>
      </Modal>

      {/* Modal presupuesto */}
      <Modal abierto={modalP} onClose={() => setModalP(false)} titulo="Nuevo presupuesto">
        <form onSubmit={guardarPresupuesto} className="space-y-4">
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
              <label className="label">Próxima gestión</label>
              <input className="input" type="date" value={presup.proxima_gestion} onChange={(e) => setPresup({ ...presup, proxima_gestion: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-soft" onClick={() => setModalP(false)}>Cancelar</button>
            <button className="btn-primary">Guardar presupuesto</button>
          </div>
        </form>
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
              <input className="input" value={veh.marca} placeholder="Ej: TOYOTA"
                     onChange={(e) => setVeh({ ...veh, marca: e.target.value.toUpperCase() })} />
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
                     onChange={(e) => setVeh({ ...veh, patente: e.target.value.toUpperCase() })} />
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
