import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatPatente, patenteLimpia } from '../lib/helpers'
import { imprimirInspeccion } from '../lib/inspeccionPDF'

// v77 · Inspección de ingreso — formulario de página única (antes 7 pasos).
// Paso previo a Nueva OT. Al terminar, crea
// el registro de inspección (fotos, firma, diagrama de daños marcado) y
// entrega los datos ya listos para prellenar el formulario de Nueva OT.

const SILUETAS = [
  { key: 'sedan', label: 'Sedán', tipoVehiculo: 'AUTO' },
  { key: 'camioneta', label: 'Camioneta', tipoVehiculo: 'PICK UP' },
  { key: 'moto', label: 'Moto', tipoVehiculo: 'AUTO' },
  { key: 'camion_europeo', label: 'Camión Europeo', tipoVehiculo: 'VAN/FURGON/CAMION' },
  { key: 'camion_americano', label: 'Camión Americano', tipoVehiculo: 'VAN/FURGON/CAMION' },
  { key: 'furgon', label: 'Furgón', tipoVehiculo: 'VAN/FURGON/CAMION' },
  { key: 'tractor', label: 'Tractor', tipoVehiculo: 'VAN/FURGON/CAMION' }
]

const LUCES = [
  { key: 'motor', label: 'Motor' }, { key: 'check_engine', label: 'Check engine' },
  { key: 'abs', label: 'ABS' }, { key: 'aceite', label: 'Aceite' },
  { key: 'bateria', label: 'Batería' }, { key: 'airbag', label: 'Airbag' },
  { key: 'freno_mano', label: 'Freno de mano' }, { key: 'luces_altas', label: 'Luces' },
  { key: 'neumatico', label: 'Neumático' }, { key: 'temperatura', label: 'Temperatura' }
]

const INVENTARIO = [
  'Gatos', 'Herramientas', 'Radios', 'Triángulos', 'Tapetes', 'Parabrisas',
  'Llantas refacción', 'Extintores', 'Botiquines', 'Antenas', 'Emblemas', 'Fundas de Asiento',
  'Tapones de Rueda', 'Cables', 'Pisos de Goma', 'Estéreos', 'Encendedores', 'Tapa Combustible'
]


