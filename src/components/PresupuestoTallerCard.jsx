import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Pill } from './UI'
import { fmtCLP, ESTADOS_PRESUP_TALLER, SECCIONES_PRESUP, seccionDe } from '../lib/helpers'

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
  const tipoVeh = t?.vehiculos?.tipo_vehiculo || null

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
  async function buscarBase(q) {
    setBusca(q)
    if (q.trim().length < 2) { setResultados([]); return }
    const { data } = await supabase.from('precios_base')
      .select('tipo,categoria,codigo,nombre,tipo_vehiculo,valor_mo,rep_eco,rep_premium,insumos,precio,notas')
      .or(`nombre.ilike.%${q.trim()}%,codigo.ilike.%${q.trim()}%`)
      .limit(30)
    let filas = data || []
    // Servicios: prioriza el tipo de vehículo del trabajo; si no está
    // definido, muestra todas las variantes.
    if (tipoVeh) filas = filas.filter((x) => x.tipo !== 'servicio' || x.tipo_vehiculo === tipoVeh)
    setResultados(filas.slice(0, 12))
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
    if (estado) {
      campos.estado = estado
      if (estado === 'enviado') { campos.elaborado_por = perfil.id; aviso = { usuario_id: t.asesor_id, rol: t.asesor_id ? null : 'vendedor', titulo: 'Presupuesto listo para entregar al cliente', cuerpo: tituloDe(t), url: '/taller', empresa_id: perfil.empresa_id } }
      if (estado === 'aprobado') { campos.resuelto_en = new Date().toISOString(); aviso = { rol: 'coordinador_adquisiciones', titulo: 'Presupuesto APROBADO · gestionar adquisición', cuerpo: tituloDe(t), url: '/taller', empresa_id: perfil.empresa_id } }
      if (estado === 'rechazado' || estado === 'parcial') { campos.resuelto_en = new Date().toISOString(); aviso = { rol: 'jefe_taller', titulo: `Presupuesto ${estado === 'parcial' ? 'RECHAZADO · entrega parcial' : 'RECHAZADO'}`, cuerpo: tituloDe(t), url: '/taller', empresa_id: perfil.empresa_id } }
    }
    await guardar(p, campos, aviso)
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
              <input className="input text-xs" value={busca} onChange={(e) => buscarBase(e.target.value)}
                     placeholder={`🔎 Buscar en base de precios (MO${tipoVeh ? ' · ' + tipoVeh : ''}, precios fijos, insumos)…`} />
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
              {!tipoVeh && <p className="text-[10px] text-didial-amber mt-0.5">⚠ El vehículo no tiene definido su tipo (AUTO/SUV/…): se muestran todas las variantes de MO. Defínelo en la ficha del cliente.</p>}
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
              {puedeEditar && ['solicitado', 'cotizando'].includes(p.estado) && <>
                <button className="btn-soft text-xs" onClick={() => guardarItems('cotizando')}>Guardar cotización</button>
                <button className="btn-primary text-xs" onClick={() => guardarItems('enviado')}>Enviar al asesor</button>
              </>}
              {editable && (perfil?.rol === 'vendedor' || perfil?.rol === 'admin') && p.estado === 'enviado' && <>
                <button className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white" onClick={() => guardarItems('aprobado')}>Cliente aprueba</button>
                <button className="text-xs px-3 py-1.5 rounded-lg bg-didial-amber text-ink" onClick={() => guardarItems('parcial')}>Entrega parcial</button>
                <button className="text-xs px-3 py-1.5 rounded-lg bg-didial-red text-white" onClick={() => guardarItems('rechazado')}>Cliente rechaza</button>
              </>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


