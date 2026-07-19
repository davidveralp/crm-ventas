import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './UI'
import { formatPatente, patenteLimpia } from '../lib/helpers'

// v43 · Tareas creadas directo en ClickUp (no desde el CRM). El título es
// texto libre de los técnicos — no se auto-crea nada. Aquí se revisa cada
// una: vincular a un vehículo/trabajo existente, o crear el cliente y
// vehículo con los datos sugeridos (siempre editables antes de guardar).
export default function BandejaClickUp({ perfil, onVinculado }) {
  const [pendientes, setPendientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [activo, setActivo] = useState(null) // tarea en revisión

  useEffect(() => { cargar() }, [])
  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('clickup_tareas_pendientes')
      .select('*').eq('estado', 'pendiente').order('creado_en', { ascending: false })
    setPendientes(data || [])
    setCargando(false)
  }

  async function descartar(p) {
    if (!confirm('¿Descartar esta tarea? No se creará ni vinculará nada en el CRM.')) return
    await supabase.from('clickup_tareas_pendientes').update({ estado: 'descartada' }).eq('id', p.id)
    cargar()
  }

  if (cargando) return null
  if (!pendientes.length) return null

  return (
    <div className="card p-4 border-l-4" style={{ borderLeftColor: '#7A5C8E' }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-semibold text-ink">🔗 Tareas creadas en ClickUp sin vincular ({pendientes.length})</div>
          <p className="text-xs text-slate-500">Se crearon directo en ClickUp — revisa y vincula al cliente/vehículo correspondiente.</p>
        </div>
      </div>
      <div className="space-y-1.5">
        {pendientes.map((p) => (
          <div key={p.id} className="flex items-center gap-2 text-sm rounded border border-slate-100 px-3 py-2">
            <span className="flex-1 text-ink truncate" title={p.titulo}>{p.titulo}</span>
            {p.patente_candidata && <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-mist text-deep">{p.patente_candidata}</span>}
            <button className="btn-soft text-xs" onClick={() => setActivo(p)}>Revisar</button>
            <button className="text-slate-300 hover:text-red-500 text-xs" onClick={() => descartar(p)}>✕</button>
          </div>
        ))}
      </div>

      <Modal abierto={!!activo} onClose={() => setActivo(null)} titulo="Vincular tarea de ClickUp">
        {activo && (
          <RevisarTarea perfil={perfil} p={activo}
                        onListo={() => { setActivo(null); cargar(); onVinculado?.() }} />
        )}
      </Modal>
    </div>
  )
}

function RevisarTarea({ perfil, p, onListo }) {
  const [modo, setModo] = useState(null) // 'vincular' | 'crear'
  const [busca, setBusca] = useState(p.patente_candidata || '')
  const [res, setRes] = useState([])
  const [nuevoCli, setNuevoCli] = useState({ patente: p.patente_candidata || '', nombre: '', apellidos: '', rut: '', marca: '', modelo: '' })
  const [guardando, setGuardando] = useState(false)

  async function buscar(q) {
    setBusca(q)
    if (patenteLimpia(q).length < 3) { setRes([]); return }
    const { data } = await supabase.from('vehiculos')
      .select('id,patente,marca,modelo,cliente_id,clientes(nombre,apellidos)')
      .ilike('patente', `%${formatPatente(q)}%`).limit(6)
    setRes(data || [])
  }

  async function vincularA(veh) {
    setGuardando(true)
    // crea el trabajo de taller para ese vehículo, ya vinculado a la tarea de ClickUp
    const { error } = await supabase.from('trabajos_taller').insert({
      empresa_id: perfil.empresa_id, cliente_id: veh.cliente_id, vehiculo_id: veh.id,
      estado: 'por_designar', servicio_solicitado: p.descripcion || p.titulo,
      clickup_task_id: p.clickup_task_id, clickup_synced_at: new Date().toISOString()
    })
    if (error) { setGuardando(false); return alert('Error: ' + error.message) }
    await supabase.from('clickup_tareas_pendientes').update({ estado: 'vinculada' }).eq('id', p.id)
    setGuardando(false); onListo?.()
  }

  async function crearYVincular() {
    if (!nuevoCli.patente.trim() || !nuevoCli.nombre.trim()) return alert('Patente y nombre del cliente son obligatorios.')
    setGuardando(true)
    const { data: cli, error: eCli } = await supabase.from('clientes').insert({
      empresa_id: perfil.empresa_id, nombre: nuevoCli.nombre.trim(), apellidos: nuevoCli.apellidos.trim(),
      rut: nuevoCli.rut.trim() || null, tipo: 'PERSONA', segmento: 'nuevo', vendedor_id: perfil.id,
      notas: 'Creado desde una tarea de ClickUp sin vincular.'
    }).select('id').single()
    if (eCli) { setGuardando(false); return alert('Error cliente: ' + eCli.message) }
    const { data: veh, error: eVeh } = await supabase.from('vehiculos').insert({
      empresa_id: perfil.empresa_id, cliente_id: cli.id, patente: formatPatente(nuevoCli.patente),
      marca: nuevoCli.marca.trim() || null, modelo: nuevoCli.modelo.trim() || null
    }).select('id').single()
    if (eVeh) { setGuardando(false); return alert('Error vehículo: ' + eVeh.message) }
    await vincularA({ id: veh.id, cliente_id: cli.id })
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-paper p-3 text-sm">
        <div className="font-medium text-ink">{p.titulo}</div>
        {p.descripcion && <div className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{p.descripcion}</div>}
      </div>

      {!modo && (
        <div className="flex gap-2">
          <button className="btn-soft flex-1" onClick={() => setModo('vincular')}>Vincular a vehículo existente</button>
          <button className="btn-soft flex-1" onClick={() => setModo('crear')}>Crear cliente y vehículo nuevo</button>
        </div>
      )}

      {modo === 'vincular' && (
        <div className="space-y-2">
          <input className="input" autoFocus value={busca} onChange={(e) => buscar(e.target.value)}
                 placeholder="Buscar por patente…" />
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {res.map((v) => (
              <button key={v.id} disabled={guardando} onClick={() => vincularA(v)}
                      className="w-full text-left card p-2 hover:border-deep transition text-sm">
                <span className="font-mono">{v.patente}</span> · {[v.marca, v.modelo].filter(Boolean).join(' ')}
                <div className="text-xs text-slate-400">{[v.clientes?.nombre, v.clientes?.apellidos].filter(Boolean).join(' ')}</div>
              </button>
            ))}
            {busca.length >= 3 && !res.length && <p className="text-xs text-slate-400">Sin resultados.</p>}
          </div>
          <button className="text-xs text-slate-400 hover:underline" onClick={() => setModo(null)}>← Volver</button>
        </div>
      )}

      {modo === 'crear' && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-400">Datos sugeridos del título — revisa y corrige antes de guardar.</p>
          <div className="grid grid-cols-2 gap-2">
            <input className="input text-sm" placeholder="Patente *" value={nuevoCli.patente}
                   onChange={(e) => setNuevoCli({ ...nuevoCli, patente: e.target.value })} />
            <input className="input text-sm" placeholder="RUT" value={nuevoCli.rut}
                   onChange={(e) => setNuevoCli({ ...nuevoCli, rut: e.target.value })} />
            <input className="input text-sm" placeholder="Nombre(s) *" value={nuevoCli.nombre}
                   onChange={(e) => setNuevoCli({ ...nuevoCli, nombre: e.target.value })} />
            <input className="input text-sm" placeholder="Apellidos" value={nuevoCli.apellidos}
                   onChange={(e) => setNuevoCli({ ...nuevoCli, apellidos: e.target.value })} />
            <input className="input text-sm" placeholder="Marca" value={nuevoCli.marca}
                   onChange={(e) => setNuevoCli({ ...nuevoCli, marca: e.target.value })} />
            <input className="input text-sm" placeholder="Modelo" value={nuevoCli.modelo}
                   onChange={(e) => setNuevoCli({ ...nuevoCli, modelo: e.target.value })} />
          </div>
          <div className="flex justify-between items-center">
            <button className="text-xs text-slate-400 hover:underline" onClick={() => setModo(null)}>← Volver</button>
            <button className="btn-primary text-sm" disabled={guardando} onClick={crearYVincular}>
              {guardando ? 'Creando…' : 'Crear y vincular'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
