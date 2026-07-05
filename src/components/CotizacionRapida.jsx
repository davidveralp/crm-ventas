import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './UI'
import { fmtCLP, formatPatente, nombreCompleto, desgloseIVA } from '../lib/helpers'

// v23 · COTIZACIÓN RÁPIDA del asesor (servicios planos con precio
// establecido, especialmente Toyota). Usa la base de precios según el tipo
// de vehículo, permite editar precios y agregar ítems libres, y genera un
// ticket imprimible (formato boleta 80mm). Se guarda como presupuesto
// (origen "rapida") para quedar en la ficha del cliente.
export default function CotizacionRapida({ cliente, vehiculo, perfil, onClose, onListo }) {
  const [items, setItems] = useState([])
  const [busca, setBusca] = useState('')
  const [res, setRes] = useState([])
  const [guardando, setGuardando] = useState(false)
  const total = Math.round(items.reduce((s, x) => s + (+x.precio || 0) * (+x.cant || 1), 0))
  const esToyota = (vehiculo?.marca || '').toUpperCase() === 'TOYOTA'
  const contacto = esToyota
    ? { email: 'serviciotoyota@didial.cl', fono: '+56 9 3740 1051' }
    : { email: 'serviciotecnico@didial.cl', fono: '+56 9 8974 8626' }

  async function buscar(q) {
    setBusca(q)
    if (q.trim().length < 2) { setRes([]); return }
    const { data } = await supabase.from('precios_base')
      .select('tipo,codigo,nombre,tipo_vehiculo,valor_mo,insumos,precio')
      .or(`nombre.ilike.%${q.trim()}%,codigo.ilike.%${q.trim()}%`)
      .limit(30)
    let filas = data || []
    if (vehiculo?.tipo_vehiculo) filas = filas.filter((x) => x.tipo !== 'servicio' || x.tipo_vehiculo === vehiculo.tipo_vehiculo)
    setRes(filas.slice(0, 10))
  }
  function agregarDeBase(r) {
    const precio = r.tipo === 'servicio' ? (+r.valor_mo || 0) + (+r.insumos || 0) : (+r.precio || 0)
    setItems([...items, { tipo: 'mano_obra', codigo: r.codigo || '', detalle: r.nombre + (r.tipo === 'servicio' && r.tipo_vehiculo ? ` (${r.tipo_vehiculo})` : ''), cant: 1, precio: Math.round(precio) }])
    setBusca(''); setRes([])
  }
  const setItem = (i, k, v) => setItems(items.map((x, j) => j === i ? { ...x, [k]: v } : x))

  async function guardar() {
    if (!items.length || guardando) return
    setGuardando(true)
    const { error } = await supabase.from('presupuestos_taller').insert({
      empresa_id: perfil.empresa_id, trabajo_id: null, origen: 'rapida',
      cliente_id: cliente.id, vehiculo_id: vehiculo?.id || null,
      estado: 'enviado', elaborado_por: perfil.id,
      items: items.map((x) => ({ ...x, precio: Math.round(+x.precio || 0), costo: 0, en_stock: null })),
      monto: total, notas: 'Cotización rápida del asesor'
    })
    setGuardando(false)
    if (error) return alert('Error: ' + error.message)
    onListo?.()
  }

  function imprimirTicket() {
    const fmt = (n) => (Number(n) || 0).toLocaleString('es-CL')
    const esc = (x) => String(x ?? '').replace(/</g, '&lt;')
    const d = desgloseIVA(total)
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Cotización</title>
    <style>
      body{font-family:'Courier New',monospace;font-size:12px;color:#111;width:280px;margin:10px auto}
      .c{text-align:center}.r{text-align:right}
      hr{border:none;border-top:1px dashed #111;margin:6px 0}
      table{width:100%;border-collapse:collapse}
      td{padding:1px 0;vertical-align:top}
      .tot{font-size:14px;font-weight:bold}
      img{width:170px;height:auto}
      @media print{body{margin:0 auto}}
    </style></head><body>
    <div class="c">
      <img src="${window.location.origin}/logo-didial.png" alt="DIDIAL">
      <div style="font-size:10px;letter-spacing:1px">Cuidamos lo que te mueve</div>
      <div style="font-size:10px">Avda. Cuatro Esquinas 759, La Serena<br>${contacto.email} · ${contacto.fono}</div>
    </div>
    <hr>
    <div><b>COTIZACIÓN</b> · ${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</div>
    <div>Cliente: ${esc(nombreCompleto(cliente))}</div>
    ${cliente.rut ? `<div>RUT: ${esc(cliente.rut)}</div>` : ''}
    ${vehiculo ? `<div>Vehículo: ${esc([vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' '))} · ${esc(formatPatente(vehiculo.patente || ''))}</div>` : ''}
    <div>Atendido por: ${esc(perfil?.nombre || '')}</div>
    <hr>
    <table>
      ${items.map((x) => `<tr><td>${esc(x.detalle)}${+x.cant > 1 ? ' x' + x.cant : ''}</td><td class="r">$${fmt((+x.precio || 0) * (+x.cant || 1))}</td></tr>`).join('')}
    </table>
    <hr>
    <table>
      <tr><td>NETO</td><td class="r">$${fmt(d.neto)}</td></tr>
      <tr><td>IVA (19%)</td><td class="r">$${fmt(d.iva)}</td></tr>
      <tr class="tot"><td>TOTAL</td><td class="r">$${fmt(d.total)}</td></tr>
    </table>
    <hr>
    <div class="c" style="font-size:10px">Cotización válida por 15 días.<br>Valores con IVA incluido.<br>¡Gracias por preferir DIDIAL!</div>
    <script>window.print()</script></body></html>`
    const w = window.open('', '_blank', 'width=340,height=640')
    w.document.write(html); w.document.close()
  }

  return (
    <Modal abierto onClose={onClose} ancho="max-w-lg"
           titulo={`Cotización rápida · ${vehiculo ? [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ') : nombreCompleto(cliente)}`}>
      <div className="space-y-3">
        <div className="relative">
          <input className="input text-sm" autoFocus value={busca} onChange={(e) => buscar(e.target.value)}
                 placeholder={`🔎 Buscar servicio en la base de precios${vehiculo?.tipo_vehiculo ? ' · ' + vehiculo.tipo_vehiculo : ''}…`} />
          {!!res.length && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
              {res.map((r, i) => (
                <button key={i} type="button" onClick={() => agregarDeBase(r)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-mist/60 border-b border-slate-50">
                  <span className="font-mono text-slate-400 mr-1.5">{r.codigo}</span>
                  <span className="text-ink">{r.nombre}</span>
                  <span className="text-slate-400"> · {fmtCLP(r.tipo === 'servicio' ? (+r.valor_mo || 0) + (+r.insumos || 0) : r.precio || 0)}</span>
                </button>
              ))}
            </div>
          )}
          {!vehiculo?.tipo_vehiculo && <p className="text-[10px] text-didial-amber mt-0.5">⚠ Define el tipo de vehículo en la ficha para filtrar los precios de MO correctos.</p>}
        </div>
        {items.map((x, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <input className="input text-xs flex-1" value={x.detalle} onChange={(e) => setItem(i, 'detalle', e.target.value)} placeholder="Descripción…" />
            <input className="input text-xs w-12" type="number" min="1" value={x.cant} onChange={(e) => setItem(i, 'cant', e.target.value)} />
            <input className="input text-xs w-24 text-right" type="number" min="0" value={x.precio} onChange={(e) => setItem(i, 'precio', e.target.value)} />
            <button className="text-slate-300 hover:text-red-500" onClick={() => setItems(items.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="btn-soft text-xs" onClick={() => setItems([...items, { tipo: 'mano_obra', codigo: '', detalle: '', cant: 1, precio: 0 }])}>+ Ítem libre</button>
        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <span className="font-bold text-ink">Total: {fmtCLP(total)} <span className="text-[10px] font-normal text-slate-400">IVA incluido</span></span>
          <div className="flex gap-2">
            <button className="btn-soft text-xs" disabled={!items.length} onClick={imprimirTicket}>🖨 Ticket</button>
            <button className="btn-primary text-xs" disabled={!items.length || guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar en la ficha'}</button>
          </div>
        </div>
        <p className="text-[10px] text-slate-400">La cotización queda en "Presupuestos del taller para conversar" (para PDF/WhatsApp) y visible en el módulo Presupuestos. Contacto del ticket: {contacto.email} · {contacto.fono}.</p>
      </div>
    </Modal>
  )
}
