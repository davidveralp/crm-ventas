import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatPatente, patenteLimpia, formatRut, fmtFonoOT,
  OT_MARCAS, OT_MODELOS, OT_SVC_GRUPOS, svcAplicaAVehiculo, TRACCIONES,
  otBU, SERVICIOS_ORDENADOS, AREAS_REVISION, NIVELES_FLUIDOS, NIVEL_OPCIONES, SEV_COLOR, COMBUSTIBLES, TIPOS_VEHICULO,
  
  OT_TIPO_INGRESO, OT_TIPO_CLIENTE, OT_CONOCIO, OT_ES_GARANTIA, sucursalDeAsesor, TRANSMISIONES, TRANSMISION_LABEL } from '../lib/helpers'
import { imprimirInspeccion } from '../lib/inspeccionPDF'
import { motivoEdgeFunction } from '../lib/helpers'

// v77 · Nuevo Ingreso — formulario de página única (antes 7 pasos).
// Paso previo a Nueva OT. Al terminar, crea
// el registro de inspección (fotos, firma, diagrama de daños marcado) y
// entrega los datos ya listos para prellenar el formulario de Nueva OT.

/* Las cuatro áreas de la OT, en el mismo orden que las pestañas de Dimasoft. */
/* El tercer valor indica a dónde va en ClickUp: la mano de obra se ejecuta y
   por eso va como subtarea con responsable; los materiales solo se verifican y
   van como lista de control. */
/* Las tres listas de Tareas, con su destino en ClickUp.
   El quinto valor indica si admite ticket de cotización: la mano de obra no se
   cotiza a un proveedor, se ejecuta. */
const LISTAS_TAREAS = [
  ['servicio', 'Mano de obra', 'subtareas', 'Ej: Cambio de pastillas delanteras', false],
  ['repuesto', 'Repuestos', 'lista de control', 'Ej: Pastillas de freno delanteras', true],
  ['insumo', 'Lubricantes e insumos', 'lista de control', 'Ej: Aceite 5W30 sintético 4L', true],
  ['servicio_externo', 'Servicios externos', 'lista de control', 'Ej: Rectificado de discos', true]
]

