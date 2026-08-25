import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmtCLP, formatPatente, ESTADOS_TALLER, OT_TIPO_DOCUMENTO } from '../lib/helpers'

/* ============================================================================
   Panel del asesor · seguimiento en taller y cierre de entrega
   ----------------------------------------------------------------------------
   Cierra el hueco del ciclo: el asesor entregaba el vehículo al taller y no
   volvía a saber de él hasta llenar Nueva OT. Aquí ve sus vehículos en proceso
   y, cuando el taller marca "listo para entrega", el vehículo pasa a la
   bandeja de cierre para registrar los datos de salida.

   La encuesta ya no se pregunta en el mostrador: se programa sola al cerrar.
   ========================================================================== */

const fecha = (d) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '—'
const dias = (d) => d ? Math.floor((Date.now() - new Date(d)) / 86400000) : 0

export default function CierreAsesor() {
  const { perfil, esAdmin } = useAuth()
  const nav = useNavigate()
  const [rows, setRows] = useState([])
  const [tab, setTab] = useState('proceso')      // proceso | cierre
  const [sel, setSel] = useState(null)
  const [estado, setEstado] = useState('cargando')
  const [errMsg, setErrMsg] = useState('')
  const [soloMios, setSoloMios] = useState(true)

  useEffect(() => { cargar() }, []) // eslint-disable-line

  async function cargar() {
    setEstado('cargando')
    const { data, error } = await supabase.from('trabajos_taller')
      .select(`id, titulo, estado, cierre_estado, prioridad, sucursal, creado_en,
               fecha_limite, progreso_clickup, asesor_id, cliente_id, vehiculo_id,
               tipo_documento, nro_documento, monto_total, entregado_en,
               monto_repuestos, monto_lubricantes, monto_mano_obra, monto_servicio_ext, descuento,
               retira_nombre, observaciones_entrega,
               vehiculos(patente, marca, modelo),
               clientes(nombre, apellidos, telefono, email)`)
      .neq('cierre_estado', 'cerrado')
      .order('creado_en', { ascending: false })
    if (error) { setErrMsg(error.message); setEstado('error'); return }
    setRows(data || []); setEstado('listo')
  }

  const visibles = useMemo(() => {
    let r = rows
    if (soloMios && !esAdmin) r = r.filter((x) => x.asesor_id === perfil?.id)
    return tab === 'cierre'
      ? r.filter((x) => x.cierre_estado === 'pendiente_cierre')
      : r.filter((x) => x.cierre_estado !== 'pendiente_cierre')
  }, [rows, tab, soloMios, esAdmin, perfil])

  const nCierre = rows.filter((x) => x.cierre_estado === 'pendiente_cierre'
    && (esAdmin || !soloMios || x.asesor_id === perfil?.id)).length

  if (estado === 'cargando') return <div className="text-slate-400 text-sm">Cargando…</div>
  if (estado === 'error') return (
    <div className="card p-4">
      <p className="text-sm text-slate-600">No se pudo cargar.</p>
      <p className="text-xs text-slate-400 mt-1">{errMsg}</p>
      <p className="text-[11px] text-slate-400 mt-2">
        Si menciona la columna <code>cierre_estado</code>, falta ejecutar la migración 66.
      </p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-ink">Mis vehículos</h1>
          <p className="text-sm text-slate-500">Seguimiento en taller y cierre de entrega</p>
        </div>
        {!esAdmin && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={soloMios} onChange={(e) => setSoloMios(e.target.checked)} />
            Solo los míos
          </label>
        )}
      </div>

      <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm">
        <button onClick={() => setTab('proceso')}
          className={`px-3 py-2 ${tab === 'proceso' ? 'bg-deep text-white' : 'text-slate-500'}`}>
          En taller
        </button>
        <button onClick={() => setTab('cierre')}
          className={`px-3 py-2 flex items-center gap-1.5 ${tab === 'cierre' ? 'bg-deep text-white' : 'text-slate-500'}`}>
          Pendientes de cierre
          {nCierre > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: tab === 'cierre' ? '#fff' : '#e0382b', color: tab === 'cierre' ? '#e0382b' : '#fff' }}>
              {nCierre}
            </span>
          )}
        </button>
      </div>

      {tab === 'cierre' && nCierre > 0 && (
        <p className="text-[11px] px-2 py-1.5 rounded" style={{ background: '#fdf6e3', color: '#8a6d1f' }}>
          El taller terminó estos vehículos. Al registrar la salida se programa la encuesta
          del cliente para el día siguiente.
        </p>
      )}

      {!visibles.length ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-slate-500">
            {tab === 'cierre' ? 'No hay vehículos pendientes de cierre.' : 'No tienes vehículos en taller.'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibles.map((t) => {
            const est = ESTADOS_TALLER[t.estado] || { label: t.estado, color: '#94a3b8' }
            const esperando = dias(t.creado_en)
            const listo = t.cierre_estado === 'pendiente_cierre'
            return (
              <button key={t.id} onClick={() => setSel(t)}
                className="card p-3 text-left border-l-4 active:bg-slate-50"
                style={{ borderLeftColor: listo ? '#1f9d57' : est.color }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">
                      {t.vehiculos?.patente ? formatPatente(t.vehiculos.patente) : 'Sin patente'}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {[t.vehiculos?.marca, t.vehiculos?.modelo].filter(Boolean).join(' ') || '—'}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {t.clientes ? `${t.clientes.nombre || ''} ${t.clientes.apellidos || ''}`.trim() : '—'}
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap"
                        style={{ background: est.color + '20', color: est.color }}>
                    {est.label}
                  </span>
                </div>

                {t.progreso_clickup != null && (
                  <div className="mt-2">
                    <div className="h-1.5 rounded bg-slate-100 overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${t.progreso_clickup}%`, background: '#7b68ee' }} />
                    </div>
                    <span className="text-[10px] text-slate-400">{t.progreso_clickup}% en taller</span>
                  </div>
                )}

                <div className="flex items-center justify-between mt-2 text-[11px]">
                  <span className="text-slate-400">
                    {esperando === 0 ? 'Ingresó hoy' : `${esperando} día${esperando > 1 ? 's' : ''} en taller`}
                  </span>
                  {listo
                    ? <span className="font-semibold" style={{ color: '#1f9d57' }}>Registrar salida →</span>
                    : <span className="text-slate-300">Ver</span>}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {sel && <ModalCierre trabajo={sel} perfil={perfil}
                onCerrar={() => setSel(null)}
                onGuardado={() => { setSel(null); cargar() }}
                irVehiculo={(id) => nav(`/vehiculos/${id}`)} />}
    </div>
  )
}

/* --------------------------- Datos de salida ------------------------------ */

function ModalCierre({ trabajo, perfil, onCerrar, onGuardado, irVehiculo }) {
  const listo = trabajo.cierre_estado === 'pendiente_cierre'
  const [f, setF] = useState({
    tipo_documento: trabajo.tipo_documento || 'Boleta',
    nro_documento: trabajo.nro_documento || '',
    monto_repuestos: trabajo.monto_repuestos || '',
    monto_lubricantes: trabajo.monto_lubricantes || '',
    monto_mano_obra: trabajo.monto_mano_obra || '',
    monto_servicio_ext: trabajo.monto_servicio_ext || '',
    descuento: trabajo.descuento || '',
    retira_nombre: trabajo.retira_nombre || '',
    observaciones_entrega: trabajo.observaciones_entrega || ''
  })
  const [guardando, setGuardando] = useState(false)
  const [err, setErr] = useState('')

  const n = (x) => parseInt(String(x).replace(/[^0-9]/g, ''), 10) || 0
  const total = n(f.monto_repuestos) + n(f.monto_lubricantes) + n(f.monto_mano_obra)
              + n(f.monto_servicio_ext) - n(f.descuento)

  async function cerrar() {
    if (!f.nro_documento.trim()) { setErr('Falta el número de documento.'); return }
    if (total <= 0) { setErr('El total debe ser mayor a cero.'); return }
    setGuardando(true); setErr('')
    const { error } = await supabase.from('trabajos_taller').update({
      cierre_estado: 'cerrado',
      estado: 'completada',
      tipo_documento: f.tipo_documento,
      nro_documento: f.nro_documento.trim(),
      monto_repuestos: n(f.monto_repuestos), monto_lubricantes: n(f.monto_lubricantes),
      monto_mano_obra: n(f.monto_mano_obra), monto_servicio_ext: n(f.monto_servicio_ext),
      descuento: n(f.descuento), monto_total: total,
      entregado_en: new Date().toISOString(), entregado_por: perfil.id,
      retira_nombre: f.retira_nombre.trim() || null,
      observaciones_entrega: f.observaciones_entrega.trim() || null
    }).eq('id', trabajo.id)
    setGuardando(false)
    if (error) { setErr('No se pudo cerrar: ' + error.message); return }
    onGuardado()
  }

  const campoMonto = (k, label) => (
    <div>
      <label className="label">{label}</label>
      <input className="input" inputMode="numeric" value={f[k]}
             onChange={(e) => setF({ ...f, [k]: e.target.value.replace(/[^0-9]/g, '') })} />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white sm:rounded-xl w-full max-w-lg max-h-[100dvh] sm:max-h-[92vh] overflow-y-auto">
        <div className="p-4 border-b border-slate-100 sticky top-0 bg-white flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-ink">
              {trabajo.vehiculos?.patente ? formatPatente(trabajo.vehiculos.patente) : 'Vehículo'}
            </h3>
            <p className="text-xs text-slate-400">
              {[trabajo.vehiculos?.marca, trabajo.vehiculos?.modelo].filter(Boolean).join(' ')}
              {trabajo.clientes && ` · ${trabajo.clientes.nombre || ''} ${trabajo.clientes.apellidos || ''}`.trimEnd()}
            </p>
          </div>
          <button onClick={onCerrar} className="text-slate-400 text-xl leading-none">×</button>
        </div>

        {!listo ? (
          <div className="p-4 space-y-3">
            <p className="text-sm text-slate-500">
              El vehículo sigue en taller. Los datos de salida se registran cuando el taller
              lo marque como listo para entrega.
            </p>
            <div className="text-sm">
              <span className="text-slate-400">Estado actual: </span>
              <strong>{(ESTADOS_TALLER[trabajo.estado] || {}).label || trabajo.estado}</strong>
            </div>
            {trabajo.vehiculos && (
              <button className="btn-soft text-sm" onClick={() => irVehiculo(trabajo.vehiculo_id)}>
                Ver ficha del vehículo →
              </button>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <p className="text-[11px] px-2 py-1.5 rounded" style={{ background: '#e8f6ee', color: '#1f7a45' }}>
              Al guardar, el trabajo queda cerrado y la encuesta del cliente se programa
              para mañana. No hay que preguntarle nada en el mostrador.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Documento</label>
                <select className="input" value={f.tipo_documento}
                        onChange={(e) => setF({ ...f, tipo_documento: e.target.value })}>
                  {(OT_TIPO_DOCUMENTO || ['Boleta', 'Factura', 'Sin documento']).map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <label className="label">N° documento</label>
                <input className="input" inputMode="numeric" value={f.nro_documento}
                       onChange={(e) => setF({ ...f, nro_documento: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {campoMonto('monto_repuestos', 'Repuestos')}
              {campoMonto('monto_lubricantes', 'Lubricantes')}
              {campoMonto('monto_mano_obra', 'Mano de obra')}
              {campoMonto('monto_servicio_ext', 'Servicio externo')}
              {campoMonto('descuento', 'Descuento')}
              <div>
                <label className="label">Total</label>
                <div className="input bg-mist/60 font-semibold text-ink flex items-center">
                  {fmtCLP(total)}
                </div>
              </div>
            </div>

            <div>
              <label className="label">Quién retira</label>
              <input className="input" placeholder="Si no es el titular" value={f.retira_nombre}
                     onChange={(e) => setF({ ...f, retira_nombre: e.target.value })} />
            </div>
            <div>
              <label className="label">Observaciones de entrega</label>
              <textarea className="input" rows={2} value={f.observaciones_entrega}
                        onChange={(e) => setF({ ...f, observaciones_entrega: e.target.value })} />
            </div>

            {!trabajo.clientes?.email && (
              <p className="text-[11px] px-2 py-1.5 rounded" style={{ background: '#fdf6e3', color: '#8a6d1f' }}>
                Este cliente no tiene correo: no se le podrá enviar la encuesta.
                Conviene pedírselo ahora.
              </p>
            )}
            {err && <p className="text-xs px-2 py-1.5 rounded" style={{ background: '#fdecea', color: '#8a1f18' }}>{err}</p>}
          </div>
        )}

        {listo && (
          <div className="p-4 border-t border-slate-100 flex gap-2 justify-end sticky bottom-0 bg-white">
            <button onClick={onCerrar} className="btn-soft text-sm">Cancelar</button>
            <button onClick={cerrar} disabled={guardando}
                    className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                    style={{ background: '#1f9d57' }}>
              {guardando ? 'Cerrando…' : '✓ Registrar salida'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
