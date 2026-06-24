import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Pill, Modal } from '../components/UI'
import {
  segLabel, segColor, fmtCLP, fmtFecha,
  TIPOS_ACTIVIDAD, RESULTADOS, VENTANAS
} from '../lib/helpers'

const ACT_VACIA = {
  tipo: 'llamada', resultado: 'pendiente',
  fecha: new Date().toISOString().slice(0, 10),
  hora: '', descripcion: '', proxima_accion: ''
}

export default function ClienteDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [cliente, setCliente] = useState(null)
  const [vehiculos, setVehiculos] = useState([])
  const [estados, setEstados] = useState([])
  const [actividades, setActividades] = useState([])
  const [modal, setModal] = useState(false)
  const [act, setAct] = useState(ACT_VACIA)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    const { data: c } = await supabase.from('clientes')
      .select('*, usuarios(nombre)').eq('id', id).single()
    setCliente(c)
    const [{ data: v }, { data: e }, { data: a }] = await Promise.all([
      supabase.from('vehiculos').select('*').eq('cliente_id', id),
      supabase.from('pipeline_estados').select('*').order('orden'),
      supabase.from('actividades').select('*').eq('cliente_id', id)
        .order('fecha', { ascending: false })
    ])
    setVehiculos(v || []); setEstados(e || []); setActividades(a || [])
  }

  async function cambiarEstado(estado_id) {
    await supabase.from('clientes').update({ estado_id }).eq('id', id)
    cargar()
  }

  async function guardarActividad(e) {
    e.preventDefault()
    const payload = {
      ...act, cliente_id: id,
      empresa_id: cliente.empresa_id,
      vendedor_id: cliente.vendedor_id,
      hora: act.hora || null
    }
    const { error } = await supabase.from('actividades').insert(payload)
    if (error) { alert('Error: ' + error.message); return }
    setModal(false); setAct(ACT_VACIA); cargar()
  }

  if (!cliente) return <div className="text-slate-400 text-sm">Cargando…</div>

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => navigate('/clientes')}
              className="text-sm text-slate-500 hover:text-deep">← Volver a clientes</button>

      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-ink">{cliente.nombre}</h1>
            <div className="flex items-center gap-2 mt-2">
              {cliente.segmento && <Pill color={segColor(cliente.segmento)}>{segLabel(cliente.segmento)}</Pill>}
              <span className="text-xs text-slate-400">{cliente.tipo}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Facturación total</div>
            <div className="text-xl font-bold text-ink">{fmtCLP(cliente.facturacion_total)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-sm">
          <div><div className="text-xs text-slate-400">Teléfono</div>{cliente.telefono || '—'}</div>
          <div><div className="text-xs text-slate-400">Correo</div>{cliente.email || '—'}</div>
          <div><div className="text-xs text-slate-400">Última visita</div>{fmtFecha(cliente.ultima_visita)}</div>
          <div><div className="text-xs text-slate-400">Vendedor</div>{cliente.usuarios?.nombre || '—'}</div>
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
              className={`pill border transition ${
                cliente.estado_id === e.id ? 'text-white' : 'text-slate-600 hover:bg-mist'
              }`}
              style={cliente.estado_id === e.id
                ? { background: e.color, borderColor: e.color }
                : { borderColor: '#e2e8f0' }}>
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
              <div key={v.id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2">
                <div>
                  <span className="font-medium">{v.marca} {v.modelo}</span>
                  <span className="text-slate-400"> · {v.patente}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">{v.km_actual_estimado?.toLocaleString('es-CL')} km est.</span>
                  {v.ventana && <Pill color={VENTANAS[v.ventana]?.color}>{VENTANAS[v.ventana]?.label}</Pill>}
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-slate-400">Sin vehículos registrados.</p>}
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

      <Modal abierto={modal} onClose={() => setModal(false)} titulo="Registrar seguimiento">
        <form onSubmit={guardarActividad} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={act.tipo}
                      onChange={(e) => setAct({ ...act, tipo: e.target.value })}>
                {Object.entries(TIPOS_ACTIVIDAD).map(([k, v]) =>
                  <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Resultado</label>
              <select className="input" value={act.resultado}
                      onChange={(e) => setAct({ ...act, resultado: e.target.value })}>
                {Object.entries(RESULTADOS).map(([k, v]) =>
                  <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha</label>
              <input className="input" type="date" value={act.fecha}
                     onChange={(e) => setAct({ ...act, fecha: e.target.value })} />
            </div>
            <div>
              <label className="label">Hora</label>
              <input className="input" type="time" value={act.hora}
                     onChange={(e) => setAct({ ...act, hora: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input" rows="2" value={act.descripcion}
                      onChange={(e) => setAct({ ...act, descripcion: e.target.value })} />
          </div>
          <div>
            <label className="label">Próxima acción</label>
            <input className="input" value={act.proxima_accion}
                   onChange={(e) => setAct({ ...act, proxima_accion: e.target.value })}
                   placeholder="Ej: llamar el lunes para confirmar hora" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-soft" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary">Guardar</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
