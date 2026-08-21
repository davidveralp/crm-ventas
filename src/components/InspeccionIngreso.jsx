import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatPatente, patenteLimpia, formatRut, fmtFonoOT, TRACCIONES, TRANSMISIONES, TRANSMISION_LABEL } from '../lib/helpers'
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
  { key: 'furgon', label: 'Furgón', tipoVehiculo: 'VAN/FURGON/CAMION' }
]

/* Testigos del tablero. El color es el que usa la norma en un tablero real:
   rojo = detener el vehículo, ámbar = revisar pronto, verde/azul = en uso.
   Al marcar un testigo, el icono toma su color, igual que se encendería. */
const LUCES = [
  { key: 'check_engine', label: 'Check engine', color: '#e0a020', icono: 'motor' },
  { key: 'motor', label: 'Falla motor', color: '#e0382b', icono: 'motor' },
  { key: 'aceite', label: 'Aceite', color: '#e0382b', icono: 'aceite' },
  { key: 'temperatura', label: 'Temperatura', color: '#e0382b', icono: 'temp' },
  { key: 'bateria', label: 'Batería', color: '#e0382b', icono: 'bateria' },
  { key: 'freno_mano', label: 'Freno', color: '#e0382b', icono: 'freno' },
  { key: 'airbag', label: 'Airbag', color: '#e0382b', icono: 'airbag' },
  { key: 'abs', label: 'ABS', color: '#e0a020', icono: 'abs' },
  { key: 'neumatico', label: 'Presión neumáticos', color: '#e0a020', icono: 'neumatico' },
  { key: 'luces_altas', label: 'Luces altas', color: '#2f6fb0', icono: 'luces' }
]

/* Testigos dibujados siguiendo las formas estándar del tablero (referencia:
   iconografía ISO 2575 que usan todos los fabricantes). Van como SVG y no como
   imágenes para que tomen el color al encenderse y no pesen en la carga.
   `fill="currentColor"` en las siluetas macizas, trazo en el resto. */