export default function InspeccionIngreso({ perfil, onCompletada, onCancelar }) {
  const [guardando, setGuardando] = useState(false)

  // ---- sección 1: datos generales ----
  const [busca, setBusca] = useState('')
  const [veh, setVeh] = useState(null)
  const [d, setD] = useState({
    patente: '', km: '', fecha: new Date().toISOString().slice(0, 10), fecha_probable_entrega: '',
    ingreso_grua: false, trabajo_a_realizar: '', observaciones_cliente: '',
    nombre: '', apellidos: '', rut: '', telefono: ''
  })

  async function buscarVehiculo(q) {
    setBusca(q); setD({ ...d, patente: q })
    if (patenteLimpia(q).length < 5) { setVeh(null); return }
    const { data } = await supabase.from('vehiculos')
      .select('id,patente,marca,modelo,tipo_vehiculo,cliente_id,clientes(nombre,apellidos,telefono)')
      .ilike('patente_norm', `%${patenteLimpia(q)}%`).limit(1)
    setVeh(data?.[0] || null)
  }

  // ---- sección 2: luces + inventario ----
  const [luces, setLuces] = useState([])
  const [inventario, setInventario] = useState({})
  const toggleLuz = (k) => setLuces((l) => l.includes(k) ? l.filter((x) => x !== k) : [...l, k])
  const toggleInv = (k) => setInventario((i) => ({ ...i, [k]: !i[k] }))

  // ---- sección 3: combustible ----
  const [combustible, setCombustible] = useState(4) // 0(E) .. 8(F)

  // ---- sección 4: diagrama de daños ----
  const [silueta, setSilueta] = useState('sedan')
  const [danos, setDanos] = useState([])
  const imgRef = useRef(null)
  function marcarDano(e) {
    const rect = imgRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setDanos((ds) => [...ds, { numero: ds.length + 1, x, y, descripcion: '' }])
  }
  const setDescDano = (i, texto) => setDanos((ds) => ds.map((x, j) => j === i ? { ...x, descripcion: texto } : x))
  const quitarDano = (i) => setDanos((ds) => ds.filter((_, j) => j !== i).map((x, k) => ({ ...x, numero: k + 1 })))

  // ---- sección 5: fotos ----
  const [fotos, setFotos] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  async function subirFotos(files) {
    setSubiendo(true)
    const nuevas = []
    for (const file of files) {
      const path = `${perfil.empresa_id}/${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('inspecciones').upload(path, file)
      if (!error) {
        const { data } = supabase.storage.from('inspecciones').getPublicUrl(path)
        nuevas.push({ url: data.publicUrl, nombre: file.name })
      }
    }
    setFotos((f) => [...f, ...nuevas]); setSubiendo(false)
  }
  const quitarFoto = (i) => setFotos((f) => f.filter((_, j) => j !== i))

  // ---- sección 6: checklist + observaciones asesor ----
  const [checklist, setChecklist] = useState([])
  const [nuevoItem, setNuevoItem] = useState('')
  const [obsAsesor, setObsAsesor] = useState('')
  const agregarItem = () => { if (!nuevoItem.trim()) return; setChecklist((c) => [...c, { item: nuevoItem.trim(), estado: null }]); setNuevoItem('') }
  const marcarItem = (i, estado) => setChecklist((c) => c.map((x, j) => j === i ? { ...x, estado } : x))
  const quitarItem = (i) => setChecklist((c) => c.filter((_, j) => j !== i))

  // ---- sección 7: firma ----
  const canvasRef = useRef(null)
  const dibujando = useRef(false)
  function iniciarTrazo(e) {
    dibujando.current = true
    const ctx = canvasRef.current.getContext('2d')
    const r = canvasRef.current.getBoundingClientRect()
    ctx.beginPath(); ctx.moveTo((e.clientX ?? e.touches[0].clientX) - r.left, (e.clientY ?? e.touches[0].clientY) - r.top)
  }
  function trazar(e) {
    if (!dibujando.current) return
    const ctx = canvasRef.current.getContext('2d')
    const r = canvasRef.current.getBoundingClientRect()
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1c20'
    ctx.lineTo((e.clientX ?? e.touches[0].clientX) - r.left, (e.clientY ?? e.touches[0].clientY) - r.top); ctx.stroke()
  }
  const soltarTrazo = () => { dibujando.current = false }
  const limpiarFirma = () => canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

  /** Arma el objeto que consume el generador del documento. */
  function datosDoc(extra = {}) {
    const cli = veh?.clientes
    return {
      fecha: d.fecha,
      patente: veh?.patente ? formatPatente(veh.patente) : formatPatente(d.patente),
      marca: veh?.marca || '', modelo: veh?.modelo || '',
      anio: veh?.anio || '', color: veh?.color || '', chasis: veh?.chasis || '',
      km: d.km,
      cliente: cli ? [cli.nombre, cli.apellidos].filter(Boolean).join(' ') : [d.nombre, d.apellidos].filter(Boolean).join(' '),
      rut: cli?.rut || d.rut, direccion: cli?.direccion || '', email: cli?.email || '',
      telefono: cli?.telefono || d.telefono,
      trabajo: d.trabajo_a_realizar, observacionesCliente: d.observaciones_cliente,
      observacionesAsesor: obsAsesor,
      luces, inventario, combustible, danos, checklist, fotos,
      asesor: perfil?.nombre || '',
      ...extra
    }
  }

  /** Abre el documento sin guardar, para revisarlo antes de registrar. */
  function vistaPrevia() { imprimirInspeccion(datosDoc()) }

  async function registrar() {
    setGuardando(true)
    let clienteId = veh?.cliente_id || null, vehiculoId = veh?.id || null

    // firma → storage
    let firmaUrl = null
    const firmaBlob = await new Promise((res) => canvasRef.current.toBlob(res, 'image/png'))
    if (firmaBlob) {
      const path = `${perfil.empresa_id}/firma_${Date.now()}.png`
      const { error } = await supabase.storage.from('inspecciones').upload(path, firmaBlob)
      if (!error) firmaUrl = supabase.storage.from('inspecciones').getPublicUrl(path).data.publicUrl
    }

    const { data: insp, error } = await supabase.from('inspecciones_ingreso').insert({
      empresa_id: perfil.empresa_id, cliente_id: clienteId, vehiculo_id: vehiculoId,
      km: parseInt(d.km, 10) || null, fecha: d.fecha, fecha_probable_entrega: d.fecha_probable_entrega || null,
      ingreso_grua: d.ingreso_grua, trabajo_a_realizar: d.trabajo_a_realizar.trim(),
      observaciones_cliente: d.observaciones_cliente.trim(), observaciones_asesor: obsAsesor.trim(),
      luces_advertencia: luces, inventario, nivel_combustible: combustible,
      tipo_silueta: silueta, danos, checklist, fotos, firma_url: firmaUrl,
      estado: 'completada', creado_por: perfil.id
    }).select().single()

    setGuardando(false)
    if (error) return alert('Error al registrar la inspección: ' + error.message)

    // Documento oficial, ya con la firma subida a Storage
    imprimirInspeccion(datosDoc({ numero: insp.id.slice(0, 8).toUpperCase(), firmaUrl }))

    const siluetaInfo = SILUETAS.find((s) => s.key === silueta)
    onCompletada({
      inspeccion_id: insp.id,
      patente: veh?.patente || formatPatente(d.patente),
      marca: veh?.marca || '', modelo: veh?.modelo || '',
      tipo_vehiculo: veh?.tipo_vehiculo || siluetaInfo?.tipoVehiculo || '',
      km: d.km, propietario: d.nombre, apellidos: d.apellidos, rut: d.rut, telefono: d.telefono,
      tipo_cliente_nombre: veh?.clientes ? [veh.clientes.nombre, veh.clientes.apellidos].filter(Boolean).join(' ') : '',
      trabajo_a_realizar: d.trabajo_a_realizar, observaciones_cliente: d.observaciones_cliente
    })
  }

  const puedeAvanzar = paso !== 0 || (d.patente.trim().length >= 5 && d.km)

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl h-[94vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-ink">Inspección de ingreso</h2>
            <p className="text-xs text-slate-400">Formulario completo · desplázate hacia abajo</p>
          </div>
          <button type="button" onClick={onCancelar} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* ---- PASO 0: DATOS ---- */}
          {/* sección 1 */}
          <h3 className="text-sm font-bold text-ink border-b border-slate-200 pb-1 pt-2"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-deep text-white text-[10px] mr-2">1</span>Datos del vehículo y cliente</h3>
          {true && (
            <div className="space-y-3">
              <div>
                <label className="label">Patente *</label>
                <input className="input" autoFocus value={busca} onChange={(e) => buscarVehiculo(e.target.value)} placeholder="Ej: GH TY 34" />
                {veh && <p className="text-xs text-green-600 mt-1">✓ {veh.marca} {veh.modelo} · {[veh.clientes?.nombre, veh.clientes?.apellidos].filter(Boolean).join(' ')}</p>}
                {!veh && patenteLimpia(busca).length >= 5 && <p className="text-xs text-slate-400 mt-1">Patente nueva — completa los datos del cliente más abajo.</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Kilometraje *</label><input className="input" type="number" value={d.km} onChange={(e) => setD({ ...d, km: e.target.value })} /></div>
                <div><label className="label">Fecha</label><input className="input" type="date" value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} /></div>
              </div>
              <div>
                <label className="label">Fecha probable de entrega</label>
                <input className="input" type="date" value={d.fecha_probable_entrega} onChange={(e) => setD({ ...d, fecha_probable_entrega: e.target.value })} />
              </div>
              {!veh && (
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-paper p-3">
                  <input className="input" placeholder="Nombre(s)" value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} />
                  <input className="input" placeholder="Apellidos" value={d.apellidos} onChange={(e) => setD({ ...d, apellidos: e.target.value })} />
                  <input className="input" placeholder="RUT" value={d.rut} onChange={(e) => setD({ ...d, rut: e.target.value })} />
                  <input className="input" placeholder="Teléfono" value={d.telefono} onChange={(e) => setD({ ...d, telefono: e.target.value })} />
                </div>
              )}
              <div>
                <label className="label">Ingreso en grúa</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setD({ ...d, ingreso_grua: true })} className={`px-4 py-1.5 rounded-lg border text-sm ${d.ingreso_grua ? 'bg-deep text-white border-deep' : 'border-slate-200'}`}>Sí</button>
                  <button type="button" onClick={() => setD({ ...d, ingreso_grua: false })} className={`px-4 py-1.5 rounded-lg border text-sm ${!d.ingreso_grua ? 'bg-deep text-white border-deep' : 'border-slate-200'}`}>No</button>
                </div>
              </div>
              <div><label className="label">Trabajo a realizar</label><textarea className="input" rows="2" value={d.trabajo_a_realizar} onChange={(e) => setD({ ...d, trabajo_a_realizar: e.target.value })} /></div>
              <div><label className="label">Observaciones del cliente</label><textarea className="input" rows="2" value={d.observaciones_cliente} onChange={(e) => setD({ ...d, observaciones_cliente: e.target.value })} /></div>
            </div>
          )}

          {/* ---- PASO 1: LUCES + INVENTARIO ---- */}
          {/* sección 2 */}
          <h3 className="text-sm font-bold text-ink border-b border-slate-200 pb-1 pt-2"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-deep text-white text-[10px] mr-2">2</span>Luces de advertencia e inventario</h3>
          {true && (
            <div className="space-y-4">
              <div>
                <label className="label mb-2">Luces de advertencia encendidas</label>
                <div className="grid grid-cols-4 gap-2">
                  {LUCES.map((l) => (
                    <button key={l.key} type="button" onClick={() => toggleLuz(l.key)}
                            className={`text-xs px-2 py-2 rounded-lg border ${luces.includes(l.key) ? 'bg-didial-red text-white border-didial-red' : 'border-slate-200 text-slate-600'}`}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label mb-2">Inventario presente</label>
                <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
                  {INVENTARIO.map((it) => (
                    <label key={it} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={!!inventario[it]} onChange={() => toggleInv(it)} />
                      {it}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ---- PASO 2: COMBUSTIBLE ---- */}
          {/* sección 3 */}
          <h3 className="text-sm font-bold text-ink border-b border-slate-200 pb-1 pt-2"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-deep text-white text-[10px] mr-2">3</span>Combustible</h3>
          {true && (
            <div>
              <label className="label mb-3">Nivel de combustible</label>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-didial-red">E</span>
                <input type="range" min="0" max="8" step="1" value={combustible}
                       onChange={(e) => setCombustible(+e.target.value)} className="flex-1" />
                <span className="text-lg font-bold text-ink">F</span>
              </div>
              <p className="text-center text-sm text-slate-500 mt-2">{combustible}/8</p>
            </div>
          )}

          {/* ---- PASO 3: DAÑOS ---- */}
          {/* sección 4 */}
          <h3 className="text-sm font-bold text-ink border-b border-slate-200 pb-1 pt-2"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-deep text-white text-[10px] mr-2">4</span>Daños al ingreso</h3>
          {true && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {SILUETAS.map((s) => (
                  <button key={s.key} type="button" onClick={() => { setSilueta(s.key); setDanos([]) }}
                          className={`text-xs px-2.5 py-1.5 rounded-lg border ${silueta === s.key ? 'bg-deep text-white border-deep' : 'border-slate-200 text-slate-600'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="relative border border-slate-200 rounded-lg overflow-hidden cursor-crosshair" onClick={marcarDano}>
                <img ref={imgRef} src={`/siluetas/${silueta}.png`} alt={silueta} className="w-full select-none pointer-events-none" draggable={false} />
                {danos.map((dn, i) => (
                  <div key={i} className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full bg-didial-red text-white text-[11px] font-bold flex items-center justify-center"
                       style={{ left: `${dn.x}%`, top: `${dn.y}%` }}>{dn.numero}</div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">Toca la imagen para marcar un daño (puede ser en cualquiera de las vistas).</p>
              {!!danos.length && (
                <div className="space-y-1.5">
                  {danos.map((dn, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full bg-didial-red text-white text-[11px] font-bold flex items-center justify-center shrink-0">{dn.numero}</span>
                      <input className="input text-sm flex-1" placeholder="Descripción del daño…" value={dn.descripcion} onChange={(e) => setDescDano(i, e.target.value)} />
                      <button type="button" className="text-slate-300 hover:text-red-500" onClick={() => quitarDano(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---- PASO 4: FOTOS ---- */}
          {/* sección 5 */}
          <h3 className="text-sm font-bold text-ink border-b border-slate-200 pb-1 pt-2"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-deep text-white text-[10px] mr-2">5</span>Fotografías</h3>
          {true && (
            <div className="space-y-3">
              <label className="btn-soft inline-block cursor-pointer">
                {subiendo ? 'Subiendo…' : '📎 Cargar fotos'}
                <input type="file" accept="image/*" multiple className="hidden" disabled={subiendo}
                       onChange={(e) => e.target.files.length && subirFotos([...e.target.files])} />
              </label>
              <div className="grid grid-cols-3 gap-2">
                {fotos.map((f, i) => (
                  <div key={i} className="relative">
                    <img src={f.url} alt={f.nombre} className="w-full h-24 object-cover rounded-lg border border-slate-100" />
                    <button type="button" onClick={() => quitarFoto(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs">✕</button>
                  </div>
                ))}
              </div>
              {!fotos.length && <p className="text-xs text-slate-400">Sin fotos cargadas todavía.</p>}
            </div>
          )}

          {/* ---- PASO 5: CHECKLIST + OBS ASESOR ---- */}
          {/* sección 6 */}
          <h3 className="text-sm font-bold text-ink border-b border-slate-200 pb-1 pt-2"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-deep text-white text-[10px] mr-2">6</span>Checklist</h3>
          {true && (
            <div className="space-y-3">
              <label className="label">Items checklist</label>
              <div className="flex gap-1.5">
                <input className="input text-sm flex-1" value={nuevoItem} placeholder="Ej: Estado de frenos…"
                       onChange={(e) => setNuevoItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && agregarItem()} />
                <button type="button" className="btn-soft text-xs" onClick={agregarItem}>+ Agregar</button>
              </div>
              {!checklist.length && <p className="text-xs text-slate-400">No hay items creados.</p>}
              <div className="space-y-1">
                {checklist.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm rounded border border-slate-100 px-2 py-1.5">
                    <span className="flex-1">{c.item}</span>
                    <button type="button" onClick={() => marcarItem(i, 'x')} className={`w-7 h-7 rounded text-xs font-bold ${c.estado === 'x' ? 'bg-didial-red text-white' : 'bg-red-50 text-red-400'}`}>✕</button>
                    <button type="button" onClick={() => marcarItem(i, 'na')} className={`w-7 h-7 rounded text-xs font-bold ${c.estado === 'na' ? 'bg-didial-amber text-white' : 'bg-amber-50 text-amber-400'}`}>—</button>
                    <button type="button" onClick={() => marcarItem(i, 'ok')} className={`w-7 h-7 rounded text-xs font-bold ${c.estado === 'ok' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-500'}`}>✓</button>
                    <button type="button" className="text-slate-300 hover:text-red-500 text-xs" onClick={() => quitarItem(i)}>🗑</button>
                  </div>
                ))}
              </div>
              <div><label className="label">Observaciones del asesor</label><textarea className="input" rows="2" value={obsAsesor} onChange={(e) => setObsAsesor(e.target.value)} /></div>
            </div>
          )}

          {/* ---- PASO 6: FIRMA ---- */}
          {/* sección 7 */}
          <h3 className="text-sm font-bold text-ink border-b border-slate-200 pb-1 pt-2"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-deep text-white text-[10px] mr-2">7</span>Firma del cliente</h3>
          {true && (
            <div className="space-y-3">
              <label className="label">Firma del cliente</label>
              <canvas ref={canvasRef} width={560} height={220}
                      className="w-full border border-slate-200 rounded-lg touch-none"
                      onMouseDown={iniciarTrazo} onMouseMove={trazar} onMouseUp={soltarTrazo} onMouseLeave={soltarTrazo}
                      onTouchStart={iniciarTrazo} onTouchMove={trazar} onTouchEnd={soltarTrazo} />
              <button type="button" className="btn-soft text-xs" onClick={limpiarFirma}>Limpiar</button>
              <p className="text-[11px] text-slate-400">Firma simple en pantalla — no reemplaza una firma electrónica certificada.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 gap-3 flex-wrap">
          <button type="button" className="btn-soft" onClick={onCancelar}>Cancelar</button>
          <div className="flex items-center gap-2 flex-wrap">
            {!puedeAvanzar && <span className="text-xs text-slate-400">Falta patente y kilometraje</span>}
            <button type="button" className="btn-soft" onClick={vistaPrevia}>Vista previa</button>
            <button type="button" className="btn-primary" disabled={!puedeAvanzar || guardando} onClick={registrar}>
              {guardando ? 'Registrando…' : '✓ Registrar e imprimir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
