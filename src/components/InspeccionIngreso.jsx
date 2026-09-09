import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatPatente, patenteLimpia, formatRut, fmtFonoOT,
  OT_MARCAS, OT_MODELOS, OT_SVC_GRUPOS, svcAplicaAVehiculo, TRACCIONES,
  otBU, SERVICIOS_ORDENADOS, REVISION_INGRESO, NIVELES_FLUIDOS, NIVEL_OPCIONES, SEV_COLOR, COMBUSTIBLES, TIPOS_VEHICULO,
  
  OT_TIPO_INGRESO, OT_TIPO_CLIENTE, OT_CONOCIO, OT_ES_GARANTIA, sucursalDeAsesor, TRANSMISIONES, TRANSMISION_LABEL } from '../lib/helpers'
import { imprimirInspeccion } from '../lib/inspeccionPDF'
import { motivoEdgeFunction } from '../lib/helpers'

// v77 · Nuevo Ingreso — formulario de página única (antes 7 pasos).
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
  // Motor: bloque con aletas laterales, silueta maciza
  motor: (
    <g fill="currentColor" stroke="none">
      <path d="M3.6 10.2h1.7V8.6h2.5V6.9h2.2v1.7h2.6l2.1-2.1h2.4v2.1h1.6v1.6h1.7v4.2h-1.7v1.7h-4l-2.1-2.1h-2.8v2.1H7.8v-1.7H5.3v-1.7H3.6z"/>
    </g>
  ),
  // Aceitera clásica con gota
  aceite: (
    <g fill="currentColor" stroke="none">
      <path d="M2.6 14.9c1.3-2 3.4-3.3 6.2-3.3 1.9 0 3.4.5 4.6 1.4l4-2.6 1 1.3-3.2 2.4c.5.7.8 1.5.9 2.4H7.9c-.3-1.1-1.2-1.8-2.4-1.8-1 0-1.9.4-2.5 1.1z"/>
      <path d="M16.6 5.4c0 .9-.7 1.6-1.6 1.6s-1.6-.7-1.6-1.6c0-1 1.6-3 1.6-3s1.6 2 1.6 3z"/>
    </g>
  ),
  // Termómetro sobre olas
  temp: (
    <g fill="currentColor" stroke="none">
      <path d="M12 3.2c-1 0-1.8.8-1.8 1.8v6.9c-.9.6-1.5 1.6-1.5 2.8 0 1.8 1.5 3.3 3.3 3.3s3.3-1.5 3.3-3.3c0-1.2-.6-2.2-1.5-2.8V5c0-1-.8-1.8-1.8-1.8z"/>
      <rect x="16" y="5.4" width="4.4" height="1.5" rx=".7"/>
      <rect x="16" y="8.4" width="3.2" height="1.5" rx=".7"/>
      <rect x="16" y="11.4" width="4.4" height="1.5" rx=".7"/>
      <path d="M2 19.6c1-1 2.2-1 3.2 0s2.2 1 3.2 0 2.2-1 3.2 0 2.2 1 3.2 0 2.2-1 3.2 0 2.2 1 3.2 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </g>
  ),
  // Batería rectangular con bornes
  bateria: (
    <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <rect x="2.6" y="7.4" width="18.8" height="9.8" rx="1"/>
      <path d="M6.6 7.4V5.6h3.2v1.8M14.2 7.4V5.6h3.2v1.8"/>
      <path d="M6 12.3h3.4M7.7 10.6v3.4M14.6 12.3H18"/>
    </g>
  ),
  // Freno: círculo con exclamación y paréntesis
  freno: (
    <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <circle cx="12" cy="12" r="5.2"/>
      <path d="M3.9 7.6a8.6 8.6 0 000 8.8M20.1 7.6a8.6 8.6 0 010 8.8"/>
      <path d="M12 9.1v3.3"/><circle cx="12" cy="14.9" r="1" fill="currentColor" stroke="none"/>
    </g>
  ),
  // Airbag: ocupante y bolsa desplegada
  airbag: (
    <g fill="currentColor" stroke="none">
      <circle cx="6.6" cy="7.6" r="2.4"/>
      <path d="M4 18.6v-3c0-1.5 1-2.6 2.5-2.9l2.6-.5 1.4 2.4-2.6 1.3v2.7z"/>
      <path d="M10 18.6h1.6l1.4-2.6-2.2-1.1z"/>
      <circle cx="17" cy="13.4" r="4.4"/>
    </g>
  ),
  // ABS dentro del disco
  abs: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="5.4"/>
      <path d="M3.8 7.6a8.6 8.6 0 000 8.8M20.2 7.6a8.6 8.6 0 010 8.8" strokeLinecap="round"/>
      <text x="12" y="14.2" fontSize="5" fontWeight="700" textAnchor="middle"
            fill="currentColor" stroke="none">ABS</text>
    </g>
  ),
  // Neumático en corte con exclamación (TPMS)
  neumatico: (
    <g fill="currentColor" stroke="none">
      <path d="M5 17.6V11c0-2.9 3.1-5 7-5s7 2.1 7 5v6.6h-2.2V11c0-1.6-2.1-2.9-4.8-2.9S7.2 9.4 7.2 11v6.6z"/>
      <path d="M4 18.4h16v1.7H4z"/>
      <path d="M11 9.4h2v3.6h-2z"/><circle cx="12" cy="15.2" r="1.1"/>
    </g>
  ),
  // Luz alta: haz recto
  luces: (
    <g fill="currentColor" stroke="none">
      <path d="M8.8 5.8c3.4 0 6.1 2.8 6.1 6.2s-2.7 6.2-6.1 6.2H6.9V5.8z"/>
      <rect x="16.4" y="6.4" width="5.8" height="1.7" rx=".8"/>
      <rect x="16.4" y="9.5" width="5.8" height="1.7" rx=".8"/>
      <rect x="16.4" y="12.6" width="5.8" height="1.7" rx=".8"/>
      <rect x="16.4" y="15.7" width="5.8" height="1.7" rx=".8"/>
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

  // ---- sección 6: checklist + observaciones asesor ----
  const [checklist, setChecklist] = useState([])
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
      solicita_presupuesto: d.solicita_presupuesto,
      detalle_presupuesto: d.detalle_presupuesto?.trim() || null,
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
      }).select('id').maybeSingle()
      if (eTj) console.error('No se pudo crear el trabajo de taller:', eTj.message)
      else {
        trabajoId = tj?.id || null
        // Tarjeta espejo en ClickUp desde el ingreso, no recién al solicitar
        // revisión: así el taller ve todo lo que entró aunque aún no tenga
        // técnico asignado. Nace en "por designar", que es justamente ese estado.
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
    if (d.solicita_presupuesto && d.detalle_presupuesto.trim()) {
      await supabase.from('notificaciones').insert({
        empresa_id: perfil.empresa_id,
        rol_destino: 'coordinador_adquisiciones',
        titulo: `Cotizar · ${formatPatente(d.patente)}`,
        cuerpo: `${[d.marca, d.modelo].filter(Boolean).join(' ')} · ${d.detalle_presupuesto.trim()}`,
        url: '/presupuestos'
      })
      if (vehiculoId) {
        await supabase.from('presupuestos_taller').insert({
          empresa_id: perfil.empresa_id, vehiculo_id: vehiculoId, cliente_id: clienteId,
          trabajo_id: trabajoId, estado: 'solicitado', origen: 'vehiculo',
          solicitud: d.detalle_presupuesto.trim(),
          items: [], solicitado_por: perfil.id
        })
      }
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
              <div><label className="label">Observaciones del cliente</label><textarea className="input" rows="2" value={d.observaciones_cliente} onChange={(e) => setD({ ...d, observaciones_cliente: e.target.value })} /></div>

              {/* ---- ¿Solicita presupuesto? ----
                   Si el cliente quiere cotización, el detalle va directo al
                   encargado de presupuestos. Es el paso que hoy se hacía de
                   palabra y se perdía. */}
              <div className="sm:col-span-2 rounded-lg border-2 p-3"
                   style={{ borderColor: d.solicita_presupuesto ? '#2f6fb0' : '#e2e8f0' }}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={d.solicita_presupuesto}
                         onChange={(e) => setD({ ...d, solicita_presupuesto: e.target.checked })} />
                  <span className="text-sm font-medium text-ink">El cliente solicita presupuesto</span>
                </label>
                {d.solicita_presupuesto && (
                  <div className="mt-2">
                    <label className="label">¿Qué hay que cotizar?</label>
                    <textarea className="input" rows="2"
                      placeholder="Detalle para el encargado de presupuestos. Sé específico: repuestos, mano de obra, alternativas…"
                      value={d.detalle_presupuesto}
                      onChange={(e) => setD({ ...d, detalle_presupuesto: e.target.value })} />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Se envía a Víctor Tello al registrar el ingreso. El compromiso son 15 minutos.
                    </p>
                  </div>
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
              {/* ---- Revisión de recepción ----
                   Reemplaza al inventario. Cada ítem responde con una opción
                   de color, igual que el RADAR, para que el asesor pueda
                   mostrarle el resultado al cliente en el momento. */}
              <div>
                <label className="label mb-1">Revisión de recepción</label>
                <p className="text-[11px] text-slate-400 mb-2">
                  Lo que detectes acá es la primera oportunidad de venta, antes del RADAR.
                </p>
                <div className="space-y-2">
                  {REVISION_INGRESO.map((it) => {
                    const r = revision[it.k]
                    return (
                      <div key={it.k} className="rounded-lg border p-2"
                           style={{ borderColor: r ? SEV_COLOR[r.sev] + '66' : '#e2e8f0' }}>
                        <div className="text-sm font-medium text-ink">
                          {it.t}
                          {it.cond && <span className="text-[10px] text-slate-400 font-normal"> · {it.cond}</span>}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
                          {it.ops.map(([v, label, sev]) => {
                            const on = r?.v === v
                            const c = SEV_COLOR[sev]
                            return (
                              <button key={v} type="button"
                                onClick={() => setRevision((x) => ({ ...x, [it.k]: on ? undefined : { v, sev } }))}
                                className="px-2.5 rounded-lg text-xs border-2 transition-colors"
                                style={{ minHeight: '38px',
                                         background: on ? c : '#fff',
                                         color: on ? '#fff' : c,
                                         borderColor: on ? c : c + '55',
                                         fontWeight: on ? 600 : 400 }}>
                                {label}
                              </button>
                            )
                          })}
                          {/* Si hay hallazgo, el asesor puede sumarlo al
                              servicio en el momento. Es información INTERNA:
                              alimenta la venta cruzada y no sale en el
                              documento que firma el cliente. */}
                          {r && r.sev !== 'ok' && r.sev !== 'na' && (
                            <button type="button"
                              onClick={() => setD((x) => {
                                const et = `${it.t}${r.v ? ' (' + (it.ops.find((o) => o[0] === r.v)?.[1] || r.v) + ')' : ''}`
                                const ya = (x.extras || []).includes(et)
                                return { ...x, extras: ya ? (x.extras || []).filter((y) => y !== et) : [...(x.extras || []), et] }
                              })}
                              className="px-2 py-1 rounded-lg text-[11px] border-2 ml-auto"
                              style={(d.extras || []).some((e) => e.startsWith(it.t))
                                ? { background: '#1f9d57', color: '#fff', borderColor: '#1f9d57', fontWeight: 600 }
                                : { background: '#fff', color: '#1f7a45', borderColor: '#a8d9bd' }}>
                              {(d.extras || []).some((e) => e.startsWith(it.t)) ? '✓ En el servicio' : '+ Sumar al servicio'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Niveles: mismo criterio para los cinco fluidos, así se
                    comparan entre sí y se responden rápido. */}
                <div className="mt-3 rounded-lg border border-slate-200 p-2">
                  <div className="text-sm font-medium text-ink mb-2">Niveles de fluidos</div>
                  <div className="space-y-1.5">
                    {NIVELES_FLUIDOS.map((fl) => (
                      <div key={fl} className="flex items-center gap-2">
                        <span className="text-sm text-slate-600 flex-1 min-w-0 truncate">{fl}</span>
                        <select className="input w-40 shrink-0" style={{ minHeight: '38px' }}
                                value={niveles[fl] || ''}
                                onChange={(e) => setNiveles((x) => ({ ...x, [fl]: e.target.value }))}>
                          <option value="">Sin revisar</option>
                          {NIVEL_OPCIONES.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
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
