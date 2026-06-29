import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { SelectMarca } from '../components/UI'
import { TIPOS_SERVICIO, formatPatente, patenteLimpia, fmtCLP } from '../lib/helpers'

const VACIA = {
  ot_numero: '', fecha: new Date().toISOString().slice(0, 10), patente: '',
  marca: '', modelo: '', tipo_servicio: '', tipo_servicio_2: '', km: '', monto: '', descripcion: ''
}

// Crea una OT directamente en la base (tabla servicios). Los triggers
// la enlazan con su vehículo/cliente por patente — sin latencia de sync.
export default function NuevaOT() {
  const { perfil } = useAuth()
  const [f, setF] = useState(VACIA)
  const [veh, setVeh] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')

  async function buscarVehiculo(patente) {
    const limpia = patenteLimpia(patente)
    if (limpia.length < 5) { setVeh(null); return }
    const { data } = await supabase.from('vehiculos')
      .select('id,marca,modelo,cliente_id,clientes(nombre)')
      .ilike('patente', `%${formatPatente(patente)}%`).limit(1)
    const v = data?.[0]
    if (v) { setVeh(v); setF((x) => ({ ...x, marca: v.marca || x.marca, modelo: v.modelo || x.modelo })) }
    else setVeh(null)
  }

  async function guardar(e) {
    e.preventDefault()
    if (!f.patente.trim() || !f.tipo_servicio) { setMsg('Ingresa al menos patente y tipo de servicio.'); return }
    setGuardando(true); setMsg('')
    const { error } = await supabase.from('servicios').insert({
      empresa_id: perfil.empresa_id,
      ot_numero: f.ot_numero.trim() || null,
      fecha: f.fecha || null,
      patente: patenteLimpia(f.patente),
      tipo_servicio: f.tipo_servicio || null,
      tipo_servicio_2: f.tipo_servicio_2 || null,
      km: f.km ? parseInt(f.km, 10) : null,
      monto: f.monto ? Number(f.monto) : null,
      descripcion: f.descripcion || null
    })
    setGuardando(false)
    if (error) { setMsg('Error: ' + error.message); return }
    // Actualiza el kilometraje del vehículo si lo conocemos
    if (veh?.id && f.km) {
      await supabase.from('vehiculos').update({ km_ultimo: parseInt(f.km, 10) }).eq('id', veh.id)
    }
    setMsg(`OT registrada${veh ? ' y enlazada a ' + (veh.clientes?.nombre || 'su vehículo') : ''}.`)
    setF(VACIA); setVeh(null)
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink">Nueva orden de trabajo</h1>
        <p className="text-sm text-slate-500">Se registra al instante y se enlaza con el vehículo por patente.</p>
      </div>

      <form onSubmit={guardar} className="card p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">N° OT</label>
            <input className="input" value={f.ot_numero} onChange={(e) => setF({ ...f, ot_numero: e.target.value })} placeholder="Opcional" />
          </div>
          <div>
            <label className="label">Fecha de ingreso</label>
            <input className="input" type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="label">Patente *</label>
          <input className="input" value={f.patente}
                 onChange={(e) => setF({ ...f, patente: formatPatente(e.target.value) })}
                 onBlur={(e) => buscarVehiculo(e.target.value)} placeholder="XX XX XX" />
          {veh && <p className="text-xs text-[#1D9E75] mt-1">Vehículo encontrado: {veh.marca} {veh.modelo} · {veh.clientes?.nombre}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Marca</label>
            <SelectMarca value={f.marca} onChange={(v) => setF({ ...f, marca: v })} />
          </div>
          <div>
            <label className="label">Modelo</label>
            <input className="input" value={f.modelo} onChange={(e) => setF({ ...f, modelo: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tipo de servicio *</label>
            <select className="input" value={f.tipo_servicio} onChange={(e) => setF({ ...f, tipo_servicio: e.target.value })}>
              <option value="">— Selecciona —</option>
              {Object.entries(TIPOS_SERVICIO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Segundo servicio</label>
            <select className="input" value={f.tipo_servicio_2} onChange={(e) => setF({ ...f, tipo_servicio_2: e.target.value })}>
              <option value="">— Ninguno —</option>
              {Object.entries(TIPOS_SERVICIO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Kilometraje</label>
            <input className="input" type="number" value={f.km} onChange={(e) => setF({ ...f, km: e.target.value })} />
          </div>
          <div>
            <label className="label">Monto total (CLP)</label>
            <input className="input" type="number" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} />
            {f.monto && <p className="text-xs text-slate-400 mt-1">{fmtCLP(Number(f.monto))}</p>}
          </div>
        </div>

        <div>
          <label className="label">Detalle</label>
          <textarea className="input" rows="3" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
        </div>

        {msg && <div className="rounded-lg bg-sky/10 px-3 py-2 text-sm text-deep">{msg}</div>}
        <div className="flex justify-end">
          <button className="btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Registrar OT'}</button>
        </div>
      </form>
    </div>
  )
}
