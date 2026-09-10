import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import InspeccionIngreso from '../components/InspeccionIngreso'
import OrdenesTrabajo from './OrdenesTrabajo'

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
  const [modo, setModo] = useState('ingreso')   // ingreso | ot
  const [listo, setListo] = useState(null)

  if (listo) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="card p-5 text-center">
          <div className="text-3xl mb-2">✓</div>
          <h2 className="text-lg font-bold text-ink">Ingreso registrado</h2>
          {listo.ot_numero && (
            <p className="text-2xl font-bold text-ink mt-2">OT N° {listo.ot_numero}</p>
          )}
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
          Nuevo Ingreso
        </button>
        <button onClick={() => setModo('ot')}
          className={`px-3 py-2 ${modo === 'ot' ? 'bg-deep text-white' : 'text-slate-500'}`}>
          Órdenes de trabajo
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
        <OrdenesTrabajo />
      )}
    </div>
  )
}