const AREAS_OT = [
  ['servicio', 'Mano de obra', 'subtareas'],
  ['repuesto', 'Repuestos', 'lista de control'],
  ['insumo', 'Lubricantes e insumos', 'lista de control'],
  ['servicio_externo', 'Servicio externo', 'lista de control']
]

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
  /* Trazados según ISO 2575, la norma que usan todos los fabricantes.
     Se dibujan como SVG y no como imágenes para que tomen el color al
     encenderse, escalen sin pixelarse y no dependan de licencias de terceros. */

  // Bloque de motor de perfil con sus aletas
  motor: (
    <g fill="currentColor" stroke="none">
      <path d="M2.6 10.4h1.5V8.7h1.6V7.1h3.1v1.6h2.4l2.6-2.4h1.9v2.4h1.5V7.1h1.6v2.1h2.2v5.6h-2.2v2.1h-1.6v-1.6h-1.5v2.4h-1.9l-2.6-2.4H8.8v1.6H5.7v-1.6H4.1v-1.7H2.6z"/>
    </g>
  ),

  // Aceitera con gota cayendo
  aceite: (
    <g fill="currentColor" stroke="none">
      <path d="M2.4 15.3c1.4-2.2 3.7-3.6 6.7-3.6 2 0 3.7.5 5 1.5l4.3-2.8 1.1 1.5-3.5 2.6c.5.8.9 1.7 1 2.7H8c-.3-1.2-1.3-2-2.6-2-1.1 0-2.1.5-2.7 1.3z"/>
      <path d="M17.4 4.6c0 1-.8 1.8-1.8 1.8s-1.8-.8-1.8-1.8c0-1.1 1.8-3.4 1.8-3.4s1.8 2.3 1.8 3.4z"/>
    </g>
  ),

  // Termómetro sumergido en olas de refrigerante
  temp: (
    <g fill="currentColor" stroke="none">
      <path d="M12 2.6c-1.1 0-2 .9-2 2v7.3c-1 .7-1.7 1.8-1.7 3.1a3.7 3.7 0 107.4 0c0-1.3-.7-2.4-1.7-3.1V4.6c0-1.1-.9-2-2-2z"/>
      <rect x="15.6" y="4.6" width="5" height="1.6" rx=".8"/>
      <rect x="15.6" y="7.8" width="3.6" height="1.6" rx=".8"/>
      <rect x="15.6" y="11" width="5" height="1.6" rx=".8"/>
      <path d="M1.6 19.4c1.1-1.1 2.4-1.1 3.5 0s2.4 1.1 3.5 0 2.4-1.1 3.5 0 2.4 1.1 3.5 0 2.4-1.1 3.5 0 2.4 1.1 3.5 0"
            fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </g>
  ),

  // Batería con bornes + y −
  bateria: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.2" y="7.2" width="19.6" height="10.2" rx="1"/>
      <path d="M6.4 7.2V5.4h3.4v1.8M14.2 7.2V5.4h3.4v1.8"/>
      <path d="M5.6 12.3h3.6M7.4 10.5v3.6M14.8 12.3h3.6"/>
    </g>
  ),

  // Freno: círculo con exclamación entre paréntesis
  freno: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="5.6"/>
      <path d="M3.4 7.2a9.2 9.2 0 000 9.6M20.6 7.2a9.2 9.2 0 010 9.6"/>
      <path d="M12 8.9v3.6"/>
      <circle cx="12" cy="15.1" r="1.1" fill="currentColor" stroke="none"/>
    </g>
  ),

  // Airbag: ocupante sentado frente a la bolsa desplegada
  airbag: (
    <g fill="currentColor" stroke="none">
      <circle cx="5.8" cy="7.4" r="2.5"/>
      <path d="M3 18.8v-3.4c0-1.6 1.1-2.8 2.7-3.1l3.2-.6 1.3 2.3-2.9 1.4v3.4z"/>
      <path d="M9.4 18.8h2.2l1.6-3-2.4-1.2z"/>
      <circle cx="17.4" cy="12.6" r="4.6"/>
    </g>
  ),

  // ABS: letras dentro del disco de freno
  abs: (
    <g>
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="6"/>
        <path d="M3.2 6.9a9.6 9.6 0 000 10.2M20.8 6.9a9.6 9.6 0 010 10.2"/>
      </g>
      <text x="12" y="14.4" fontSize="6.2" fontWeight="700" textAnchor="middle"
            fill="currentColor" stroke="none" fontFamily="Arial, Helvetica, sans-serif">ABS</text>
    </g>
  ),

  // Presión de neumáticos: corte con estrías y exclamación
  neumatico: (
    <g fill="currentColor" stroke="none">
      <path d="M4.4 18V11c0-3.1 3.4-5.4 7.6-5.4S19.6 7.9 19.6 11v7h-2.4v-7c0-1.8-2.3-3.2-5.2-3.2S6.8 9.2 6.8 11v7z"/>
      <path d="M3.2 18.8h17.6v1.8H3.2z"/>
      <path d="M4.4 18l-1.2 2.6M19.6 18l1.2 2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="11" y="8.6" width="2" height="4" rx="1"/>
      <circle cx="12" cy="15" r="1.15"/>
    </g>
  ),

  // Luz alta: haz recto de rayas paralelas
  luces: (
    <g fill="currentColor" stroke="none">
      <path d="M8.4 5.4c3.6 0 6.5 2.9 6.5 6.6s-2.9 6.6-6.5 6.6H6.5V5.4z"/>
      <rect x="16.6" y="6.2" width="5.8" height="1.8" rx=".9"/>
      <rect x="16.6" y="9.5" width="5.8" height="1.8" rx=".9"/>
      <rect x="16.6" y="12.8" width="5.8" height="1.8" rx=".9"/>
      <rect x="16.6" y="16.1" width="5.8" height="1.8" rx=".9"/>
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
  const [avisoClickUp, setAvisoClickUp] = useState('')

  // ---- sección 1: datos generales ----
  const [busca, setBusca] = useState('')
  const [veh, setVeh] = useState(null)
  const [errBusca, setErrBusca] = useState('')
  const [d, setD] = useState({
    patente: '', km: '', fecha: new Date().toISOString().slice(0, 10), fecha_probable_entrega: '',
    ingreso_grua: false, trabajo_a_realizar: '', observaciones_cliente: '',
    // v92 · Campos del proceso del asesor que corresponden al MOMENTO DEL
    // INGRESO. Los de cierre (documento, monto, encuesta, estado del vehículo)
    // se quedan en Nueva OT: pedirlos acá sería preguntar por algo que todavía
    // no ocurrió.
    tipo_ingreso: 'Normal',      // OT_TIPO_INGRESO
    sucursal: '',                // Toyota | Multimarca | DyP — define la meta
    tipo_cliente: 'Particular',  // OT_TIPO_CLIENTE
    razon_social: '',            // solo empresa
    tipo_vehiculo: '', combustible: '',
    solicita_presupuesto: false, detalle_presupuesto: '',
    tipo_servicio: '', extras: [],
    contacto_nombre: '',         // quién trae el auto si no es el dueño
    dueno_nombre: '',            // dueño cuando difiere de quien paga
    aseguradora: '',
    enc_conocio: '',             // cómo conoció DIDIAL — solo si es cliente nuevo
    autoriza_movilizacion: true, // política 1 del documento firmado
    autoriza_contacto: true,     // habilita campañas de fidelización
    nombre: '', apellidos: '', rut: '', telefono: '', email: '', direccion: '', ciudad: '',
    marca: '', modelo: '', version: '', anio: '', color: '', chasis: '', cilindrada: '', traccion: '', transmision: ''
  })

  // La sucursal se deduce del rol del asesor (asesor_toyota → Toyota), igual
  // que en Nueva OT. Se puede cambiar, pero por defecto es la que corresponde.
  //
  // Va DESPUÉS de declarar `d`: aunque el cuerpo del efecto corra más tarde,
  // React lo registra durante el render, y `d` no existe todavía si el efecto
  // se escribe antes. Eso lanzaba "Cannot access 'd' before initialization" y
  // dejaba la pantalla en blanco al abrir Nuevo cliente.
  useEffect(() => {
    const suc = sucursalDeAsesor(perfil)
    if (suc) setD((x) => (x.sucursal ? x : { ...x, sucursal: suc }))
  }, [perfil])

  async function buscarVehiculo(entrada) {
    // Mismo formato que Nueva OT: se normaliza mientras se escribe, así el
    // usuario no tiene que acordarse de los espacios ni de las mayúsculas.
    const q = formatPatente(entrada)
    setBusca(q); setD({ ...d, patente: q })
    if (patenteLimpia(q).length < 5) { setVeh(null); return }
    const { data, error: eBusca } = await supabase.from('vehiculos')
      .select(`id, patente, marca, modelo, version, cilindrada, anio, color, chasis,
               traccion, transmision, tipo_vehiculo, km_ultimo, cliente_id,
               clientes(id, nombre, apellidos, rut, telefono, email, ciudad, direccion, tipo, contacto_nombre)`)
      .ilike('patente_norm', `%${patenteLimpia(q)}%`).limit(1)
    // Si la consulta falla (una columna mal escrita, por ejemplo), Supabase
    // devuelve error y data vacío. Sin distinguirlo, toda patente parecería
    // nueva y se perdería la precarga sin que nadie lo note.
    if (eBusca) { console.error('Búsqueda de patente falló:', eBusca.message); setErrBusca(eBusca.message) }
    else setErrBusca('')
    const v = data?.[0] || null
    setVeh(v)

    // Precarga para VALIDAR con el cliente, no para ocultar. Los campos se
    // muestran llenos y editables: si el cliente cambió de teléfono o el auto
    // tiene otro kilometraje, se corrige en el momento. Antes los campos
    // desaparecían y esa información quedaba sin actualizarse nunca.
    if (v) {
      const c = v.clientes || {}
      setD((x) => ({
        ...x,
        marca: v.marca || x.marca, modelo: v.modelo || x.modelo,
        version: v.version || x.version, cilindrada: v.cilindrada || x.cilindrada,
        anio: v.anio || x.anio, color: v.color || x.color, chasis: v.chasis || x.chasis,
        traccion: v.traccion || x.traccion, transmision: v.transmision || x.transmision,
        tipo_vehiculo: v.tipo_vehiculo || x.tipo_vehiculo,
        // El km NO se precarga: es el dato que cambia en cada visita y
        // arrastrarlo del registro anterior lo dejaría desactualizado.
        nombre: c.nombre || x.nombre, apellidos: c.apellidos || x.apellidos,
        rut: c.rut || x.rut, telefono: c.telefono || x.telefono,
        email: c.email || x.email, ciudad: c.ciudad || x.ciudad,
        direccion: c.direccion || x.direccion,
        tipo_cliente: c.tipo || x.tipo_cliente,
        contacto_nombre: c.contacto_nombre || x.contacto_nombre
      }))
    }
  }

  // ---- sección 2: luces + inventario ----
  const [luces, setLuces] = useState([])
  // v100: la revisión de recepción reemplaza al inventario. El inventario
  // protegía al taller de un reclamo; esto detecta necesidades con el cliente
  // presente, que es la primera instancia de venta cruzada.
  const [revision, setRevision] = useState({})   // clave -> {v, sev}
  const [niveles, setNiveles] = useState({})     // fluido -> valor
  const toggleLuz = (k) => setLuces((l) => l.includes(k) ? l.filter((x) => x !== k) : [...l, k])

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

  // ---- sección 6: mano de obra + observaciones ----
  const [checklist, setChecklist] = useState([])
  /* Las cuatro áreas de la OT, igual que en Dimasoft. El asesor carga QUÉ hay
     que hacer; el precio lo pone después el encargado de presupuestos. */
  const [lineasOT, setLineasOT] = useState([])
  const [nuevaLinea, setNuevaLinea] = useState({ tipo: 'servicio', detalle: '', cantidad: '1', codigo: '' })
  const [areasAbiertas, setAreasAbiertas] = useState({})
  const [revAbiertas, setRevAbiertas] = useState({})
  // Ítems a cotizar: van al encargado como presupuesto, no como trabajo a hacer
  const [nuevoItem, setNuevoItem] = useState('')
  const [obsAsesor, setObsAsesor] = useState('')
  /* Agrega o quita un servicio del texto de "Trabajo a realizar". Se trabaja
     sobre texto y no sobre una lista para que el asesor pueda matizar lo que
     pidió el cliente ("cambio de aceite, dice que suena adelante"). */
  const alternarServicio = (sv) => {
    const partes = d.trabajo_a_realizar.split(/\s*[·,]\s*/).map((x) => x.trim()).filter(Boolean)
    const i = partes.findIndex((x) => x === sv)
    if (i >= 0) partes.splice(i, 1)
    else partes.push(sv)
    setD({ ...d, trabajo_a_realizar: partes.join(' · ') })
  }

  // Tipo de vehículo elegido (para filtrar servicios que no apliquen)
  const tipoVehSel = SILUETAS.find((x) => x.key === silueta)?.tipoVehiculo || null

  /* Un hallazgo de la revisión pasa a ser mano de obra de la OT. `origen`
     guarda de qué punto vino, para no duplicarlo si se toca dos veces. */
  const sumarHallazgo = (clave, texto, r) => {
    const ya = lineasOT.find((l) => l.origen === clave)
    if (ya) { setLineasOT((x) => x.filter((l) => l.origen !== clave)); return }
    setLineasOT((x) => [...x, {
      id: 'hz' + Date.now() + Math.random().toString(36).slice(2, 5),
      tipo: 'servicio', detalle: `${texto} — ${r.v}`, cantidad: '1',
      codigo: '', cotizar: false, origen: clave
    }])
  }

  const agregarLinea = (tipo) => {
    if (!nuevaLinea.detalle.trim()) return
    setLineasOT((x) => [...x, {
      id: 'ln' + Date.now() + Math.random().toString(36).slice(2, 5),
      tipo: tipo || nuevaLinea.tipo, detalle: nuevaLinea.detalle.trim(),
      cantidad: nuevaLinea.cantidad || '1', codigo: '',
      // Los repuestos e insumos se marcan para cotizar; la mano de obra no.
      cotizar: false
    }])
    setNuevaLinea({ tipo: tipo || nuevaLinea.tipo, detalle: '', cantidad: '1' })
  }

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
      // El documento lleva el servicio principal Y los adicionales: el cliente
      // los aceptó y deben quedar por escrito. Lo que NO aparece es la etiqueta
      // "venta cruzada", que es lenguaje interno y no corresponde mostrarle.
      trabajo: d.tipo_servicio || d.trabajo_a_realizar,
      serviciosAdicionales: d.extras || [],
      observacionesCliente: d.observaciones_cliente,
      observacionesAsesor: obsAsesor,
      luces, revision, niveles, combustible, danos, checklist, fotos,
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
          rut: d.rut.trim() ? formatRut(d.rut) : null,
          telefono: d.telefono.trim() ? fmtFonoOT(d.telefono) : null,
          email: d.email?.trim() || null, direccion: d.direccion?.trim() || null,
          ciudad: d.ciudad?.trim() || null,
          tipo: d.tipo_cliente || null,
          contacto_nombre: d.contacto_nombre?.trim() || null,
          // `clientes` no tiene columna `estado`, sino `estado_id` hacia
          // pipeline_estados. Se deja en null, como hace el alta desde Clientes.
          vendedor_id: perfil.id
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
          chasis: d.chasis?.trim() || null,
          aseguradora: d.aseguradora?.trim() || null,
          dueno_nombre: d.dueno_nombre?.trim() || null,
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
      tipo_ingreso: d.tipo_ingreso, sucursal: d.sucursal || null,
      tipo_servicio: d.tipo_servicio || null,
      // Los extras son la venta cruzada de esta visita: se guardan aparte del
      // servicio principal para poder medirlos.
      servicios_extra: d.extras || [],
      tipo_vehiculo: d.tipo_vehiculo || null, combustible: d.combustible || null,
      solicita_presupuesto: lineasOT.some((l) => l.cotizar),
      detalle_presupuesto: lineasOT.filter((l) => l.cotizar).map((l) => `${l.detalle} (x${l.cantidad})`).join(' · ') || null,
      razon_social: d.razon_social?.trim() || null,
      tipo_cliente: d.tipo_cliente, conocio: d.enc_conocio || null,
      autoriza_movilizacion: d.autoriza_movilizacion,
      autoriza_contacto: d.autoriza_contacto,
      observaciones_cliente: d.observaciones_cliente.trim(), observaciones_asesor: obsAsesor.trim(),
      luces_advertencia: luces, nivel_combustible: combustible,
      // v100: la revisión sustituye al inventario. Se guarda como jsonb.
      revision_recepcion: revision, niveles_fluidos: niveles,
      tipo_silueta: silueta, danos, checklist, fotos, firma_url: firmaUrl,
      estado: 'completada', creado_por: perfil.id
    }).select().single()

    if (error) { setGuardando(false); return alert('Error al registrar la inspección: ' + error.message) }

    // ---- Trabajo de taller ----
    // Antes la inspección no lo creaba, así que el vehículo aparecía en ClickUp
    // sin datos y quedaba "por designar". Ahora nace aquí, con el vehículo, el
    // cliente y lo que pidió el cliente, para que llegue identificado.
    let trabajoId = null
    let otNumero = null
    if (vehiculoId) {
      const titulo = [
        veh?.patente || formatPatente(d.patente),
        veh?.marca || d.marca, veh?.modelo || d.modelo
      ].filter(Boolean).join(' ').trim()
      const { data: tj, error: eTj } = await supabase.from('trabajos_taller').insert({
        empresa_id: perfil.empresa_id,
        vehiculo_id: vehiculoId, cliente_id: clienteId,
        titulo: titulo || 'Ingreso de vehículo',
        servicio_solicitado: [d.tipo_servicio, ...(d.extras || [])].filter(Boolean).join(' · ')
          || d.trabajo_a_realizar.trim() || null,
        observaciones_cliente: d.observaciones_cliente.trim() || null,
        // Nace por designar a propósito: el jefe de taller decide el técnico.
        // La diferencia con antes es que ahora llega con toda la información.
        // Garantía y siniestro entran con prioridad alta: son los casos donde
        // la demora cuesta más, sea en credibilidad o en costo de grúa.
        estado: 'por_designar',
        prioridad: OT_ES_GARANTIA(d.tipo_ingreso) || d.ingreso_grua ? 'alta' : 'normal',
        sucursal: d.sucursal || null,
        km_ingreso: parseInt(d.km, 10) || null,
        inspeccion_id: insp.id
      }).select('id, ot_numero').maybeSingle()
      if (eTj) console.error('No se pudo crear el trabajo de taller:', eTj.message)
      else {
        trabajoId = tj?.id || null
        otNumero = tj?.ot_numero || null

        /* Respaldo: si el trigger de la migración 71 no está, el trabajo queda
           sin número y la OT sale "s/n". Se pide el correlativo a mano para que
           el documento salga numerado igual. */
        if (!otNumero && trabajoId) {
          const { data: nro } = await supabase.rpc('siguiente_ot_numero')
          if (nro) {
            otNumero = nro
            await supabase.from('trabajos_taller').update({ ot_numero: nro }).eq('id', trabajoId)
          }
        }
        // Tarjeta espejo en ClickUp desde el ingreso, no recién al solicitar
        // revisión: así el taller ve todo lo que entró aunque aún no tenga
        // técnico asignado. Nace en "por designar", que es justamente ese estado.
        // Las tareas que anotó el asesor se guardan y suben como subtareas a
        // ClickUp: es donde el mecánico las va a ver y marcar. Antes quedaban
        // solo en el acta y había que dictárselas.
        /* Las líneas de la OT se guardan sin precio: quedan esperando al
           encargado de presupuestos, que las verá en su bandeja. */
        if (trabajoId && lineasOT.length) {
          const { error: eLin } = await supabase.from('ot_detalle').insert(
            lineasOT.map((l, i) => ({
              empresa_id: perfil.empresa_id, trabajo_id: trabajoId,
              tipo: l.tipo, detalle: l.detalle,
              cantidad: Number(l.cantidad) || 1, precio_unit: 0,
              cargado_por: perfil.id, orden: i
            }))
          )
          if (eLin) console.error('No se pudieron guardar las líneas:', eLin.message)
          else {
            // El encargado debe enterarse: si no, las líneas esperan sin que
            // nadie sepa que están.
            await supabase.from('notificaciones').insert({
              empresa_id: perfil.empresa_id, // Se avisa al rol y, además, a administración: si nadie tiene el rol de
        // adquisiciones, el aviso no lo vería nadie y la solicitud se perdería.
        rol_destino: 'coordinador_adquisiciones',
              titulo: `Valorizar OT ${otNumero || ''} · ${formatPatente(d.patente)}`,
              cuerpo: `${lineasOT.length} línea(s) cargadas por ${perfil.nombre || 'el asesor'}`,
              url: '/presupuestos'
            })
          }
        }

        /* La mano de obra se guarda como líneas de la OT, no como tareas
           sueltas: así queda junto al resto del detalle, se valoriza igual y
           sube a ClickUp bajo el servicio seleccionado. */
        if (trabajoId && checklist.length) {
          const base = lineasOT.length
          const { error: eTar } = await supabase.from('ot_detalle').insert(
            checklist.map((c, i) => ({
              empresa_id: perfil.empresa_id, trabajo_id: trabajoId,
              tipo: 'servicio', detalle: c.item, cantidad: 1, precio_unit: 0,
              cargado_por: perfil.id, orden: base + i
            }))
          )
          if (eTar) console.error('No se pudo guardar la mano de obra:', eTar.message)
        }

        if (trabajoId) {
          try {
            const { data: rCu, error: eCu } = await supabase.functions.invoke('clickup-sync', {
              body: { accion: 'crear', trabajo_id: trabajoId }
            })
            // El error se MUESTRA, no solo se registra en consola. Antes fallaba
            // en silencio y no había forma de saber por qué no llegaba a ClickUp.
            // Igual que en campañas: cuando la función responde 4xx/5xx, el
            // motivo viene en el cuerpo, no en error.message.
            const msg = rCu?.error || (eCu ? await motivoEdgeFunction(eCu, rCu) : null)
            if (msg) {
              setAvisoClickUp(String(msg))
              console.error('ClickUp no recibió el ingreso:', msg, rCu)
            }
          } catch (e) {
            // Que ClickUp falle no impide la recepción, pero sí se informa.
            setAvisoClickUp(e?.message || String(e))
            console.error('ClickUp no disponible:', e)
          }
        }
      }
    }

    // Si el cliente pidió presupuesto, va directo al encargado. Antes esto se
    // pedía de palabra y se perdía entre la recepción y el mesón.
    const paraCotizar = lineasOT.filter((l) => l.cotizar)
    if (paraCotizar.length) {
      await supabase.from('notificaciones').insert({
        empresa_id: perfil.empresa_id,
        // Se avisa al rol y, además, a administración: si nadie tiene el rol de
        // adquisiciones, el aviso no lo vería nadie y la solicitud se perdería.
        rol_destino: 'coordinador_adquisiciones',
        titulo: `Cotizar · ${formatPatente(d.patente)}`,
        cuerpo: `${[d.marca, d.modelo].filter(Boolean).join(' ')} · ${paraCotizar.length} ítem(s) por cotizar`,
        url: '/valorizacion'
      })
      if (vehiculoId) {
        await supabase.from('presupuestos_taller').insert({
          empresa_id: perfil.empresa_id, vehiculo_id: vehiculoId, cliente_id: clienteId,
          trabajo_id: trabajoId, ot_numero: otNumero, estado: 'solicitado', origen: 'vehiculo',
          solicitud: paraCotizar.map((l) => l.detalle).join(' · '),
          // Cada ítem como línea del presupuesto: el encargado valoriza uno por
          // uno y el cliente puede aceptar parte.
          items: paraCotizar.map((l) => ({
            tipo: l.tipo, detalle: l.detalle, cant: Number(l.cantidad) || 1,
            codigo: '', costo: 0, precio: 0, en_stock: null
          })),
          solicitado_por: perfil.id
        })
      }
    }

    setGuardando(false)

    // Documento oficial, ya con la firma subida a Storage
    // El número de OT ya existe desde el ingreso: va en el acta que firma el cliente.
    imprimirInspeccion(datosDoc({ numero: otNumero || insp.id.slice(0, 8).toUpperCase(), firmaUrl }))

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
            <h2 className="text-lg font-bold text-ink">Nuevo Ingreso</h2>
            <p className="text-xs text-slate-400">Formulario completo · desplázate hacia abajo</p>
          </div>
          <button type="button" onClick={onCancelar} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className={comoPagina ? "px-5 py-4 space-y-4" : "flex-1 overflow-y-auto px-5 py-4 space-y-4"}>
          {/* ---- PASO 0: DATOS ---- */}
          {/* sección 1 */}
          <h3 className="text-sm font-bold text-ink border-b border-slate-200 pb-1 pt-2"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-deep text-white text-[10px] mr-2">1</span>Datos del vehículo y cliente</h3>

              {/* La patente va primero: es la llave que decide si todo lo demás
                  se precarga o hay que pedirlo. */}
              <div className="sm:col-span-2">
                <label className="label">Patente *</label>
                <input className="input uppercase" autoFocus value={busca} maxLength={10}
                       onChange={(e) => buscarVehiculo(e.target.value)} placeholder="Ej: GH TY 34" />
                {veh && <p className="text-xs text-green-600 mt-1">✓ {veh.marca} {veh.modelo} · {[veh.clientes?.nombre, veh.clientes?.apellidos].filter(Boolean).join(' ')} — valida los datos con el cliente</p>}
                {!veh && !errBusca && patenteLimpia(busca).length >= 5 && <p className="text-xs text-slate-400 mt-1">Patente nueva — completa los datos del cliente y del vehículo.</p>}
                {errBusca && <p className="text-xs mt-1" style={{ color: '#b8860b' }}>No se pudo consultar: {errBusca}</p>}
                {/* La fecha de ingreso es la de hoy y no se edita: es el dato
                    que fija el inicio del cómputo de permanencia. */}
                <p className="text-[11px] text-slate-400 mt-1">
                  Fecha de ingreso: {new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-CL')}
                </p>
              </div>
          {true && (
            <div className="space-y-3">
              {/* Los bloques van SIEMPRE visibles: con patente conocida se
                  precargan para validar, y sin ella se llenan a mano. */}
              <>
                  <div className="rounded-lg bg-paper p-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase">
                      Datos del cliente
                      {veh && <span className="normal-case font-normal text-slate-400"> · verifica con el cliente</span>}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select className="input sm:col-span-2" value={d.tipo_cliente}
                              onChange={(e) => setD({ ...d, tipo_cliente: e.target.value })}>
                        {OT_TIPO_CLIENTE.map((x) => <option key={x}>{x}</option>)}
                      </select>
                      {d.tipo_cliente === 'Empresa' && (
                        <input className="input sm:col-span-2" placeholder="Razón social"
                               value={d.razon_social}
                               onChange={(e) => setD({ ...d, razon_social: e.target.value })} />
                      )}
                      <input className="input"
                             placeholder={d.tipo_cliente === 'Empresa' ? 'Nombre del contacto' : 'Nombre(s)'}
                             value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} />
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
                      <input className="input" placeholder="Kilometraje" type="number" value={d.km}
                             onChange={(e) => setD({ ...d, km: e.target.value })} />
                      <div>
                        <select className="input" value={OT_MARCAS.includes(d.marca) ? d.marca : (d.marca ? '__otra__' : '')}
                                onChange={(e) => setD({ ...d, marca: e.target.value === '__otra__' ? ' ' : e.target.value, modelo: '' })}>
                          <option value="">Marca…</option>
                          {OT_MARCAS.map((m) => <option key={m}>{m}</option>)}
                          <option value="__otra__">Otra…</option>
                        </select>
                        {d.marca && !OT_MARCAS.includes(d.marca) && (
                          <input className="input mt-1.5" placeholder="Escribe la marca" value={d.marca.trim()}
                                 onChange={(e) => setD({ ...d, marca: e.target.value.toUpperCase() })} />
                        )}
                      </div>
                      <div>
                        {/* Toyota, Nissan y Mazda tienen catálogo de modelos por
                            ser las que más entran. El resto va como texto libre. */}
                        {OT_MODELOS[d.marca] ? (
                          <>
                            <select className="input" value={OT_MODELOS[d.marca].includes(d.modelo) ? d.modelo : (d.modelo ? '__otro__' : '')}
                                    onChange={(e) => setD({ ...d, modelo: e.target.value === '__otro__' ? ' ' : e.target.value })}>
                              <option value="">Modelo…</option>
                              {OT_MODELOS[d.marca].map((m) => <option key={m}>{m}</option>)}
                              <option value="__otro__">Otro…</option>
                            </select>
                            {d.modelo && !OT_MODELOS[d.marca].includes(d.modelo) && (
                              <input className="input mt-1.5" placeholder="Escribe el modelo" value={d.modelo.trim()}
                                     onChange={(e) => setD({ ...d, modelo: e.target.value.toUpperCase() })} />
                            )}
                          </>
                        ) : (
                          <input className="input" placeholder="Modelo (sin cilindrada ni tracción)" value={d.modelo}
                                 onChange={(e) => setD({ ...d, modelo: e.target.value.toUpperCase() })} />
                        )}
                      </div>
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
                      <select className="input" value={d.tipo_vehiculo}
                              onChange={(e) => setD({ ...d, tipo_vehiculo: e.target.value })}>
                        <option value="">Tipo de vehículo…</option>
                        {TIPOS_VEHICULO.map((t) => <option key={t}>{t}</option>)}
                      </select>
                      <select className="input" value={d.combustible}
                              onChange={(e) => setD({ ...d, combustible: e.target.value })}>
                        <option value="">Combustible…</option>
                        {COMBUSTIBLES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                      <input className="input sm:col-span-2" placeholder="N° de chasis (VIN)" value={d.chasis} onChange={(e) => setD({ ...d, chasis: e.target.value.toUpperCase() })} />
                    </div>
                  </div>
              </>
              <div>
                <label className="label">Ingreso en grúa</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setD({ ...d, ingreso_grua: true })} className={`px-4 py-1.5 rounded-lg border text-sm ${d.ingreso_grua ? 'bg-deep text-white border-deep' : 'border-slate-200'}`}>Sí</button>
                  <button type="button" onClick={() => setD({ ...d, ingreso_grua: false })} className={`px-4 py-1.5 rounded-lg border text-sm ${!d.ingreso_grua ? 'bg-deep text-white border-deep' : 'border-slate-200'}`}>No</button>
                </div>
              </div>
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Trabajo a realizar</label>
                  <select className="input" value={d.tipo_servicio}
                          onChange={(e) => setD({ ...d, tipo_servicio: e.target.value, extras: [] })}>
                    <option value="">Seleccionar servicio…</option>
                    {SERVICIOS_ORDENADOS.map((sv) => <option key={sv}>{sv}</option>)}
                  </select>
                  {d.tipo_servicio && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Unidad de negocio: <strong>{otBU(d.tipo_servicio) || 'por clasificar'}</strong>
                    </p>
                  )}
                </div>
                {/* Segunda lista, con el mismo catálogo menos el ya elegido.
                    Cada selección se agrega y la lista queda lista para otra:
                    en una visita se pueden sumar varios adicionales. */}
                {d.tipo_servicio && (
                  <div>
                    <label className="label">Servicio adicional</label>
                    <select className="input" value=""
                            onChange={(e) => {
                              const sv = e.target.value
                              if (sv) setD((x) => ({ ...x, extras: [...new Set([...(x.extras || []), sv])] }))
                            }}>
                      <option value="">Agregar servicio…</option>
                      {SERVICIOS_ORDENADOS
                        .filter((sv) => sv !== d.tipo_servicio && !(d.extras || []).includes(sv))
                        .map((sv) => <option key={sv}>{sv}</option>)}
                    </select>
                    {(d.extras || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {(d.extras || []).map((sv) => (
                          <span key={sv} className="text-[11px] px-2 py-1 rounded-lg flex items-center gap-1"
                                style={{ background: '#e8f6ee', color: '#1f7a45' }}>
                            {sv}
                            <button type="button" className="font-bold"
                                    onClick={() => setD((x) => ({ ...x, extras: (x.extras || []).filter((y) => y !== sv) }))}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Dos campos distintos a propósito: el cliente describe el
                  síntoma ("suena adelante al frenar") y el asesor el criterio
                  técnico ("pastillas al 20%, recomiendo cambio"). Mezclarlos
                  pierde información que después sirve para el diagnóstico. */}
              <div>
                <label className="label">Observaciones del cliente</label>
                <textarea className="input" rows="2" value={d.observaciones_cliente}
                          placeholder="Lo que dice el cliente, en sus palabras"
                          onChange={(e) => setD({ ...d, observaciones_cliente: e.target.value })} />
              </div>
              <div>
                <label className="label">Observaciones del asesor</label>
                <textarea className="input" rows="2" value={obsAsesor}
                          placeholder="Tu criterio técnico y lo que observaste"
                          onChange={(e) => setObsAsesor(e.target.value)} />
              </div>

              {/* ---- TAREAS ----
                   Tres listas, una por destino en ClickUp:
                     Mano de obra         → subtareas (se ejecutan, tienen responsable)
                     Repuestos            → lista de control
                     Lubricantes e insumos → lista de control

                   Los materiales llevan un ticket para pedir cotización: lo que
                   el cliente trae o ya está en bodega no hay que cotizarlo. */}
              <div className="sm:col-span-2 rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-medium text-ink">Tareas</p>
                <p className="text-[11px] text-slate-400 mb-3">
                  Lo que hay que hacerle al vehículo. Sin precios: los valoriza el
                  encargado de presupuestos.
                </p>

                {LISTAS_TAREAS.map(([tipo, titulo, destino, ejemplo, cotizable]) => {
                  const ls = lineasOT.filter((l) => l.tipo === tipo)
                  const abierta = areasAbiertas[tipo] ?? true
                  const aCot = ls.filter((l) => l.cotizar).length
                  return (
                    <div key={tipo} className="border-t border-slate-100 first:border-t-0 py-2">
                      <button type="button"
                        onClick={() => setAreasAbiertas((x) => ({ ...x, [tipo]: !abierta }))}
                        className="w-full flex items-center justify-between text-left mb-1.5">
                        <span className="text-xs font-semibold text-slate-600">
                          {abierta ? '▾' : '▸'} {titulo}
                          <span className="font-normal text-slate-300"> · {destino}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          {aCot > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded"
                                  style={{ background: '#fdf6e3', color: '#8a6d1f' }}>
                              {aCot} a cotizar
                            </span>
                          )}
                          <span className="text-xs px-1.5 py-0.5 rounded"
                                style={ls.length
                                  ? { background: '#e8f6ee', color: '#1f7a45', fontWeight: 600 }
                                  : { color: '#cbd5e1' }}>{ls.length}</span>
                        </span>
                      </button>

                      {abierta && (
                        <>
                          <div className="grid grid-cols-12 gap-1.5 mb-1.5">
                            <input className="input col-span-8" style={{ minHeight: '36px', fontSize: '13px' }}
                                   placeholder={ejemplo}
                                   value={nuevaLinea.tipo === tipo ? nuevaLinea.detalle : ''}
                                   onFocus={() => setNuevaLinea((x) => ({ ...x, tipo }))}
                                   onChange={(e) => setNuevaLinea({ tipo, detalle: e.target.value, cantidad: nuevaLinea.cantidad || '1' })}
                                   onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarLinea(tipo) } }} />
                            <input className="input col-span-2" style={{ minHeight: '36px', fontSize: '13px' }}
                                   inputMode="decimal" placeholder="Cant."
                                   value={nuevaLinea.tipo === tipo ? nuevaLinea.cantidad : '1'}
                                   onChange={(e) => setNuevaLinea({ ...nuevaLinea, tipo, cantidad: e.target.value.replace(/[^0-9.]/g, '') })} />
                            <button type="button" className="btn-soft col-span-2 text-xs"
                                    style={{ minHeight: '36px' }} onClick={() => agregarLinea(tipo)}>+</button>
                          </div>

                          {ls.map((l, i) => (
                            <div key={l.id} className="flex items-center gap-2 text-sm py-1 border-b border-slate-50 last:border-0">
                              <span className="text-slate-400 text-xs w-4">{i + 1}</span>
                              <span className="flex-1 text-slate-700">{l.detalle}</span>
                              {Number(l.cantidad) > 1 && <span className="text-xs text-slate-400">×{l.cantidad}</span>}
                              {cotizable && (
                                <label className="flex items-center gap-1 cursor-pointer shrink-0">
                                  <input type="checkbox" checked={!!l.cotizar}
                                         onChange={() => setLineasOT((x) => x.map((y) =>
                                           y.id === l.id ? { ...y, cotizar: !y.cotizar } : y))} />
                                  <span className="text-[11px]"
                                        style={{ color: l.cotizar ? '#8a6d1f' : '#cbd5e1' }}>cotizar</span>
                                </label>
                              )}
                              <button type="button" className="text-slate-300 text-lg leading-none"
                                      onClick={() => setLineasOT((x) => x.filter((y) => y.id !== l.id))}>×</button>
                            </div>
                          ))}
                          {!ls.length && <p className="text-xs text-slate-300">Sin líneas.</p>}
                        </>
                      )}
                    </div>
                  )
                })}

                {lineasOT.some((l) => l.cotizar) && (
                  <p className="text-[11px] mt-2 px-2 py-1.5 rounded"
                     style={{ background: '#fdf6e3', color: '#8a6d1f' }}>
                    {lineasOT.filter((l) => l.cotizar).length} ítem(s) marcados para cotizar.
                    Se envían al encargado de presupuestos al registrar el ingreso.
                  </p>
                )}
              </div>

              {/* La fecha de entrega recién tiene sentido cuando se sabe qué se
                  va a hacer: antes de elegir el servicio es una adivinanza. */}
              <div className="sm:col-span-2 sm:w-1/2">
                <label className="label">Fecha probable de entrega</label>
                <input className="input" type="date" value={d.fecha_probable_entrega}
                       disabled={!d.tipo_servicio}
                       onChange={(e) => setD({ ...d, fecha_probable_entrega: e.target.value })} />
                {!d.tipo_servicio && (
                  <p className="text-[11px] text-slate-400 mt-1">Elige primero el trabajo a realizar.</p>
                )}
              </div>

              {/* ---- Proceso del asesor en la recepción ----
                   Estos campos definen cómo se clasifica la OT y a qué meta
                   comercial suma. Antes se llenaban recién en Nueva OT, cuando
                   el cliente ya se había ido y había que recordar lo que dijo. */}
              <div className="sm:col-span-2 rounded-lg bg-paper p-3 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase">Clasificación del ingreso</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label">Tipo de ingreso</label>
                    <select className="input" value={d.tipo_ingreso}
                            onChange={(e) => setD({ ...d, tipo_ingreso: e.target.value })}>
                      {OT_TIPO_INGRESO.map((x) => <option key={x}>{x}</option>)}
                    </select>
                    {OT_ES_GARANTIA(d.tipo_ingreso) && (
                      <p className="text-[10px] mt-1" style={{ color: '#b8860b' }}>
                        Cuenta como garantía en los indicadores. Tope: 3 por sucursal al mes.
                      </p>
                    )}
                  </div>
                </div>


                {/* El origen solo se pregunta al cliente nuevo: al que ya viene
                    hace años, preguntarle cómo nos conoció es incómodo. */}
                {!veh && (
                  <div>
                    <label className="label">¿Cómo conoció DIDIAL?</label>
                    <select className="input" value={d.enc_conocio}
                            onChange={(e) => setD({ ...d, enc_conocio: e.target.value })}>
                      <option value="">Seleccionar…</option>
                      {/* OT_CONOCIO es [{v, e}] — valor y emoji—, no una lista
                          de textos. Renderizar el objeto entero provocaba el
                          error #31 de React y dejaba la pantalla en blanco. */}
                      {OT_CONOCIO.map((x) => (
                        <option key={x.v} value={x.v}>{x.e} {x.v}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Es el único momento en que se puede preguntar sin incomodar.
                    </p>
                  </div>
                )}

                {/* Autorizaciones: la primera es la política que el cliente firma
                    en el documento; la segunda habilita las campañas. */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={d.autoriza_movilizacion}
                           onChange={(e) => setD({ ...d, autoriza_movilizacion: e.target.checked })} />
                    Autoriza movilizar el vehículo para pruebas en ruta
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={d.autoriza_contacto}
                           onChange={(e) => setD({ ...d, autoriza_contacto: e.target.checked })} />
                    Autoriza contacto para recordatorios de mantención
                  </label>
                  {!d.autoriza_contacto && (
                    <p className="text-[10px]" style={{ color: '#b8860b' }}>
                      Sin autorización queda fuera de las campañas de fidelización.
                    </p>
                  )}
                </div>
              </div>
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
              {/* ---- Revisión de recepción · 7 áreas independientes ----
                   Cada área se despliega por separado porque el recorrido
                   físico también lo es: nadie revisa el tren delantero y las
                   luces al mismo tiempo. */}
              <div>
                <label className="label mb-1">Revisión de recepción</label>
                <p className="text-[11px] text-slate-400 mb-2">
                  Lo que detectes acá es la primera oportunidad de venta, antes del RADAR.
                  Toca <strong>+ al servicio</strong> en un hallazgo para agregarlo a la OT.
                </p>

                <div className="space-y-1.5">
                  {AREAS_REVISION.map((area) => {
                    const respondidos = area.items.filter((it) => revision[it[0]]).length
                    const criticos = area.items.filter((it) => revision[it[0]]?.sev === 'critico').length
                    const pronto = area.items.filter((it) => revision[it[0]]?.sev === 'pronto').length
                    const abierta = revAbiertas[area.k] ?? false
                    return (
                      <div key={area.k} className="rounded-lg border"
                           style={{ borderColor: criticos ? '#e0382b55' : pronto ? '#e0a02055' : '#e2e8f0' }}>
                        <button type="button"
                          onClick={() => setRevAbiertas((x) => ({ ...x, [area.k]: !abierta }))}
                          className="w-full flex items-center justify-between p-2 text-left">
                          <span className="text-sm font-medium text-ink">
                            {abierta ? '▾' : '▸'} {area.t}
                          </span>
                          <span className="flex items-center gap-1.5">
                            {criticos > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                                    style={{ background: '#fdecea', color: '#e0382b' }}>{criticos}</span>
                            )}
                            {pronto > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                                    style={{ background: '#fdf6e3', color: '#8a6d1f' }}>{pronto}</span>
                            )}
                            <span className="text-[11px] text-slate-400">
                              {respondidos}/{area.items.length}
                            </span>
                          </span>
                        </button>

                        {abierta && (
                          <div className="px-2 pb-2 space-y-1.5">
                            {area.items.map(([k, texto, ops, cond]) => {
                              const r = revision[k]
                              return (
                                <div key={k} className="rounded-lg p-1.5"
                                     style={{ background: r ? SEV_COLOR[r.sev] + '0d' : '#fafbfc' }}>
                                  <div className="text-[13px] text-ink">
                                    {texto}
                                    {cond && <span className="text-[10px] text-slate-400"> · {cond}</span>}
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-1 items-center">
                                    {ops.map(([v, label, sev]) => {
                                      const on = r?.v === v
                                      const c = SEV_COLOR[sev]
                                      return (
                                        <button key={v} type="button"
                                          onClick={() => setRevision((x) => ({
                                            ...x, [k]: on ? undefined : { v, sev, texto }
                                          }))}
                                          className="px-2 rounded text-[11px] border transition-colors"
                                          style={{ minHeight: '30px',
                                                   background: on ? c : '#fff',
                                                   color: on ? '#fff' : c,
                                                   borderColor: on ? c : c + '44',
                                                   fontWeight: on ? 600 : 400 }}>
                                          {label}
                                        </button>
                                      )
                                    })}
                                    {r && r.sev !== 'ok' && r.sev !== 'na' && (
                                      <button type="button"
                                        onClick={() => sumarHallazgo(k, texto, r)}
                                        className="ml-auto px-2 rounded text-[10px] border"
                                        style={lineasOT.some((l) => l.origen === k)
                                          ? { background: '#1f9d57', color: '#fff', borderColor: '#1f9d57', minHeight: '30px', fontWeight: 600 }
                                          : { background: '#fff', color: '#1f7a45', borderColor: '#a8d9bd', minHeight: '30px' }}>
                                        {lineasOT.some((l) => l.origen === k) ? '✓ en la OT' : '+ al servicio'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
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
          <h3 className="text-sm font-bold text-ink border-b border-slate-200 pb-1 pt-2"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-deep text-white text-[10px] mr-2">6</span>Firma del cliente</h3>
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
            {avisoClickUp && (
              <span className="text-[11px] px-2 py-1 rounded max-w-xs"
                    style={{ background: '#fdf6e3', color: '#8a6d1f' }}>
                El ingreso se guardó, pero ClickUp no lo recibió: {avisoClickUp}
              </span>
            )}
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
