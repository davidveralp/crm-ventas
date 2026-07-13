import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal, Pill } from './UI'
import { fmtCLP, fmtFecha, formatPatente, patenteLimpia } from '../lib/helpers'

// v33 · Facturas de repuestos capturadas (Vision) + bandeja de asignación.
// La validación y la alerta de confianza se hacen AQUÍ (no en la planilla).
// El encargado valida la factura, y luego asigna cada unidad de repuesto a
// una patente con precio de venta (margen sugerido por categoría). Al
// asignar, el repuesto entra al presupuesto de esa patente (área Repuestos).

const CONF = {
  ALTA:  { label: 'Confianza alta',  color: '#1f9d57' },
  MEDIA: { label: 'Confianza media', color: '#C98A1B' },
  BAJA:  { label: 'Confianza baja',  color: '#E0382B' }
}

export default function FacturasRepuestos({ perfil, onAsignado }) {
  const [subvista, setSubvista] = useState('bandeja') // bandeja | facturas
  const [facturas, setFacturas] = useState([])
  const [repuestos, setRepuestos] = useState([])
  const [margenes, setMargenes] = useState({})
  const [detalleFactura, setDetalleFactura] = useState(null)
  const [asignar, setAsignar] = useState(null) // repuesto en asignación
  const [cargando, setCargando] = useState(true)

  useEffect(() => { cargar() }, [])
  async function cargar() {
    setCargando(true)
    const [{ data: f }, { data: r }, { data: m }] = await Promise.all([
      supabase.from('facturas_repuestos').select('*').order('creada_en', { ascending: false }),
      supabase.from('repuestos_facturados').select('*').order('creado_en', { ascending: false }),
      supabase.from('margenes_repuestos').select('categoria,margen_pct')
    ])
    setFacturas(f || []); setRepuestos(r || [])
    setMargenes(Object.fromEntries((m || []).map((x) => [x.categoria, x.margen_pct])))
    setCargando(false)
  }

  const margenDefault = margenes['_default_'] ?? 30
  const facturaDe = (id) => facturas.find((x) => x.id === id)

  // Bandeja: repuestos pendientes o parciales, de facturas ya validadas
  const bandeja = useMemo(() => repuestos.filter((r) => {
    const f = facturaDe(r.id_factura)
    return f?.estado_crm === 'validada' && r.estado_asig !== 'asignado'
  }), [repuestos, facturas])

  const porValidar = facturas.filter((f) => f.estado_crm === 'por_validar')

  async function validarFactura(f, patente) {
    await supabase.from('facturas_repuestos').update({
      estado_crm: 'validada', patente_sugerida: patente || f.patente_sugerida,
      validada_por: perfil.id, validada_en: new Date().toISOString()
    }).eq('id', f.id)
    setDetalleFactura(null); cargar()
  }
  async function descartarFactura(f) {
    if (!confirm('¿Descartar esta factura? No aparecerá para asignar.')) return
    await supabase.from('facturas_repuestos').update({ estado_crm: 'descartada' }).eq('id', f.id)
    setDetalleFactura(null); cargar()
  }

  if (cargando) return <div className="text-sm text-slate-400 py-10 text-center">Cargando facturas…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          <button onClick={() => setSubvista('bandeja')}
                  className={`px-3 py-1.5 ${subvista === 'bandeja' ? 'bg-deep text-white' : 'text-slate-500'}`}>
            Repuestos por asignar ({bandeja.length})
          </button>
          <button onClick={() => setSubvista('facturas')}
                  className={`px-3 py-1.5 ${subvista === 'facturas' ? 'bg-deep text-white' : 'text-slate-500'}`}>
            Facturas {porValidar.length ? `· ${porValidar.length} por validar` : ''}
          </button>
        </div>
        <button className="btn-soft text-xs" onClick={cargar}>↻ Actualizar</button>
      </div>

      {/* ---------- BANDEJA DE REPUESTOS POR ASIGNAR ---------- */}
      {subvista === 'bandeja' && (
        bandeja.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-400">
            No hay repuestos por asignar. Valida facturas en la pestaña "Facturas" para que sus repuestos aparezcan aquí.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-paper text-slate-500 text-xs">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Repuesto</th>
                  <th className="text-left font-medium px-3 py-3 hidden md:table-cell">Factura</th>
                  <th className="text-center font-medium px-3 py-3">Pend.</th>
                  <th className="text-right font-medium px-3 py-3">Costo u.</th>
                  <th className="text-right font-medium px-3 py-3">V. sugerido</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {bandeja.map((r) => {
                  const f = facturaDe(r.id_factura)
                  const pend = (+r.cantidad || 1) - (+r.cantidad_asignada || 0)
                  const margen = margenDefault
                  const vSug = Math.round((+r.costo_unitario || 0) * (1 + margen / 100))
                  return (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-paper">
                      <td className="px-4 py-2.5">
                        <div className="text-ink">{r.descripcion || '—'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{r.codigo}</div>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-xs text-slate-500">
                        {f?.razon_social || '—'}<br />
                        <span className="text-slate-400">Folio {f?.folio} · {fmtFecha(f?.fecha_emision)}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">{pend}{r.estado_asig === 'parcial' ? ` / ${r.cantidad}` : ''}</td>
                      <td className="px-3 py-2.5 text-right text-slate-500">{fmtCLP(r.costo_unitario)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-400">{fmtCLP(vSug)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button className="btn-primary text-xs" onClick={() => setAsignar({ r, f, pend, margen, vSug, patente: f?.patente_sugerida || '', cantidad: pend, precio_venta: vSug })}>
                          Asignar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ---------- LISTA DE FACTURAS (validación) ---------- */}
      {subvista === 'facturas' && (
        facturas.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-400">
            Aún no hay facturas sincronizadas. Ejecuta el Apps Script "sincronizar_facturas" en la planilla de captura.
          </div>
        ) : (
          <div className="space-y-2">
            {facturas.map((f) => {
              const lineas = repuestos.filter((r) => r.id_factura === f.id)
              return (
                <div key={f.id} className="card p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink">{f.razon_social || 'Proveedor s/n'}</span>
                    <span className="text-xs text-slate-400">Folio {f.folio} · {fmtFecha(f.fecha_emision)} · {fmtCLP(f.total)}</span>
                    {f.confianza && <Pill color={CONF[f.confianza]?.color}>{CONF[f.confianza]?.label || f.confianza}</Pill>}
                    {f.estado_crm === 'validada' && <Pill color="#1f9d57">Validada</Pill>}
                    {f.estado_crm === 'descartada' && <Pill color="#94a3b8">Descartada</Pill>}
                    <span className="ml-auto text-xs text-slate-400">{lineas.length} línea(s)</span>
                    <button className="btn-soft text-xs" onClick={() => setDetalleFactura(f)}>Ver / validar</button>
                  </div>
                  {f.alertas && <p className="text-[11px] text-didial-amber mt-1">⚠ {f.alertas}</p>}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ---------- MODAL DETALLE / VALIDACIÓN DE FACTURA ---------- */}
      <Modal abierto={!!detalleFactura} onClose={() => setDetalleFactura(null)}
             titulo={detalleFactura ? `Factura ${detalleFactura.folio} · ${detalleFactura.razon_social || ''}` : ''}>
        {detalleFactura && (() => {
          const lineas = repuestos.filter((r) => r.id_factura === detalleFactura.id)
          return (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div><b>RUT emisor:</b> {detalleFactura.rut_emisor || '—'}</div>
                <div><b>Fecha:</b> {fmtFecha(detalleFactura.fecha_emision)}</div>
                <div><b>Neto:</b> {fmtCLP(detalleFactura.neto)}</div>
                <div><b>Total:</b> {fmtCLP(detalleFactura.total)}</div>
              </div>
              {detalleFactura.confianza && (
                <div className="flex items-center gap-2">
                  <Pill color={CONF[detalleFactura.confianza]?.color}>{CONF[detalleFactura.confianza]?.label}</Pill>
                  {detalleFactura.alertas && <span className="text-[11px] text-didial-amber">⚠ {detalleFactura.alertas}</span>}
                </div>
              )}
              <div className="rounded-lg border border-slate-100 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-paper text-slate-400"><tr>
                    <th className="text-left px-2 py-1.5">Cód.</th><th className="text-left px-2 py-1.5">Descripción</th>
                    <th className="text-center px-2 py-1.5">Cant.</th><th className="text-right px-2 py-1.5">Costo u.</th>
                  </tr></thead>
                  <tbody>
                    {lineas.map((l) => (
                      <tr key={l.id} className="border-t border-slate-50">
                        <td className="px-2 py-1.5 font-mono text-slate-400">{l.codigo}</td>
                        <td className="px-2 py-1.5 text-ink">{l.descripcion}</td>
                        <td className="px-2 py-1.5 text-center">{l.cantidad}</td>
                        <td className="px-2 py-1.5 text-right">{fmtCLP(l.costo_unitario)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <label className="label">Patente sugerida (opcional, editable al asignar cada repuesto)</label>
                <input className="input" defaultValue={detalleFactura.patente_sugerida || ''}
                       onChange={(e) => (detalleFactura._patente = e.target.value)}
                       placeholder="Se hereda a las líneas, pero cada unidad se puede reasignar" />
              </div>
              <div className="flex justify-end gap-2">
                {detalleFactura.estado_crm !== 'descartada' &&
                  <button className="btn-soft text-slate-500" onClick={() => descartarFactura(detalleFactura)}>Descartar</button>}
                {detalleFactura.estado_crm !== 'validada' &&
                  <button className="btn-primary" onClick={() => validarFactura(detalleFactura, detalleFactura._patente)}>
                    ✓ Validar factura
                  </button>}
              </div>
              {detalleFactura.estado_crm === 'validada' &&
                <p className="text-[11px] text-green-600 text-right">Validada. Sus repuestos ya están en "Repuestos por asignar".</p>}
            </div>
          )
        })()}
      </Modal>

      {/* ---------- MODAL ASIGNAR REPUESTO A PATENTE / PRESUPUESTO ---------- */}
      <Modal abierto={!!asignar} onClose={() => setAsignar(null)}
             titulo={asignar ? `Asignar · ${asignar.r.descripcion || asignar.r.codigo}` : ''}>
        {asignar && (
          <AsignarRepuesto asignar={asignar} setAsignar={setAsignar} perfil={perfil}
                           margenDefault={margenDefault}
                           onListo={() => { setAsignar(null); cargar(); onAsignado?.() }} />
        )}
      </Modal>
    </div>
  )
}

// Formulario de asignación: patente destino (editable), cantidad parcial,
// precio de venta con margen sugerido. Crea/actualiza el presupuesto de la
// patente y agrega el repuesto al área Repuestos.
function AsignarRepuesto({ asignar, perfil, margenDefault, onListo }) {
  const { r, pend } = asignar
  const [patente, setPatente] = useState(asignar.patente || '')
  const [cantidad, setCantidad] = useState(asignar.cantidad || pend)
  const [margen, setMargen] = useState(margenDefault)
  const [precioVenta, setPrecioVenta] = useState(asignar.vSug)
  const [buscando, setBuscando] = useState(false)
  const [vehInfo, setVehInfo] = useState(null)
  const [guardando, setGuardando] = useState(false)

  // recalcula el precio sugerido si cambia el margen
  function aplicarMargen(m) {
    setMargen(m)
    setPrecioVenta(Math.round((+r.costo_unitario || 0) * (1 + (+m || 0) / 100)))
  }

  async function verificarPatente() {
    if (patenteLimpia(patente).length < 5) { setVehInfo(null); return }
    setBuscando(true)
    const { data } = await supabase.from('vehiculos')
      .select('id,marca,modelo,cliente_id,clientes(nombre,apellidos)')
      .ilike('patente', `%${formatPatente(patente)}%`).limit(1)
    setVehInfo(data?.[0] || false); setBuscando(false)
  }

  async function guardar() {
    if (!vehInfo) return alert('Verifica primero una patente existente en el CRM.')
    if (cantidad < 1 || cantidad > pend) return alert(`La cantidad debe estar entre 1 y ${pend}.`)
    setGuardando(true)

    // 1) presupuesto "en espera" de esa patente (origen sin_solicitud) o uno nuevo
    let { data: presup } = await supabase.from('presupuestos_taller')
      .select('id,items,monto').eq('vehiculo_id', vehInfo.id)
      .in('estado', ['solicitado', 'cotizando']).order('creado_en', { ascending: false }).limit(1).maybeSingle()

    const item = {
      tipo: 'repuesto', codigo: r.codigo || '', detalle: r.descripcion || r.codigo,
      cant: +cantidad, costo: Math.round(+r.costo_unitario || 0), precio: Math.round(+precioVenta || 0),
      en_stock: null, origen_factura: r.id_factura
    }

    if (presup) {
      const items = [...(presup.items || []), item]
      const monto = Math.round(items.reduce((s, x) => s + (+x.precio || 0) * (+x.cant || 1), 0))
      await supabase.from('presupuestos_taller').update({ items, monto }).eq('id', presup.id)
    } else {
      await supabase.from('presupuestos_taller').insert({
        empresa_id: perfil.empresa_id, trabajo_id: null, origen: 'sin_solicitud',
        cliente_id: vehInfo.cliente_id, vehiculo_id: vehInfo.id, estado: 'cotizando',
        elaborado_por: perfil.id, items: [item],
        monto: Math.round((+precioVenta || 0) * (+cantidad || 1)),
        notas: 'Creado al asignar un repuesto facturado.'
      })
    }

    // 2) actualiza el estado de asignación del repuesto (permite parcial)
    const nuevaAsig = (+r.cantidad_asignada || 0) + (+cantidad)
    await supabase.from('repuestos_facturados').update({
      cantidad_asignada: nuevaAsig,
      estado_asig: nuevaAsig >= (+r.cantidad || 1) ? 'asignado' : 'parcial'
    }).eq('id', r.id)

    setGuardando(false); onListo?.()
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-paper p-3 text-xs text-slate-600 flex justify-between">
        <span>Costo unitario (factura): <b>{fmtCLP(r.costo_unitario)}</b></span>
        <span>Pendiente: <b>{pend}</b></span>
      </div>
      <div>
        <label className="label">Patente destino *</label>
        <div className="flex gap-2">
          <input className="input" value={patente} onChange={(e) => setPatente(e.target.value)}
                 onBlur={verificarPatente} placeholder="Ej: GH TY 34" />
          <button className="btn-soft text-xs" type="button" onClick={verificarPatente}>Verificar</button>
        </div>
        {buscando && <p className="text-[11px] text-slate-400 mt-0.5">Buscando…</p>}
        {vehInfo === false && <p className="text-[11px] text-didial-red mt-0.5">No existe esa patente en el CRM. Créala primero (ficha del cliente).</p>}
        {vehInfo && <p className="text-[11px] text-green-600 mt-0.5">✓ {[vehInfo.marca, vehInfo.modelo].filter(Boolean).join(' ')} · {[vehInfo.clientes?.nombre, vehInfo.clientes?.apellidos].filter(Boolean).join(' ')}</p>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label">Cantidad</label>
          <input className="input" type="number" min="1" max={pend} value={cantidad}
                 onChange={(e) => setCantidad(+e.target.value)} />
        </div>
        <div>
          <label className="label">Margen %</label>
          <input className="input" type="number" min="0" value={margen}
                 onChange={(e) => aplicarMargen(e.target.value)} />
        </div>
        <div>
          <label className="label">Precio venta u.</label>
          <input className="input" type="number" min="0" value={precioVenta}
                 onChange={(e) => setPrecioVenta(+e.target.value)} />
        </div>
      </div>
      <div className="text-xs text-slate-500 text-right">
        Total a presupuesto: <b className="text-ink">{fmtCLP((+precioVenta || 0) * (+cantidad || 1))}</b>
        <span className="text-slate-400"> (solo el precio de venta va al presupuesto)</span>
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn-soft" onClick={onListo}>Cancelar</button>
        <button className="btn-primary" disabled={guardando || !vehInfo} onClick={guardar}>
          {guardando ? 'Asignando…' : 'Asignar al presupuesto'}
        </button>
      </div>
    </div>
  )
}
