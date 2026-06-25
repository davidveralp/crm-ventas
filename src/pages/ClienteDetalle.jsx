import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Pill, Modal, StatCard } from '../components/UI'
import {
  segLabel, segColor, fmtCLP, fmtFecha,
  TIPOS_ACTIVIDAD, RESULTADOS, VENTANAS, ESTADOS_PRESUPUESTO
} from '../lib/helpers'

const ACT_VACIA = {
  tipo: 'llamada', resultado: 'pendiente',
  fecha: new Date().toISOString().slice(0, 10),
  hora: '', descripcion: '', proxima_accion: ''
}
const PRESUP_VACIO = {
  numero: '', descripcion: '', monto: '', estado: 'borrador',
  fecha_emision: new Date().toISOString().slice(0, 10),
  fecha_validez: '', proxima_gestion: '', notas: ''
}

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
  const [modal, setModal] = useState(false)
  const [modalP, setModalP] = useState(false)
  const [act, setAct] = useState(ACT_VACIA)
  const [presup, setPresup] = useState(PRESUP_VACIO)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    const { data: c } = await supabase.from('clientes')
      .select('*, usuarios(nombre)').eq('id', id).single()
    setCliente(c)
    const [veh, est, actv, pre] = await Promise.all([
      supabase.from('vehiculos').select('*').eq('cliente_id', id),
      supabase.from('pipeline_estados').select('*').order('orden'),
      supabase.from('actividades').select('*').eq('cliente_id', id).order('fecha', { ascending: false }),
      supabase.from('presupuestos').select('*').eq('cliente_id', id).order('fecha_emision', { ascending: false })
    ])
    setVehiculos(veh.data || []); setEstados(est.data || [])
    setActividades(actv.data || []); setPresupuestos(pre.data || [])
    if (esAdmin) {
      const { data: v } = await supabase.from('usuarios')
        .select('id,nombre').eq('rol', 'vendedor').eq('activo', true)
      setVendedores(v || [])
    }
  }

  async function cambiarEstado(estado_id) {
    await supabase.from('clientes').update({ estado_id }).eq('id', id); cargar()
  }
  async function cambiarVendedor(vendedor_id) {
    await supabase.from('clientes').update({ vendedor_id: vendedor_id || null }).eq('id', id); cargar()
  }

  async function guardarActividad(e) {
    e.preventDefault()
    const { error } = await supabase.from('actividades').insert({
      ...act, cliente_id: id, empresa_id: cliente.empresa_id,
      vendedor_id: cliente.vendedor_id, hora: act.hora || null
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

  if (!cliente) return <div className="text-slate-400 text-sm">Cargando…</div>

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
              <span className="text-xs text-slate-400">{cliente.tipo}</span>
              {cliente.marca_principal && (
                <span className="pill bg-ink text-white">{cliente.marca_principal}</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Facturación histórica</div>
            <div className="text-xl font-bold text-ink">{fmtCLP(cliente.facturacion_total)}</div>
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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 text-sm border-t border-slate-100 pt-4">
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

      {/* Estado del pipeline */}
      <div className="card p-5">
        <h3 className="font-semibold text-ink mb-3">Estado en el pipeline</h3>
        <div className="flex flex-wrap gap-2">
          {estados.map((e) => (
            <button key={e.id} onClick={() => cambiarEstado(e.id)}
              className="pill border transition"
              style={cliente.estado_id === e.id
                ? { background: e.color, borderColor: e.color, color: '#fff' }
                : { borderColor: '#e2e8f0', color: '#475569' }}>
              {e.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Vehículos */}
      <div className="card p-5">
        <h3 className="font-semibold text-ink mb-3">Vehículos ({vehiculos.length})</h3>
        {vehiculos.length ? (
          <div className="space-y-2">
            {vehiculos.map((v) => (
              <div key={v.id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2 last:border-0">
                <div>
                  <span className="font-medium text-ink">{v.marca} {v.modelo}</span>
                  {v.anio ? <span className="text-slate-400"> · {v.anio}</span> : null}
                  <span className="text-slate-400"> · {v.patente}</span>
                </div>
                <div className="flex items-center gap-3">
                  {v.km_actual_estimado ? (
                    <span className="text-slate-500">{v.km_actual_estimado.toLocaleString('es-CL')} km</span>
                  ) : null}
                  {v.ventana && <Pill color={VENTANAS[v.ventana]?.color}>{VENTANAS[v.ventana]?.label}</Pill>}
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-slate-400">Sin vehículos registrados.</p>}
      </div>

      {/* Presupuestos */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-ink">Presupuestos ({presupuestos.length})</h3>
          <button className="btn-primary text-xs py-1.5" onClick={() => setModalP(true)}>+ Nuevo presupuesto</button>
        </div>
        {presupuestos.length ? (
          <div className="space-y-2">
            {presupuestos.map((p) => (
              <div key={p.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">
                      {p.numero ? `N° ${p.numero}` : 'Presupuesto'}
                    </span>
                    <span className="text-sm text-slate-500">· {fmtCLP(p.monto)}</span>
                  </div>
                  <select className="text-xs rounded-md border border-slate-200 px-2 py-1"
                          value={p.estado}
                          onChange={(e) => cambiarEstadoPresup(p.id, e.target.value)}
                          style={{ color: ESTADOS_PRESUPUESTO[p.estado]?.color }}>
                    {Object.entries(ESTADOS_PRESUPUESTO).map(([k, v]) =>
                      <option key={k} value={k}>{v.label}</option>)}
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
        ) : <p className="text-sm text-slate-400">Sin presupuestos. Crea uno para darle seguimiento.</p>}
      </div>

      {/* Seguimiento */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-ink">Seguimiento ({actividades.length})</h3>
          <button className="btn-primary text-xs py-1.5" onClick={() => setModal(true)}>+ Registrar</button>
        </div>
        {actividades.length ? (
          <div className="space-y-3">
            {actividades.map((a) => (
              <div key={a.id} className="border-l-2 border-sky pl-3 py-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{TIPOS_ACTIVIDAD[a.tipo]}</span>
                  <span className="text-xs text-slate-400">{fmtFecha(a.fecha)}{a.hora ? ` · ${a.hora.slice(0,5)}` : ''}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{RESULTADOS[a.resultado]}</div>
                {a.descripcion && <p className="text-sm text-slate-600 mt-1">{a.descripcion}</p>}
                {a.proxima_accion && <p className="text-xs text-deep mt-1">→ {a.proxima_accion}</p>}
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-slate-400">Sin actividades. Registra la primera llamada o propuesta.</p>}
      </div>

      {/* Modal actividad */}
      <Modal abierto={modal} onClose={() => setModal(false)} titulo="Registrar seguimiento">
        <form onSubmit={guardarActividad} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={act.tipo} onChange={(e) => setAct({ ...act, tipo: e.target.value })}>
                {Object.entries(TIPOS_ACTIVIDAD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Resultado</label>
              <select className="input" value={act.resultado} onChange={(e) => setAct({ ...act, resultado: e.target.value })}>
                {Object.entries(RESULTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha</label>
              <input className="input" type="date" value={act.fecha} onChange={(e) => setAct({ ...act, fecha: e.target.value })} />
            </div>
            <div>
              <label className="label">Hora</label>
              <input className="input" type="time" value={act.hora} onChange={(e) => setAct({ ...act, hora: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input" rows="2" value={act.descripcion} onChange={(e) => setAct({ ...act, descripcion: e.target.value })} />
          </div>
          <div>
            <label className="label">Próxima acción</label>
            <input className="input" value={act.proxima_accion} onChange={(e) => setAct({ ...act, proxima_accion: e.target.value })}
                   placeholder="Ej: llamar el lunes para confirmar hora" />
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
              <input className="input" value={presup.numero} onChange={(e) => setPresup({ ...presup, numero: e.target.value })}
                     placeholder="Opcional" />
            </div>
            <div>
              <label className="label">Monto (CLP)</label>
              <input className="input" type="number" value={presup.monto} onChange={(e) => setPresup({ ...presup, monto: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Descripción del trabajo</label>
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
    </div>
  )
}
