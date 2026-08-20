import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import InspeccionIngreso from '../components/InspeccionIngreso'

/* ============================================================================
   Panel Nuevo Cliente
   ----------------------------------------------------------------------------
   Unifica tres cosas que antes estaban separadas y se hacían a destiempo:
     · El botón "+ Nuevo cliente" del listado (creaba una ficha con 4 campos).
     · El botón de inspección dentro de Nueva OT (opcional, se saltaba).
     · La creación de la ficha del vehículo (ocurría recién al guardar la OT).

   Ahora la recepción es un solo recorrido: se recibe el vehículo, se levanta
   la inspección, y de eso salen la ficha del cliente, la del vehículo y el
   documento de ingreso firmado.

   Caso "cliente sin vehículo": permitido, pero la ficha queda marcada como
   incompleta para que se pueda auditar después.
   ========================================================================== */

export default function NuevoCliente() {
  const { perfil } = useAuth()
  const nav = useNavigate()
  const [modo, setModo] = useState('ingreso')   // ingreso | solo_cliente
  const [listo, setListo] = useState(null)

  /* ---- Alta simple: cliente sin vehículo ---- */
  const [c, setC] = useState({ nombre: '', apellidos: '', rut: '', telefono: '', email: '', direccion: '', ciudad: '' })
  const [guardando, setGuardando] = useState(false)

  async function crearSoloCliente() {
    if (!c.nombre.trim() && !c.rut.trim()) {
      alert('Ingresa al menos el nombre o el RUT.')
      return
    }
    setGuardando(true)
    const { data, error } = await supabase.from('clientes').insert({
      empresa_id: perfil.empresa_id,
      nombre: c.nombre.trim() || '(sin nombre)', apellidos: c.apellidos.trim() || null,
      rut: c.rut.trim() || null, telefono: c.telefono.trim() || null,
      email: c.email.trim() || null, direccion: c.direccion.trim() || null,
      ciudad: c.ciudad.trim() || null,
      vendedor_id: perfil.id, estado: 'nuevo',
      // Sin vehículo asociado la ficha está incompleta: se marca para poder
      // encontrarla después y completarla, en vez de que se pierda entre las demás.
      ficha_incompleta: true
    }).select('id').single()
    setGuardando(false)
    if (error) return alert('No se pudo crear el cliente: ' + error.message)
    nav(`/clientes/${data.id}`)
  }

  if (listo) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="card p-5 text-center">
          <div className="text-3xl mb-2">✓</div>
          <h2 className="text-lg font-bold text-ink">Ingreso registrado</h2>
          <p className="text-sm text-slate-500 mt-1">
            Se crearon la ficha del cliente, la del vehículo y el documento de ingreso.
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            <button className="btn-primary" onClick={() => nav('/nueva-ot', { state: { inspeccion: listo } })}>Continuar a Nueva OT</button>
            {listo.vehiculo_id && (
              <button className="btn-soft" onClick={() => nav(`/vehiculos/${listo.vehiculo_id}`)}>Ver vehículo</button>
            )}
            {listo.cliente_id && (
              <button className="btn-soft" onClick={() => nav(`/clientes/${listo.cliente_id}`)}>Ver cliente</button>
            )}
            <button className="btn-soft" onClick={() => setListo(null)}>Registrar otro ingreso</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-ink">Nuevo cliente</h1>
        <p className="text-sm text-slate-500">
          Recepción del vehículo: crea la ficha del cliente, la del vehículo y el documento de ingreso.
        </p>
      </div>

      <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm">
        <button onClick={() => setModo('ingreso')}
          className={`px-3 py-2 ${modo === 'ingreso' ? 'bg-deep text-white' : 'text-slate-500'}`}>
          Ingreso con vehículo
        </button>
        <button onClick={() => setModo('solo_cliente')}
          className={`px-3 py-2 ${modo === 'solo_cliente' ? 'bg-deep text-white' : 'text-slate-500'}`}>
          Solo cliente
        </button>
      </div>

      {modo === 'ingreso' ? (
        <InspeccionIngreso
          comoPagina
          perfil={perfil}
          onCancelar={() => nav(-1)}
          onCompletada={(r) => setListo(r)}
        />
      ) : (
        <div className="card p-5 max-w-2xl space-y-3">
          <p className="text-xs px-2 py-1.5 rounded" style={{ background: '#fdf6e3', color: '#8a6d1f' }}>
            La ficha quedará marcada como <strong>incompleta</strong> hasta que se le asocie un vehículo.
            Úsalo solo cuando el cliente no trae vehículo.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Nombre(s)</label>
              <input className="input" value={c.nombre} onChange={(e) => setC({ ...c, nombre: e.target.value })} /></div>
            <div><label className="label">Apellidos</label>
              <input className="input" value={c.apellidos} onChange={(e) => setC({ ...c, apellidos: e.target.value })} /></div>
            <div><label className="label">RUT</label>
              <input className="input" value={c.rut} onChange={(e) => setC({ ...c, rut: e.target.value })} placeholder="12.345.678-9" /></div>
            <div><label className="label">Teléfono</label>
              <input className="input" value={c.telefono} onChange={(e) => setC({ ...c, telefono: e.target.value })} /></div>
            <div><label className="label">Correo</label>
              <input className="input" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></div>
            <div><label className="label">Ciudad</label>
              <input className="input" value={c.ciudad} onChange={(e) => setC({ ...c, ciudad: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className="label">Dirección</label>
              <input className="input" value={c.direccion} onChange={(e) => setC({ ...c, direccion: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button className="btn-soft" onClick={() => nav(-1)}>Cancelar</button>
            <button className="btn-primary" disabled={guardando} onClick={crearSoloCliente}>
              {guardando ? 'Creando…' : 'Crear ficha de cliente'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
