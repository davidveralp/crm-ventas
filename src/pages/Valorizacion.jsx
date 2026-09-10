import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmtCLP, formatPatente } from '../lib/helpers'

/* ============================================================================
   Valorización de OT · encargado de presupuestos
   ----------------------------------------------------------------------------
   El asesor carga QUÉ hay que hacer al recibir el vehículo; aquí se define
   CUÁNTO cuesta. Es la separación que hoy no existe: en Dimasoft el precio
   termina escrito dentro de Observaciones, sin línea de detalle, y así no hay
   margen por ítem ni consumo de bodega.

   Cada línea guarda quién la valorizó y cuándo, para distinguir lo cargado por
   el asesor de lo valorizado por el encargado.
   ========================================================================== */

const AREAS = [
  ['repuesto', 'Repuestos'],
  ['insumo', 'Lubricantes e insumos'],
  ['servicio', 'Mano de obra'],
  ['servicio_externo', 'Servicios externos']
]

const dias = (d) => Math.floor((Date.now() - new Date(d)) / 86400000)

export default function Valorizacion() {
  const { perfil } = useAuth()
  const [ots, setOts] = useState([])
  const [sel, setSel] = useState(null)
  const [estado, setEstado] = useState('cargando')
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setEstado('cargando')
    const { data, error } = await supabase.from('v_ot_por_valorizar').select('*')
    if (error) { setErrMsg(error.message); setEstado('error'); return }
    setOts(data || []); setEstado('listo')
  }

  if (estado === 'cargando') return <div className="text-slate-400 text-sm">Cargando…</div>
  if (estado === 'error') return (
    <div className="card p-4">
      <p className="text-sm text-slate-600">No se pudo cargar la bandeja.</p>
      <p className="text-xs text-slate-400 mt-1">{errMsg}</p>
      <p className="text-[11px] text-slate-400 mt-2">
        Si menciona <code>v_ot_por_valorizar</code>, falta la migración 73.
      </p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-ink">Por valorizar</h2>
        <p className="text-[11px] text-slate-400">
          Órdenes con líneas cargadas por el asesor y sin precio.
        </p>
      </div>

      {!ots.length ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-slate-500">No hay órdenes pendientes de valorizar.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ots.map((o) => {
            const d = dias(o.creado_en)
            return (
              <button key={o.trabajo_id} onClick={() => setSel(o)}
                className="card p-3 text-left border-l-4 active:bg-slate-50"
                style={{ borderLeftColor: d >= 1 ? '#e0382b' : '#e0a020' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">
                      {o.patente ? formatPatente(o.patente) : 'Sin patente'}
                      {o.ot_numero && <span className="text-slate-400 font-normal"> · OT {o.ot_numero}</span>}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {[o.marca, o.modelo].filter(Boolean).join(' ')}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {`${o.nombre || ''} ${o.apellidos || ''}`.trim() || '—'}
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0"
                        style={{ background: '#fdecea', color: '#e0382b' }}>
                    {o.sin_valorizar}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1.5">
                  {o.sin_valorizar} de {o.total_lineas} sin precio ·{' '}
                  {d === 0 ? 'ingresó hoy' : `hace ${d} día${d > 1 ? 's' : ''}`}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {sel && <ModalValorizar ot={sel} perfil={perfil}
                onCerrar={() => setSel(null)}
                onGuardado={() => { setSel(null); cargar() }} />}
    </div>
  )
}

function ModalValorizar({ ot, perfil, onCerrar, onGuardado }) {
  const [lineas, setLineas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase.from('ot_detalle').select('*').eq('trabajo_id', ot.trabajo_id).order('orden')
      .then(({ data }) => {
        setLineas((data || []).map((l) => ({
          ...l,
          precio_unit: l.precio_unit ? String(l.precio_unit) : '',
          costo_unit: l.costo_unit ? String(l.costo_unit) : '',
          codigo: l.codigo || '', proveedor: l.proveedor || ''
        })))
        setCargando(false)
      })
  }, [ot.trabajo_id])

  const num = (x) => Number(String(x).replace(/[^0-9.]/g, '')) || 0
  const total = useMemo(
    () => lineas.reduce((a, l) => a + num(l.cantidad) * num(l.precio_unit), 0), [lineas])
  const pendientes = lineas.filter((l) => !num(l.precio_unit)).length

  const editar = (id, campo, valor) =>
    setLineas((x) => x.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)))

  async function guardar() {
    const conPrecio = lineas.filter((l) => num(l.precio_unit) > 0)
    if (!conPrecio.length) { setErr('Valoriza al menos una línea.'); return }
    setGuardando(true); setErr('')

    for (const l of conPrecio) {
      const { error } = await supabase.from('ot_detalle').update({
        precio_unit: num(l.precio_unit),
        costo_unit: num(l.costo_unit) || null,
        codigo: l.codigo?.trim() || null,
        proveedor: l.proveedor?.trim() || null,
        // Marca de quién valorizó: distingue lo cargado por el asesor de lo
        // definido por el encargado.
        valorizado_por: perfil.id, valorizado_en: new Date().toISOString()
      }).eq('id', l.id)
      if (error) { setGuardando(false); setErr('No se pudo guardar: ' + error.message); return }
    }

    await supabase.rpc('recalcular_total_ot', { p_trabajo: ot.trabajo_id })

    // Aviso al asesor: la OT ya tiene precio y puede hablar con el cliente.
    await supabase.from('notificaciones').insert({
      empresa_id: perfil.empresa_id, rol_destino: 'asesor_multimarca',
      titulo: `OT ${ot.ot_numero || ''} valorizada · ${ot.patente ? formatPatente(ot.patente) : ''}`,
      cuerpo: `${conPrecio.length} línea(s) por ${fmtCLP(total)}`,
      url: '/cierres'
    })

    setGuardando(false)
    onGuardado()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white sm:rounded-xl w-full max-w-3xl max-h-[100dvh] sm:max-h-[92vh] overflow-y-auto">
        <div className="p-4 border-b border-slate-100 sticky top-0 bg-white flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-ink">
              {ot.patente ? formatPatente(ot.patente) : 'Vehículo'}
              {ot.ot_numero && <span className="text-slate-400 font-normal"> · OT {ot.ot_numero}</span>}
            </h3>
            <p className="text-xs text-slate-400">
              {[ot.marca, ot.modelo].filter(Boolean).join(' ')} ·{' '}
              {`${ot.nombre || ''} ${ot.apellidos || ''}`.trim()}
            </p>
          </div>
          <button onClick={onCerrar} className="text-slate-400 text-xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-4">
          {cargando ? <p className="text-sm text-slate-400">Cargando líneas…</p> : (
            <>
              {AREAS.map(([tipo, titulo]) => {
                const ls = lineas.filter((l) => l.tipo === tipo)
                if (!ls.length) return null
                const sub = ls.reduce((a, l) => a + num(l.cantidad) * num(l.precio_unit), 0)
                return (
                  <div key={tipo} className="rounded-lg border border-slate-200 p-2">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-sm font-medium text-ink">{titulo}</span>
                      <span className="text-xs text-slate-500">{sub ? fmtCLP(sub) : '—'}</span>
                    </div>
                    {ls.map((l) => {
                      const listo = num(l.precio_unit) > 0
                      return (
                        <div key={l.id} className="grid grid-cols-12 gap-1.5 mb-1.5 items-center">
                          <div className="col-span-12 sm:col-span-4 text-sm text-slate-700">
                            {!listo && <span style={{ color: '#e0382b' }}>● </span>}
                            {l.detalle}
                          </div>
                          {tipo === 'repuesto' && (
                            <input className="input col-span-4 sm:col-span-2" style={{ minHeight: '38px' }}
                                   placeholder="Código" value={l.codigo}
                                   onChange={(e) => editar(l.id, 'codigo', e.target.value)} />
                          )}
                          {tipo === 'servicio_externo' && (
                            <input className="input col-span-4 sm:col-span-2" style={{ minHeight: '38px' }}
                                   placeholder="Proveedor" value={l.proveedor}
                                   onChange={(e) => editar(l.id, 'proveedor', e.target.value)} />
                          )}
                          <div className="col-span-2 sm:col-span-1 text-xs text-slate-400 text-center">
                            {Number(l.cantidad) % 1 === 0 ? l.cantidad : Number(l.cantidad).toFixed(2)}
                          </div>
                          <input className="input col-span-3 sm:col-span-2" style={{ minHeight: '38px' }}
                                 inputMode="numeric" placeholder="Costo" value={l.costo_unit}
                                 onChange={(e) => editar(l.id, 'costo_unit', e.target.value.replace(/[^0-9]/g, ''))} />
                          <input className="input col-span-3 sm:col-span-2" style={{ minHeight: '38px' }}
                                 inputMode="numeric" placeholder="Precio" value={l.precio_unit}
                                 onChange={(e) => editar(l.id, 'precio_unit', e.target.value.replace(/[^0-9]/g, ''))} />
                          <div className="col-span-2 sm:col-span-1 text-right text-sm font-medium text-ink">
                            {num(l.precio_unit) ? fmtCLP(num(l.cantidad) * num(l.precio_unit)) : ''}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}

              <div className="flex items-center justify-between rounded-lg p-3"
                   style={{ background: '#f1f5f9' }}>
                <span className="text-sm text-slate-600">
                  {pendientes ? `${pendientes} línea(s) sin precio` : 'Todas valorizadas'}
                </span>
                <span className="text-lg font-semibold text-ink">{fmtCLP(total)}</span>
              </div>
              <p className="text-[11px] text-slate-400">
                El costo es opcional y sirve para el margen. El precio es lo que se cobra,
                con IVA incluido.
              </p>
              {err && <p className="text-xs px-2 py-1.5 rounded" style={{ background: '#fdecea', color: '#8a1f18' }}>{err}</p>}
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex gap-2 justify-end sticky bottom-0 bg-white">
          <button className="btn-soft text-sm" onClick={onCerrar}>Cancelar</button>
          <button className="btn-primary text-sm" disabled={guardando || cargando} onClick={guardar}>
            {guardando ? 'Guardando…' : 'Guardar valorización'}
          </button>
        </div>
      </div>
    </div>
  )
}