const ICONO_LUZ = {
  // Bloque motor visto de perfil, con sus aletas
  motor: (
    <g fill="currentColor" stroke="none">
      <path d="M6.5 9.5h1.2V8h2.1v1.5h2.4l1.9-1.9h1.6v1.9h1.8v1.5h1.6v3.4h-1.6v1.6h-4.1l-1.9-1.9H9.8v1.9H7.7v-1.9H6.5v-1.7H4.8v-2.9h1.7z"/>
    </g>
  ),
  // Aceitera con gota
  aceite: (
    <g fill="currentColor" stroke="none">
      <path d="M4.2 13.6c2.6-.9 4.4-3 8.1-3 1.5 0 2.7.3 3.7.9l3.4-1.4v1.4l-2.5 1.3c.5.6.8 1.3.9 2.1H8.6c-.2-1-.9-1.7-1.9-1.9-.9-.2-1.9.1-2.5.6z"/>
      <path d="M17.4 6.2c0 .8-.6 1.4-1.4 1.4s-1.4-.6-1.4-1.4c0-.9 1.4-2.6 1.4-2.6s1.4 1.7 1.4 2.6z"/>
    </g>
  ),
  // Termómetro sobre olas de refrigerante
  temp: (
    <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M12 4.5v7.2"/><circle cx="12" cy="13.6" r="2.4" fill="currentColor" stroke="none"/>
      <path d="M12 4.5a1.6 1.6 0 011.6 1.6v5.9a2.4 2.4 0 11-3.2 0V6.1A1.6 1.6 0 0112 4.5z"/>
      <path d="M9.6 6.6h-1.4M9.6 8.8h-1.4M9.6 11h-1.4"/>
      <path d="M3 18.4c1-.9 2-.9 3 0s2 .9 3 0 2-.9 3 0 2 .9 3 0 2-.9 3 0"/>
    </g>
  ),
  // Batería con bornes + y −
  bateria: (
    <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <rect x="2.8" y="7.6" width="18.4" height="9.6" rx="1.2"/>
      <path d="M7 7.6V5.8h3v1.8M14 7.6V5.8h3v1.8"/>
      <path d="M6.4 12.4h3.2M8 10.8v3.2M14.4 12.4h3.2"/>
    </g>
  ),
  // Freno: círculo con paréntesis laterales y signo de exclamación
  freno: (
    <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="12" cy="12" r="5.4"/>
      <path d="M4.4 8.2a8 8 0 000 7.6M19.6 8.2a8 8 0 010 7.6"/>
      <path d="M12 9.2v3.4"/><circle cx="12" cy="14.9" r=".9" fill="currentColor" stroke="none"/>
    </g>
  ),
  // Ocupante con cinturón y bolsa de aire desplegada
  airbag: (
    <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.6" cy="7.4" r="2.2" fill="currentColor" stroke="none"/>
      <path d="M4.6 18.4v-3.2c0-1.6 1.1-2.8 2.7-3l3.2-.5"/>
      <path d="M10.5 18.4H5"/>
      <circle cx="16.6" cy="13.4" r="4.2"/>
      <path d="M13.4 8.6l1.6 1.6M19.8 8.6l-1.6 1.6M16.6 7v2.2"/>
    </g>
  ),
  // ABS: círculo con las letras y paréntesis
  abs: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="5.6"/>
      <path d="M4.2 8.2a8 8 0 000 7.6M19.8 8.2a8 8 0 010 7.6" strokeLinecap="round"/>
      <text x="12" y="14.3" fontSize="5.4" fontWeight="700" textAnchor="middle"
            fill="currentColor" stroke="none">ABS</text>
    </g>
  ),
  // Neumático en corte con signo de exclamación (presión)
  neumatico: (
    <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M5.4 16.4V10c0-2.6 2.9-4.6 6.6-4.6s6.6 2 6.6 4.6v6.4"/>
      <path d="M4 18.6h16"/>
      <path d="M5.4 16.4l-1.2 2.2M18.6 16.4l1.2 2.2"/>
      <path d="M12 8.8v3.2"/><circle cx="12" cy="14.3" r=".9" fill="currentColor" stroke="none"/>
    </g>
  ),
  // Luz alta: haz recto de líneas paralelas
  luces: (
    <g fill="currentColor" stroke="none">
      <path d="M9.4 6.6c2.9 0 5.2 2.4 5.2 5.4s-2.3 5.4-5.2 5.4H7.6V6.6z"/>
      <rect x="2" y="7.4" width="4.2" height="1.5" rx=".7"/>
      <rect x="2" y="11.2" width="4.2" height="1.5" rx=".7"/>
      <rect x="2" y="15" width="4.2" height="1.5" rx=".7"/>
      <rect x="16.4" y="7.4" width="5.6" height="1.5" rx=".7"/>
      <rect x="16.4" y="11.2" width="5.6" height="1.5" rx=".7"/>
      <rect x="16.4" y="15" width="5.6" height="1.5" rx=".7"/>
    </g>
  )
}

const INVENTARIO = [
  'Gatos', 'Herramientas', 'Radios', 'Triángulos', 'Tapetes', 'Parabrisas',
  'Llantas refacción', 'Extintores', 'Botiquines', 'Antenas', 'Emblemas', 'Fundas de Asiento',
  'Tapones de Rueda', 'Cables', 'Pisos de Goma', 'Estéreos', 'Encendedores', 'Tapa Combustible'
]


