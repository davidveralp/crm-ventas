import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Pill } from './UI'
import { fmtCLP, ESTADOS_PRESUP_TALLER, SECCIONES_PRESUP, seccionDe, TIPOS_VEHICULO, categoriaDeServicio, svcAplicaAVehiculo, OT_SVC_CATEGORIA } from '../lib/helpers'

// v23 · Tarjeta de presupuesto de taller COMPARTIDA.
// - En el módulo Presupuestos (encargado de presupuestos / admin): editable.
// - En el Taller: solo lectura (el presupuesto se elabora en Presupuestos).
export default function PresupuestoTallerCard({ p, t, esJefe, esCompras, perfil, guardar, tituloDe, margenes, editable = true }) {
  const [abierto, setAbierto] = useState(false)
  const [items, setItems] = useState(p.items || [])
  const [monto, setMonto] = useState(p.monto || 0)
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState([])
  const puedeEditar = editable && (esCompras || perfil?.rol === 'admin')
  const est = ESTADOS_PRESUP_TALLER[p.estado] || {}
  // v28: filtro de categoría para el buscador de la base de precios,
  // precargado con la categoría del servicio solicitado del trabajo.
  const [fCat, setFCat] = useState(() => categoriaDeServicio(t?.servicio_solicitado) || '')
  const CATEGORIAS = [...new Set(Object.values(OT_SVC_CATEGORIA))].sort()
  const [tipoLocal, setTipoLocal] = useState(null)
  const tipoVeh = tipoLocal || t?.vehiculos?.tipo_vehiculo || p.veh?.tipo_vehiculo || null
  const vehId = t?.vehiculo_id || p.vehiculo_id || null
  // v24: si el vehículo no tiene tipo definido, se solicita AQUÍ antes de
  // cotizar (queda guardado en la ficha del vehículo).
  async function definirTipo(tipo) {
    if (!tipo) return
    setTipoLocal(tipo)
    if (vehId) await supabase.from('vehiculos').update({ tipo_vehiculo: tipo }).eq('id', vehId)
  }

  const setItem = (i, campo, v) => { const n = items.map((x, j) => j === i ? { ...x, [campo]: v } : x); setItems(n) }
  // v21: el coordinador ingresa costo (alimenta la base interna, NO sale en
  // el presupuesto) y precio de venta por separado. El margen de repuestos
  // lo aplica el asesor; aquí no se calcula automático.
  const agregar = (tipo) => setItems([...items, { tipo, codigo: '', detalle: '', cant: 1, costo: 0, precio: 0, en_stock: null }])
  const totalItems = Math.round(items.reduce((s, x) => s + (x.en_stock ? 0 : (+x.precio || 0) * (+x.cant || 1)), 0))
  const porSeccion = Object.keys(SECCIONES_PRESUP).map((k) => ({
    k, titulo: SECCIONES_PRESUP[k],
    items: items.map((x, i) => ({ ...x, i })).filter((x) => seccionDe(x.tipo) === k)
  }))

  // Buscador de la base de precios: MO por tipo de vehículo, precios fijos
  // e insumos con precio establecido. Al elegir, inserta el ítem con su
  // precio y (para servicios) deja el rango eco/premium de repuestos como
  // referencia visible para el asesor.
  async function buscarBase(q, cat = fCat) {
    setBusca(q)
    if (q.trim().length < 2 && !cat) { setResultados([]); return }
    let query = supabase.from('precios_base')
      .select('tipo,categoria,codigo,nombre,tipo_vehiculo,valor_mo,rep_eco,rep_premium,insumos,precio,notas')
      .limit(60)
    if (q.trim().length >= 2) query = query.or(`nombre.ilike.%${q.trim()}%,codigo.ilike.%${q.trim()}%`)
    if (cat) query = query.eq('categoria', cat)   // v28: la categoría filtra los servicios
    const { data } = await query
    let filas = data || []
    // v28: el tipo de vehículo filtra servicios/precios con match flexible
    // (cubre combos como "PICK UP/VAN/FURGON"); las categorías siempre
    // están disponibles.
    if (tipoVeh) filas = filas.filter((x) => x.tipo !== 'servicio' || svcAplicaAVehiculo(x.tipo_vehiculo, tipoVeh))
    setResultados(filas.slice(0, 15))
  }
  function insertarDeBase(r) {
    const nuevos = []
    if (r.tipo === 'servicio') {
      nuevos.push({ tipo: 'mano_obra', codigo: r.codigo || '', detalle: r.nombre + (r.tipo_vehiculo ? ` (${r.tipo_vehiculo})` : ''), cant: 1, costo: 0, precio: +r.valor_mo || 0, en_stock: null })
      if (+r.insumos) nuevos.push({ tipo: 'insumo', codigo: 'IN', detalle: 'Insumos ' + r.nombre, cant: 1, costo: 0, precio: +r.insumos, en_stock: null })
      if (+r.rep_eco || +r.rep_premium) nuevos.push({ tipo: 'repuesto', codigo: r.codigo || '', detalle: 'Repuestos ' + r.nombre, cant: 1, costo: 0, precio: +r.rep_eco || 0, ref_eco: +r.rep_eco || null, ref_premium: +r.rep_premium || null, en_stock: null })
    } else if (r.tipo === 'insumo') {
      nuevos.push({ tipo: 'insumo', codigo: r.codigo || '', detalle: r.nombre, cant: 1, costo: 0, precio: +r.precio || 0, en_stock: null })
    } else {
      nuevos.push({ tipo: 'mano_obra', codigo: r.codigo || '', detalle: r.nombre, cant: 1, costo: 0, precio: +r.precio || 0, en_stock: null })
    }
    setItems([...items, ...nuevos]); setBusca(''); setResultados([])
  }

  async function guardarItems(estado) {
    const campos = { items: items.map((x) => ({ ...x, precio: Math.round(+x.precio || 0), costo: Math.round(+x.costo || 0) })), monto: Math.round(totalItems || +monto || 0) }
    let aviso = null
    // v33: los presupuestos sin solicitud / cotización rápida no tienen
    // trabajo de taller (t = null): se usa el vehículo/cliente del propio
    // presupuesto para el título y la notificación.
    const titulo = t ? tituloDe(t) : [p.veh?.patente, p.veh?.marca, p.veh?.modelo].filter(Boolean).join(' ') || 'Presupuesto'
    const asesorId = t?.asesor_id || p.vendedor_id || null
    if (estado) {
      campos.estado = estado
      if (estado === 'enviado') {
        campos.elaborado_por = perfil.id
        aviso = { usuario_id: asesorId, rol: asesorId ? null : 'vendedor', titulo: 'Presupuesto listo para entregar al cliente', cuerpo: titulo, url: p.cliente_id ? `/clientes/${p.cliente_id}` : '/taller', empresa_id: perfil.empresa_id }
      }
      if (estado === 'aprobado') { campos.resuelto_en = new Date().toISOString(); aviso = { rol: 'coordinador_adquisiciones', titulo: 'Presupuesto APROBADO · gestionar adquisición', cuerpo: titulo, url: '/taller', empresa_id: perfil.empresa_id } }
      if (estado === 'rechazado' || estado === 'parcial') { campos.resuelto_en = new Date().toISOString(); aviso = { rol: 'jefe_taller', titulo: `Presupuesto ${estado === 'parcial' ? 'RECHAZADO · entrega parcial' : 'RECHAZADO'}`, cuerpo: titulo, url: '/taller', empresa_id: perfil.empresa_id } }
    }
    await guardar(p, campos, aviso)
  }

  // v33: PDF (formato oficial DIDIAL) y envío por WhatsApp desde el módulo.
  const veh = t?.vehiculos || p.veh || null
  function verPDF() {
    const fmt = (n) => '$' + (Math.round(+n) || 0).toLocaleString('es-CL')
    const neto = Math.round(totalItems / 1.19), iva = Math.round(totalItems - totalItems / 1.19)
    const filas = items.filter((x) => !x.en_stock).map((x) =>
      `<tr><td>${(x.detalle || '').replace(/</g, '&lt;')}</td><td style="text-align:center">${x.cant || 1}</td><td style="text-align:right">${fmt((+x.precio || 0) * (+x.cant || 1))}</td></tr>`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Presupuesto</title>
      <style>body{font-family:Arial,sans-serif;color:#1a1c20;max-width:720px;margin:20px auto;padding:0 16px}
      table{width:100%;border-collapse:collapse;margin:12px 0}th,td{padding:7px 6px;border-bottom:1px solid #e2e8f0;font-size:13px}
      th{text-align:left;color:#6b7a8a;font-size:11px;text-transform:uppercase}
      .tot{text-align:right;font-size:14px;margin-top:4px}.tot b{font-size:18px}</style></head><body>
      <div style="text-align:center"><img src="${window.location.origin}/logo-didial.png" style="width:210px"><div style="font-size:10px;color:#6b7a8a;letter-spacing:1px">Cuidamos lo que te mueve</div></div>
      <h2 style="text-align:center;font-size:16px">PRESUPUESTO</h2>
      <div style="font-size:13px">${veh ? `<b>Vehículo:</b> ${[veh.marca, veh.modelo].filter(Boolean).join(' ')} · ${veh.patente || ''}<br>` : ''}<b>Fecha:</b> ${new Date().toLocaleDateString('es-CL')}</div>
      <table><thead><tr><th>Detalle</th><th style="text-align:center">Cant.</th><th style="text-align:right">Precio</th></tr></thead><tbody>${filas}</tbody></table>
      <div class="tot">NETO: ${fmt(neto)}</div><div class="tot">IVA (19%): ${fmt(iva)}</div><div class="tot"><b>TOTAL: ${fmt(totalItems)}</b></div>
      <p style="font-size:11px;color:#6b7a8a;text-align:center;margin-top:20px">Valores con IVA incluido · Presupuesto válido por 15 días · ¡Gracias por preferir DIDIAL!</p>
      <script>window.onload=()=>window.print()</script></body></html>`
    const w = window.open('', '_blank'); w.document.write(html); w.document.close()
  }
  function enviarWhatsApp() {
    const fmt = (n) => '$' + (Math.round(+n) || 0).toLocaleString('es-CL')
    const lineas = items.filter((x) => !x.en_stock).map((x) => `• ${x.detalle} (x${x.cant || 1}): ${fmt((+x.precio || 0) * (+x.cant || 1))}`).join('%0A')
    const msg = `*Presupuesto DIDIAL*%0A${veh ? [veh.marca, veh.modelo, veh.patente].filter(Boolean).join(' ') + '%0A' : ''}%0A${lineas}%0A%0A*Total: ${fmt(totalItems)}* (IVA incl.)%0A_Cuidamos lo que te mueve_`
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  const BOTON_SECCION = { repuesto: '+ Repuesto', insumo: '+ Lubricante / insumo', mano_obra: '+ Mano de obra', servicio_externo: '+ Servicio externo' }

  return (
    <div className="rounded-lg border border-slate-100">
      <button onClick={() => setAbierto(!abierto)} className="w-full flex items-center gap-2 px-3 py-2 text-sm">
        <Pill color={est.color}>{est.label}</Pill>
        <span className="text-slate-500 text-xs">{new Date(p.creado_en).toLocaleDateString('es-CL')}</span>
        {p.notas && <span className="text-xs text-slate-400 truncate flex-1 text-left">· {p.notas}</span>}
        <span className="ml-auto font-semibold text-ink">{fmtCLP(p.monto || 0)}</span>
        <span className="text-slate-300">{abierto ? '▾' : '▸'}</span>
      </button>
      {abierto && (
        <div className="px-3 pb-3 space-y-2 border-t pt-2">
          {puedeEditar && (
            <div className="relative">
              <div className="flex gap-1.5">
                <select className="input text-xs w-44 shrink-0" value={fCat}
                        onChange={(e) => { setFCat(e.target.value); buscarBase(busca, e.target.value) }}>
                  <option value="">Todas las categorías</option>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input className="input text-xs flex-1" value={busca} onChange={(e) => buscarBase(e.target.value)}
                       disabled={!tipoVeh && !!vehId}
                       placeholder={tipoVeh ? `🔎 Buscar${fCat ? ' en ' + fCat : ' en base de precios'} (MO · ${tipoVeh})…` : 'Define el tipo de vehículo para buscar en la base de precios…'} />
              </div>
              {!!resultados.length && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {resultados.map((r, i) => (
                    <button key={i} type="button" onClick={() => insertarDeBase(r)}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-mist/60 border-b border-slate-50">
                      <span className="font-mono text-slate-400 mr-1.5">{r.codigo}</span>
                      <span className="text-ink">{r.nombre}</span>
                      {r.tipo === 'servicio' && <span className="text-slate-400"> · {r.tipo_vehiculo} · MO {fmtCLP(r.valor_mo || 0)}{(+r.rep_eco || +r.rep_premium) ? ` · Rep ${fmtCLP(r.rep_eco || 0)}–${fmtCLP(r.rep_premium || 0)}` : ''}</span>}
                      {r.tipo !== 'servicio' && <span className="text-slate-400"> · {fmtCLP(r.precio || 0)}</span>}
                    </button>
                  ))}
                </div>
              )}
              {!tipoVeh && (
                <div className="flex items-center gap-2 mt-1 p-2 rounded-lg border border-didial-amber bg-amber-50">
                  <span className="text-[11px] text-slate-700">⚠ Define el <b>tipo de vehículo</b> para cotizar con los precios correctos:</span>
                  <select className="input text-xs w-auto py-1" defaultValue="" onChange={(e) => definirTipo(e.target.value)}>
                    <option value="" disabled>Seleccionar…</option>
                    {TIPOS_VEHICULO.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
          {porSeccion.filter((sec) => sec.items.length || puedeEditar).map((sec) => (
            <div key={sec.k}>
              <div className="text-[10px] font-semibold text-slate-400 uppercase mt-1">{sec.titulo}</div>
              {sec.items.map((x) => (
                <div key={x.i} className="flex items-center gap-1.5 text-xs mt-1">
                  <input className="input text-xs w-20" placeholder="Cód." value={x.codigo || ''} disabled={!puedeEditar}
                         onChange={(e) => setItem(x.i, 'codigo', e.target.value)} />
                  <input className="input text-xs flex-1" placeholder="Descripción…" value={x.detalle} disabled={!puedeEditar}
                         onChange={(e) => setItem(x.i, 'detalle', e.target.value)} />
                  <input className="input text-xs w-12" type="number" min="1" value={x.cant} disabled={!puedeEditar}
                         onChange={(e) => setItem(x.i, 'cant', e.target.value)} />
                  <input className="input text-xs w-20" type="number" min="0" placeholder="$ costo" title="Costo neto (proveedor) · alimenta la base interna, no aparece en el presupuesto" value={x.costo ?? ''} disabled={!puedeEditar || x.en_stock}
                         onChange={(e) => setItem(x.i, 'costo', e.target.value)} />
                  <input className="input text-xs w-24 bg-mist/60" type="number" min="0" placeholder="$ venta"
                         title={(x.ref_eco || x.ref_premium) ? `Precio venta · rango de referencia repuestos: ${fmtCLP(x.ref_eco || 0)} (económico) – ${fmtCLP(x.ref_premium || 0)} (premium)` : 'Precio de venta al cliente'}
                         value={x.precio} disabled={!puedeEditar || x.en_stock}
                         onChange={(e) => setItem(x.i, 'precio', e.target.value)} />
                  {seccionDe(x.tipo) === 'repuesto' && (
                    <button type="button" disabled={!puedeEditar} title="¿Hay stock en bodega?"
                            onClick={() => setItem(x.i, 'en_stock', !x.en_stock)}
                            className={`px-2 py-1 rounded border shrink-0 ${x.en_stock ? 'bg-green-50 border-green-300 text-green-600' : 'border-slate-200 text-slate-400'}`}>
                      {x.en_stock ? 'Stock ✓' : 'Sin stock'}
                    </button>
                  )}
                  {puedeEditar && <button onClick={() => setItems(items.filter((_, j) => j !== x.i))} className="text-slate-300 hover:text-red-500">✕</button>}
                </div>
              ))}
              {puedeEditar && (
                <button className="btn-soft text-[11px] mt-1" onClick={() => agregar(sec.k)}>{BOTON_SECCION[sec.k]}</button>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-500">Total a cotizar (sin stock): <b className="text-ink">{fmtCLP(totalItems)}</b></span>
            <div className="flex gap-1.5 flex-wrap">
              {items.some((x) => !x.en_stock) && <>
                <button className="btn-soft text-xs" onClick={verPDF}>📄 PDF</button>
                <button className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: '#1f9d57' }} onClick={enviarWhatsApp}>WhatsApp</button>
              </>}
              {puedeEditar && ['solicitado', 'cotizando'].includes(p.estado) && <>
                <button className="btn-soft text-xs" onClick={() => guardarItems('cotizando')}>Guardar cotización</button>
                <button className="btn-primary text-xs" onClick={() => guardarItems('enviado')}>Enviar al asesor</button>
              </>}
              {p.estado === 'enviado' && (
                <span className="text-[11px] text-slate-400 self-center">La decisión (aprobado / parcial / rechazado) la registra el asesor en la ficha del cliente durante la negociación.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