export default function InspeccionIngreso({ perfil, onCompletada, onCancelar, comoPagina = false }) {
  const [guardando, setGuardando] = useState(false)

  // ---- sección 1: datos generales ----
  const [busca, setBusca] = useState('')
  const [veh, setVeh] = useState(null)
  const [d, setD] = useState({
    patente: '', km: '', fecha: new Date().toISOString().slice(0, 10), fecha_probable_entrega: '',
    ingreso_grua: false, trabajo_a_realizar: '', observaciones_cliente: '',
    nombre: '', apellidos: '', rut: '', telefono: '', email: '', direccion: '', ciudad: '',
    marca: '', modelo: '', version: '', anio: '', color: '', chasis: '', cilindrada: '', traccion: '', transmision: ''
  })

  async function buscarVehiculo(entrada) {
    // Mismo formato que Nueva OT: se normaliza mientras se escribe, así el
    // usuario no tiene que acordarse de los espacios ni de las mayúsculas.
    const q = formatPatente(entrada)
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

    // Si la patente es nueva, se crean la ficha de cliente y la de vehículo.
    // Antes esto no ocurría: la inspección quedaba sin cliente ni vehículo.
    try {
      if (!clienteId && (d.nombre.trim() || d.apellidos.trim() || d.rut.trim())) {
        const { data: cli, error: eCli } = await supabase.from('clientes').insert({
          empresa_id: perfil.empresa_id,
          nombre: d.nombre.trim() || '(sin nombre)', apellidos: d.apellidos.trim() || null,
          rut: d.rut.trim() || null, telefono: d.telefono.trim() || null,
          email: d.email?.trim() || null, direccion: d.direccion?.trim() || null,
          ciudad: d.ciudad?.trim() || null,
          vendedor_id: perfil.id, estado: 'nuevo'
        }).select('id').single()
        if (eCli) throw new Error('No se pudo crear el cliente: ' + eCli.message)
        clienteId = cli.id
      }

      if (!vehiculoId && patenteLimpia(d.patente).length >= 5) {
        const siluetaTipo = SILUETAS.find((x) => x.key === silueta)?.tipoVehiculo || null
        const { data: vh, error: eVeh } = await supabase.from('vehiculos').insert({
          empresa_id: perfil.empresa_id, cliente_id: clienteId,
          patente: formatPatente(d.patente),
          marca: d.marca?.trim() || null, modelo: d.modelo?.trim() || null,
          version: d.version?.trim() || null, anio: parseInt(d.anio, 10) || null,
          color: d.color?.trim() || null, chasis: d.chasis?.trim() || null,
          cilindrada: d.cilindrada?.trim() || null,
          traccion: d.traccion || null, transmision: d.transmision || null,
          tipo_vehiculo: siluetaTipo,
          km_ultimo: parseInt(d.km, 10) || null, km_actual_estimado: parseInt(d.km, 10) || null
        }).select('id').single()
        if (eVeh) throw new Error('No se pudo crear el vehículo: ' + eVeh.message)
        vehiculoId = vh.id
      }
    } catch (e) {
      setGuardando(false)
      return alert(e.message)
    }

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

    if (error) { setGuardando(false); return alert('Error al registrar la inspección: ' + error.message) }

    // ---- Trabajo de taller ----
    // Antes la inspección no lo creaba, así que el vehículo aparecía en ClickUp
    // sin datos y quedaba "por designar". Ahora nace aquí, con el vehículo, el
    // cliente y lo que pidió el cliente, para que llegue identificado.
    let trabajoId = null
    if (vehiculoId) {
      const titulo = [
        veh?.patente || formatPatente(d.patente),
        veh?.marca || d.marca, veh?.modelo || d.modelo
      ].filter(Boolean).join(' ').trim()
      const { data: tj, error: eTj } = await supabase.from('trabajos_taller').insert({
        empresa_id: perfil.empresa_id,
        vehiculo_id: vehiculoId, cliente_id: clienteId,
        titulo: titulo || 'Ingreso de vehículo',
        servicio_solicitado: d.trabajo_a_realizar.trim() || null,
        observaciones_cliente: d.observaciones_cliente.trim() || null,
        // Nace por designar a propósito: el jefe de taller decide el técnico.
        // La diferencia con antes es que ahora llega con toda la información.
        estado: 'por_designar', prioridad: 'normal',
        km_ingreso: parseInt(d.km, 10) || null,
        inspeccion_id: insp.id
      }).select('id').maybeSingle()
      if (eTj) console.error('No se pudo crear el trabajo de taller:', eTj.message)
      else trabajoId = tj?.id || null
    }

    setGuardando(false)

    // Documento oficial, ya con la firma subida a Storage
    imprimirInspeccion(datosDoc({ numero: insp.id.slice(0, 8).toUpperCase(), firmaUrl }))

    const siluetaInfo = SILUETAS.find((s) => s.key === silueta)
    onCompletada({
      inspeccion_id: insp.id,
      trabajo_id: trabajoId,
      vehiculo_id: vehiculoId,
      cliente_id: clienteId,
      patente: veh?.patente || formatPatente(d.patente),
      marca: veh?.marca || '', modelo: veh?.modelo || '',
      tipo_vehiculo: veh?.tipo_vehiculo || siluetaInfo?.tipoVehiculo || '',
      km: d.km, propietario: d.nombre, apellidos: d.apellidos, rut: d.rut, telefono: d.telefono,
      tipo_cliente_nombre: veh?.clientes ? [veh.clientes.nombre, veh.clientes.apellidos].filter(Boolean).join(' ') : '',
      trabajo_a_realizar: d.trabajo_a_realizar, observaciones_cliente: d.observaciones_cliente
    })
  }

  // v79 fix: antes decía `paso !== 0 || (...)`, pero `paso` se eliminó en v77
  // al pasar a formulario de página única. Quedaba un ReferenceError que dejaba
  // la pantalla en blanco. La condición real es que haya patente y kilometraje.
  const puedeAvanzar = d.patente.trim().length >= 5 && !!d.km

  return (
    <div className={comoPagina
      ? ''
      : 'fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4'}>
      <div className={comoPagina
        ? 'bg-white rounded-xl flex flex-col'
        : 'bg-white sm:rounded-xl w-full max-w-3xl h-[100dvh] sm:h-[94vh] flex flex-col'}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-ink">Inspección de ingreso</h2>
            <p className="text-xs text-slate-400">Formulario completo · desplázate hacia abajo</p>
          </div>
          <button type="button" onClick={onCancelar} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className={comoPagina ? "px-5 py-4 space-y-4" : "flex-1 overflow-y-auto px-5 py-4 space-y-4"}>
          {/* ---- PASO 0: DATOS ---- */}
          {/* sección 1 */}
          <h3 className="text-sm font-bold text-ink border-b border-slate-200 pb-1 pt-2"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-deep text-white text-[10px] mr-2">1</span>Datos del vehículo y cliente</h3>
          {true && (
            <div className="space-y-3">
              <div>
                <label className="label">Patente *</label>
                <input className="input uppercase" autoFocus value={busca} maxLength={10}
                       onChange={(e) => buscarVehiculo(e.target.value)} placeholder="Ej: GH TY 34" />
                {veh && <p className="text-xs text-green-600 mt-1">✓ {veh.marca} {veh.modelo} · {[veh.clientes?.nombre, veh.clientes?.apellidos].filter(Boolean).join(' ')}</p>}
                {!veh && patenteLimpia(busca).length >= 5 && <p className="text-xs text-slate-400 mt-1">Patente nueva — completa los datos del cliente más abajo.</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="label">Kilometraje *</label><input className="input" type="number" value={d.km} onChange={(e) => setD({ ...d, km: e.target.value })} /></div>
                <div><label className="label">Fecha</label><input className="input" type="date" value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} /></div>
              </div>
              <div>
                <label className="label">Fecha probable de entrega</label>
                <input className="input" type="date" value={d.fecha_probable_entrega} onChange={(e) => setD({ ...d, fecha_probable_entrega: e.target.value })} />
              </div>
              {!veh && (
                <>
                  <div className="rounded-lg bg-paper p-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Datos del cliente</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input className="input" placeholder="Nombre(s)" value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} />
                      <input className="input" placeholder="Apellidos" value={d.apellidos} onChange={(e) => setD({ ...d, apellidos: e.target.value })} />
                      <input className="input" placeholder="12.345.678-9" value={d.rut}
                             onChange={(e) => setD({ ...d, rut: e.target.value })}
                             onBlur={(e) => setD({ ...d, rut: formatRut(e.target.value) })} />
                      <input className="input" placeholder="+56 9 1234 5678" inputMode="tel" value={d.telefono}
                             onChange={(e) => setD({ ...d, telefono: e.target.value })}
                             onBlur={(e) => setD({ ...d, telefono: fmtFonoOT(e.target.value) })} />
                      <input className="input" placeholder="Correo" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />
                      <input className="input" placeholder="Ciudad" value={d.ciudad} onChange={(e) => setD({ ...d, ciudad: e.target.value })} />
                      <input className="input sm:col-span-2" placeholder="Dirección" value={d.direccion} onChange={(e) => setD({ ...d, direccion: e.target.value })} />
                    </div>
                  </div>
                  <div className="rounded-lg bg-paper p-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Datos del vehículo</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input className="input" placeholder="Marca" value={d.marca} onChange={(e) => setD({ ...d, marca: e.target.value.toUpperCase() })} />
                      <input className="input" placeholder="Modelo (sin cilindrada ni tracción)" value={d.modelo} onChange={(e) => setD({ ...d, modelo: e.target.value.toUpperCase() })} />
                      <input className="input" placeholder="Versión (GL, Sport…)" value={d.version} onChange={(e) => setD({ ...d, version: e.target.value })} />
                      <input className="input" placeholder="Cilindrada (2.0)" value={d.cilindrada} onChange={(e) => setD({ ...d, cilindrada: e.target.value })} />
                      <input className="input" type="number" placeholder="Año" value={d.anio} onChange={(e) => setD({ ...d, anio: e.target.value })} />
                      <input className="input" placeholder="Color" value={d.color} onChange={(e) => setD({ ...d, color: e.target.value })} />
                      <select className="input" value={d.traccion} onChange={(e) => setD({ ...d, traccion: e.target.value })}>
                        <option value="">Tracción…</option>
                        {TRACCIONES.map((t) => <option key={t}>{t}</option>)}
                      </select>
                      <select className="input" value={d.transmision} onChange={(e) => setD({ ...d, transmision: e.target.value })}>
                        <option value="">Transmisión…</option>
                        {TRANSMISIONES.map((t) => <option key={t} value={t}>{TRANSMISION_LABEL[t] || t}</option>)}
                      </select>
                      <input className="input sm:col-span-2" placeholder="N° de chasis (VIN)" value={d.chasis} onChange={(e) => setD({ ...d, chasis: e.target.value.toUpperCase() })} />
                    </div>
                  </div>
                </>
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
                <p className="text-[11px] text-slate-400 mb-2">
                  Toca el testigo que esté encendido en el tablero. Se pinta con su color real.
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {LUCES.map((l) => {
                    const on = luces.includes(l.key)
                    return (
                      <button key={l.key} type="button" onClick={() => toggleLuz(l.key)}
                        className="flex flex-col items-center gap-1 px-1 py-2 rounded-lg border-2 transition-colors"
                        style={{
                          borderColor: on ? l.color : '#e2e8f0',
                          background: on ? l.color + '18' : '#fff',
                          color: on ? l.color : '#94a3b8'
                        }}>
                        <svg viewBox="0 0 24 24" className="w-8 h-8">
                          {ICONO_LUZ[l.icono]}
                        </svg>
                        <span className="text-[10px] leading-tight text-center"
                              style={{ color: on ? l.color : '#64748b', fontWeight: on ? 600 : 400 }}>
                          {l.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="label mb-2">Inventario presente</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2 text-sm">
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
              {/* Indicador de aguja como el del tablero: se lee de un vistazo y
                  el técnico lo reconoce sin traducir un número a octavos.
                  El arco va de E a F sobre 180°, con la zona baja en rojo. */}
              <div className="flex flex-col items-center">
                <svg viewBox="0 0 200 118" className="w-56 max-w-full">
                  {/* arco de fondo */}
                  <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
                  {/* reserva: primer cuarto en rojo */}
                  <path d="M20 100 A80 80 0 0 1 43.4 43.4" fill="none" stroke="#e0382b" strokeWidth="14" strokeLinecap="round" />
                  {/* marcas de E, 1/4, 1/2, 3/4, F */}
                  {[0, 2, 4, 6, 8].map((n) => {
                    const ang = Math.PI - (n / 8) * Math.PI
                    const x1 = 100 + Math.cos(ang) * 66, y1 = 100 - Math.sin(ang) * 66
                    const x2 = 100 + Math.cos(ang) * 56, y2 = 100 - Math.sin(ang) * 56
                    return <line key={n} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth="2" />
                  })}
                  <text x="16" y="114" fontSize="15" fontWeight="700" fill="#e0382b">E</text>
                  <text x="176" y="114" fontSize="15" fontWeight="700" fill="#111922">F</text>
                  <text x="100" y="30" fontSize="11" fill="#94a3b8" textAnchor="middle">1/2</text>
                  {/* aguja */}
                  {(() => {
                    const ang = Math.PI - (combustible / 8) * Math.PI
                    return (
                      <>
                        <line x1="100" y1="100" x2={100 + Math.cos(ang) * 62} y2={100 - Math.sin(ang) * 62}
                              stroke="#111922" strokeWidth="3.5" strokeLinecap="round" />
                        <circle cx="100" cy="100" r="7" fill="#111922" />
                        <circle cx="100" cy="100" r="3" fill="#fff" />
                      </>
                    )
                  })()}
                  {/* surtidor */}
                  <g transform="translate(88,58)" stroke="#94a3b8" strokeWidth="1.6" fill="none" strokeLinecap="round">
                    <rect x="0" y="2" width="11" height="14" rx="1.5" />
                    <path d="M0 6h11M13 5v8a2 2 0 002 2h1V8l-3-3" />
                  </g>
                </svg>
                <input type="range" min="0" max="8" step="1" value={combustible}
                       onChange={(e) => setCombustible(+e.target.value)}
                       className="w-56 max-w-full mt-1" aria-label="Nivel de combustible" />
                <p className="text-sm font-semibold text-ink mt-1">
                  {['Vacío', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8', 'Lleno'][combustible]}
                </p>
              </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-2">
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
