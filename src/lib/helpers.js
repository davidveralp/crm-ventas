export const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency', currency: 'CLP', maximumFractionDigits: 0
})

export const fmtCLP = (n) => CLP.format(Number(n) || 0)

export const fmtFecha = (d) => {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('es-CL') } catch { return d }
}

export const SEGMENTOS = {
  nuevo:               { label: 'Nuevo cliente',        color: '#0E7490' },
  flota_empresa:       { label: 'Flota / Empresa',      color: '#1C4357' },
  vip_activo:          { label: 'VIP Activo',           color: '#1D9E75' },
  alto_valor_riesgo:   { label: 'Alto Valor en Riesgo', color: '#A32D2D' },
  leal_recurrente:     { label: 'Leal Recurrente',      color: '#534AB7' },
  prometedor:          { label: 'Prometedor',           color: '#185FA5' },
  dormido_recuperable: { label: 'Dormido Recuperable',  color: '#C98A1B' },
  ocasional:           { label: 'Ocasional',            color: '#73726c' }
}

export const VENTANAS = {
  vencida:   { label: 'Vencida',          color: '#A32D2D' },
  inminente: { label: 'Inminente (≤30d)', color: '#C98A1B' },
  proxima:   { label: 'Próxima (1-2m)',   color: '#185FA5' },
  futura:    { label: 'Futura (3-4m)',    color: '#1D9E75' },
  lejana:    { label: 'Lejana (>4m)',     color: '#73726c' }
}

export const TIPOS_ACTIVIDAD = {
  llamada:    'Llamada',
  whatsapp:   'WhatsApp',
  email:      'Email',
  presencial: 'Atención presencial',
  // Etiquetas heredadas (solo para mostrar registros antiguos):
  visita:       'Visita',
  propuesta:    'Propuesta',
  agendamiento: 'Agendamiento'
}
// Opciones que se pueden elegir al registrar un contacto (acciones ya ejecutadas)
export const TIPOS_CONTACTO = ['llamada', 'whatsapp', 'email', 'presencial']

export const RESULTADOS = {
  pendiente:         'Pendiente de contacto',
  no_contesta:       'No contesta',
  numero_erroneo:    'Número erróneo',
  interesado:        'Interesado',
  cotizacion_enviada:'Cotización enviada',
  compromiso:        'Comprometió visita',
  agendado:          'Agendó hora',
  fidelizado:        'Cliente conforme (postventa)',
  reagendar:         'Reagendar / volver a llamar',
  no_interesado:     'No interesado por ahora',
  no_desea_contacto: 'No desea ser contactado',
  exitosa:           'Cerrada / vendida'
}

export const segLabel = (s) => SEGMENTOS[s]?.label || '—'
export const segColor = (s) => SEGMENTOS[s]?.color || '#73726c'

export const ESTADOS_PRESUPUESTO = {
  borrador:        { label: 'Borrador',        color: '#73726c' },
  enviado:         { label: 'Enviado',         color: '#185FA5' },
  en_seguimiento:  { label: 'En seguimiento',  color: '#C98A1B' },
  aprobado:        { label: 'Aprobado',        color: '#1D9E75' },
  rechazado:       { label: 'Rechazado',       color: '#A32D2D' },
  vencido:         { label: 'Vencido',         color: '#94a3b8' }
}

// ---- v4: Tipo de cliente (Empresa / Persona / Interno) --------------
export const TIPOS_CLIENTE = {
  EMPRESA: 'Empresa',
  PERSONA: 'Persona',
  INTERNO: 'Interno'
}
// Mapea valores antiguos ('PARTICULAR') al nuevo etiquetado.
export const tipoClienteLabel = (t) => {
  if (!t) return '—'
  if (t === 'PARTICULAR') return 'Persona'
  return TIPOS_CLIENTE[t] || t
}

// ---- v4: Orden canónico de la línea de tiempo de gestión ------------
// Se usa para resaltar el avance del cliente en su ficha. Si la BD tiene
// la columna 'clave' (migración 08), se respeta; si no, se cae al 'orden'.
export const ETAPAS_ORDEN = [
  'asignado', 'pendiente', 'contactado', 'interesado',
  'cotizacion', 'agendado', 'servicio', 'seguimiento'
]
// Etapas marcadas como opcionales en la línea de tiempo
export const ETAPAS_OPCIONALES = ['cotizacion']

// ---- v5: Construye la URL del Registro de OT con datos prellenados ---
// - Normaliza el esquema (si falta https://, lo antepone).
// - Agrega los datos del cliente/vehículo como parámetros de consulta.
export function buildOtUrl(base, params = {}) {
  if (!base) return ''
  let url = String(base).trim()
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  const qs = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url
}

// ---- v5: Formatea un RUT chileno -> 12.345.678-9 --------------------
// Limpia, agrupa miles con punto y antepone el dígito verificador con guion.
// No valida el DV; solo homologa el formato al del formulario de OT.
export function formatRut(rut) {
  if (!rut) return ''
  const limpio = String(rut).replace(/[^0-9kK]/g, '').toUpperCase()
  if (limpio.length < 2) return limpio
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  const conPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${conPuntos}-${dv}`
}

// ---- v6: Formato de teléfono (+56 9 XXXX XXXX / +54 …) ---------------
// Detecta código país (56 Chile, 54 Argentina; por defecto 56) y agrupa.
export function formatTelefono(raw) {
  if (!raw) return ''
  let d = String(raw).replace(/\D/g, '')
  if (!d) return String(raw).trim()
  if (d.startsWith('00')) d = d.slice(2)
  let cc = ''
  if (d.startsWith('56')) { cc = '56'; d = d.slice(2) }
  else if (d.startsWith('54')) { cc = '54'; d = d.slice(2) }
  else cc = '56'
  d = d.replace(/^0+/, '')               // quita ceros de larga distancia
  let movil = ''
  if (d.startsWith('9') && d.length >= 9) { movil = '9'; d = d.slice(1) }
  else if (cc === '56' && d.length === 8) { movil = '9' } // celular sin el 9
  const grupos = []
  let resto = d
  while (resto.length > 4) { grupos.push(resto.slice(0, 4)); resto = resto.slice(4) }
  if (resto) grupos.push(resto)
  const num = [movil, ...grupos].filter(Boolean).join(' ')
  return `+${cc} ${num}`.trim()
}

// ---- v6: Formato de patente (XX XX XX) ------------------------------
export function formatPatente(raw) {
  if (!raw) return ''
  const limpio = String(raw).replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return limpio.replace(/(.{2})(?=.)/g, '$1 ').trim()
}
export const patenteLimpia = (p) => String(p || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()

// ---- v6: Catálogo de marcas de vehículos ----------------------------
export const MARCAS_VEHICULO = [
  'TOYOTA', 'CHEVROLET', 'HYUNDAI', 'KIA', 'NISSAN', 'SUZUKI', 'MAZDA',
  'MITSUBISHI', 'FORD', 'VOLKSWAGEN', 'PEUGEOT', 'RENAULT', 'HONDA',
  'SUBARU', 'CHERY', 'GREAT WALL', 'HAVAL', 'MG', 'JAC', 'CHANGAN',
  'CITROEN', 'FIAT', 'JEEP', 'BMW', 'MERCEDES-BENZ', 'AUDI', 'VOLVO',
  'DODGE', 'RAM', 'SSANGYONG', 'ISUZU', 'BYD', 'DFSK', 'MAXUS', 'FOTON',
  'BAIC', 'GEELY', 'DONGFENG', 'JETOUR'
]

// ---- v6: Tipo de servicio solicitado (catálogo) ---------------------
export const TIPOS_SERVICIO = {
  mantencion_basica:     'Mantención básica',
  mantencion_intermedia: 'Mantención intermedia',
  mantencion_mayor:      'Mantención mayor',
  frenos:                'Frenos',
  embrague:              'Embrague',
  suspension:            'Suspensión / dirección',
  distribucion:          'Distribución / correa',
  motor:                 'Motor',
  diagnostico:           'Diagnóstico / escáner',
  electrico:             'Sistema eléctrico',
  aire:                  'Aire acondicionado',
  neumaticos:            'Neumáticos / alineación',
  dyp:                   'Desabolladura y pintura',
  revision_tecnica:      'Revisión técnica',
  otro:                  'Otro'
}
export const tipoServicioLabel = (t) => t ? (TIPOS_SERVICIO[t] || t) : '—'

// ---- v6: Mapa resultado de actividad -> etapa de gestión (clave) ----
// Al registrar una actividad, el estado del cliente avanza a esta etapa
// (nunca retrocede, salvo 'perdido'). null = no cambia el estado.
export const RESULTADO_A_ETAPA = {
  pendiente:          'pendiente',
  no_contesta:        'pendiente',
  numero_erroneo:     null,
  interesado:         'interesado',
  cotizacion_enviada: 'cotizacion',
  compromiso:         'interesado',
  agendado:           'agendado',
  fidelizado:         'seguimiento',
  reagendar:          'contactado',
  no_interesado:      'contactado',
  no_desea_contacto:  'perdido',
  exitosa:            'servicio'
}

// ---- v9: Colores sobrios por tipo de gestión (para el calendario) ---
export const COLOR_ACTIVIDAD = {
  llamada:      '#2C5A72',  // azul acero
  visita:       '#1D7A5F',  // verde bosque
  agendamiento: '#B07A2E',  // ámbar tostado
  propuesta:    '#7A5C8E',  // morado apagado
  email:        '#5B6B8C',  // azul pizarra
  whatsapp:     '#3B7A57'   // verde mar
}
export const colorActividad = (t) => COLOR_ACTIVIDAD[t] || '#64748b'

// Combina fecha + hora ('HH:MM') para mostrar agendamientos
export const fmtHora = (h) => h ? String(h).slice(0, 5) : ''

// ---- v10: Estados del ciclo de vida de una GESTIÓN ------------------
export const ESTADOS_GESTION = {
  pendiente_contacto:    { label: 'Pendiente de contacto', color: '#94a3b8', cierre: false },
  en_seguimiento:        { label: 'En seguimiento',        color: '#5B9BB5', cierre: false },
  agendada:              { label: 'Agendada',              color: '#B07A2E', cierre: false },
  asistio:               { label: 'Cliente asistió',       color: '#185FA5', cierre: false },
  en_taller:             { label: 'En taller',             color: '#1f9d57', cierre: false },
  presupuesto_entregado: { label: 'Presupuesto entregado', color: '#7A5C8E', cierre: false },
  pendiente_decision:    { label: 'Pendiente decisión',    color: '#C98A1B', cierre: false },
  cerrada_ganada:        { label: 'Venta cerrada',         color: '#1D9E75', cierre: true },
  cerrada_perdida:       { label: 'Finalizada sin éxito',  color: '#A32D2D', cierre: true }
}
export const estadoGestionLabel = (e) => ESTADOS_GESTION[e]?.label || e
export const estadoGestionColor = (e) => ESTADOS_GESTION[e]?.color || '#64748b'
export const ES_CIERRE = Object.entries(ESTADOS_GESTION)
  .filter(([, v]) => v.cierre).map(([k]) => k)

// ---- v10: Tipo de AGENDAMIENTO (acción futura) — colorea el calendario
export const TIPOS_AGENDA = {
  llamada:             { label: 'Llamada',                color: '#2C5A72' }, // azul
  visita_taller:       { label: 'Visita al taller',       color: '#1D7A5F' }, // verde
  entrega_presupuesto: { label: 'Entrega de presupuesto', color: '#7A5C8E' }, // morado
  revision_cortesia:   { label: 'Revisión de cortesía',   color: '#C77D2E' }, // naranja
  whatsapp:            { label: 'WhatsApp',               color: '#9AA4B2' }, // gris claro
  email:               { label: 'Email',                  color: '#334155' }  // gris oscuro
}
export const agendaLabel = (t) => TIPOS_AGENDA[t]?.label || 'Agendamiento'
export const colorAgenda = (t) => TIPOS_AGENDA[t]?.color || '#64748b'

// ---- v11: Motivos de cierre de una gestión -------------------------
export const MOTIVOS_CIERRE = {
  venta_concretada: 'Venta concretada',
  trabajo_realizado: 'Trabajo realizado',
  cliente_rechazo: 'Cliente rechazó',
  no_volvera: 'No volverá al taller',
  cerrada_ejecutivo: 'Cerrada por el ejecutivo'
}
export const motivoCierreLabel = (m) => MOTIVOS_CIERRE[m] || m || '—'

// ---- v11: Estados de campaña (ciclo de vida) -----------------------
export const ESTADOS_CAMPANA = {
  borrador:   { label: 'Borrador',   color: '#73726c', operativa: false },
  activa:     { label: 'Activa',     color: '#1D9E75', operativa: true  },
  pausada:    { label: 'Pausada',    color: '#C98A1B', operativa: false },
  finalizada: { label: 'Finalizada', color: '#185FA5', operativa: false },
  archivada:  { label: 'Archivada',  color: '#9AA4B2', operativa: false },
  completada: { label: 'Finalizada', color: '#185FA5', operativa: false } // alias heredado
}
export const estadoCampanaLabel = (e) => ESTADOS_CAMPANA[e]?.label || e
export const estadoCampanaColor = (e) => ESTADOS_CAMPANA[e]?.color || '#64748b'

// ---- v12: Estados de un envío de email -----------------------------
export const ESTADOS_EMAIL = {
  enviado:     { label: 'Enviado',     color: '#94a3b8' },
  entregado:   { label: 'Entregado',   color: '#5B9BB5' },
  abierto:     { label: 'Abierto',     color: '#185FA5' },
  click:       { label: 'Clic',        color: '#1D9E75' },
  rebote:      { label: 'Rebote',      color: '#A32D2D' },
  no_suscrito: { label: 'No suscrito', color: '#C98A1B' },
  spam:        { label: 'Spam',        color: '#7A5C8E' }
}
export const estadoEmailLabel = (e) => ESTADOS_EMAIL[e]?.label || e
export const estadoEmailColor = (e) => ESTADOS_EMAIL[e]?.color || '#64748b'

// ---- v14: Catálogos dinámicos por empresa --------------------------
// Reemplaza EN SITIO el contenido de los catálogos por los del tenant,
// conservando la misma referencia para que todas las páginas que ya los
// importan los vean actualizados. Si un catálogo no viene, se conserva
// el valor por defecto (fallback seguro).
function _reemplazar(obj, nuevo) {
  Object.keys(obj).forEach((k) => delete obj[k])
  Object.assign(obj, nuevo)
}
export function cargarCatalogos(c = {}) {
  if (c.segmentos      && Object.keys(c.segmentos).length)      _reemplazar(SEGMENTOS, c.segmentos)
  if (c.tiposServicio  && Object.keys(c.tiposServicio).length)  _reemplazar(TIPOS_SERVICIO, c.tiposServicio)
  if (c.tiposAgenda    && Object.keys(c.tiposAgenda).length)    _reemplazar(TIPOS_AGENDA, c.tiposAgenda)
  if (c.estadosGestion && Object.keys(c.estadosGestion).length) {
    _reemplazar(ESTADOS_GESTION, c.estadosGestion)
    ES_CIERRE.length = 0
    Object.entries(ESTADOS_GESTION).forEach(([k, v]) => { if (v.cierre) ES_CIERRE.push(k) })
  }
}

// ====================================================================
// MÓDULO OT — réplica fiel del formato de la app de registro (v5.6)
// ====================================================================
export const OT_TIPO_INGRESO = ['Normal', 'Convenio', 'Garantía Mano de Obra', 'Garantía Repuestos']
export const OT_ES_GARANTIA = (t) => t === 'Garantía Mano de Obra' || t === 'Garantía Repuestos'
export const OT_TIPO_CLIENTE = ['Particular', 'Empresa', 'Interno']
export const OT_ESTADO_VEHICULO = ['Entregado', 'Devolución']
export const OT_TIPO_DOCUMENTO = ['Boleta', 'Factura', 'Sin Documento']

export const OT_SVC_TALLER = ['MAN X PAUTA','MAN BASICA','EMBRAGUE','AMORTIGUADOR','CORREAS','DISTRIBUCION','REFRIGERACION','A/C RECARGA','A/C REPARACION','INYECCION','DPF','MOTOR REPARACION','MOTOR REEMPLAZO','ADMISION EGR','ALTERNADOR','ARRANQUE','FRENOS','TREN DELANTERO','DIAGNOSTICO','OTROS TALLER']
export const OT_SVC_SR = ['REV EXPRESS','REV PREVENTIVA','CAMBIO DE ACEITE','VULCANIZACION','BALANCEO','ESCANER','ALINEACION','OTROS SERVICIO RÁPIDO']
export const OT_SVC_DYP = ['DESABOLLADURA Y PINTURA','SINIESTRO ROBO','LIMPIEZA VEHICULO','LIMPIEZA DE MOTOR','LAVADO DE TAPIZ','PULIDO Y ENCERADO','OTROS DYP']
export const OT_SVC_GRUPOS = [
  { bu: 'Taller Mecánico', items: OT_SVC_TALLER },
  { bu: 'Servicio Rápido', items: OT_SVC_SR },
  { bu: 'DyP', items: OT_SVC_DYP }
]
export const otBU = (svc) =>
  OT_SVC_DYP.includes(svc) ? 'DyP' :
  OT_SVC_SR.includes(svc) ? 'Servicio Rápido' :
  OT_SVC_TALLER.includes(svc) ? 'Taller Mecánico' : null

export const OT_MARCAS = ['Toyota','Hyundai','Nissan','Suzuki','Chevrolet','Kia','Mitsubishi','Ford','Peugeot','Mazda','SsangYong','Subaru','JAC','Changan','Jeep','Chery','Volkswagen','Renault','Great Wall','Mahindra','MG','Samsung','Honda','Maxus','BAIC','Fiat','Dodge','RAM','Geely']
export const OT_CIUDADES = ['La Serena','Coquimbo','Ovalle','Vicuña','Illapel','Salamanca','Los Vilos','Andacollo','Monte Patria','Punitaqui','Canela','Santiago','Viña del Mar','Antofagasta','Temuco','Puerto Montt']

// Dinero estilo es-CL (1.234.567)
export const fmtMiles = (n) => (Number(n) || 0).toLocaleString('es-CL')
// Total reparación = repuestos + lubricantes + MO + servicio externo − descuento (mín. 0)
export const otTotal = (m) =>
  Math.max(0, (+m.repuestos || 0) + (+m.lubricantes || 0) + (+m.mo || 0) + (+m.servicioExterno || 0) - (+m.descuento || 0))

// Teléfono chileno: "+56 9 XXXX XXXX" (misma regla que la app de OT)
export function fmtFonoOT(value) {
  const v = String(value || '').replace(/\s/g, '')
  if (/^9\d{7,8}$/.test(v)) { const d = v.slice(1).slice(-8); return '+56 9 ' + d.slice(0, 4) + ' ' + d.slice(4) }
  if (/^\d{8}$/.test(v)) return '+56 9 ' + v.slice(0, 4) + ' ' + v.slice(4)
  if (v.startsWith('+569')) { const d = v.slice(4).slice(0, 8); return '+56 9 ' + d.slice(0, 4) + ' ' + d.slice(4) }
  return value || ''
}

// ---- OT · técnicos, encuesta y "cómo conoció" (réplica fiel) -------
export const OT_TECNICOS = ['Ignacio', 'Shelmy', 'Felipe', 'Sergio', 'Gabriel', 'Javier', 'Wilson', 'Alexis', 'Andrés']
export const OT_CONOCIO = [
  { v: 'Recomendación', e: '🗣️' }, { v: 'Video de Instagram', e: '📸' },
  { v: 'Facebook', e: '📘' }, { v: 'Google', e: '🔍' },
  { v: 'De paso', e: '🚶' }, { v: 'Radio', e: '📻' }, { v: 'Otro', e: '💬' }
]
export const OT_ENCUESTA = [
  { k: 'enc_p1', n: 1, titulo: '¿Su vehículo fue entregado justo a tiempo?', izq: 'No fue entregado a tiempo', der: 'Entregado a tiempo' },
  { k: 'enc_p2', n: 2, titulo: '¿Cómo fue la atención al cliente?', izq: 'Mala atención', der: 'Excelente atención' },
  { k: 'enc_p3', n: 3, titulo: '¿Cómo califica el servicio mecánico realizado vs. servicios anteriores?', izq: 'Mal servicio', der: 'Excelente servicio' },
  { k: 'enc_p4', n: 4, titulo: '¿Recomendaría nuestros servicios?', izq: 'No lo recomiendo', der: 'Sí lo recomiendo' }
]

// ====================================================================
// MÓDULO TALLER — pipeline operativo, tareas y notificaciones
// ====================================================================
export const ESTADOS_TALLER = {
  por_designar:     { label: 'Por designar',            color: '#94a3b8' },
  revision:         { label: 'En revisión / diagnóstico', color: '#7A5C8E' },
  esperando_aprobacion: { label: 'Presupuesto en cliente', color: '#C98A1B' },
  en_reparacion:    { label: 'En reparación',           color: '#2f6fb0' },
  servicio_externo: { label: 'En rep. servicio externo',color: '#b46bc7' },
  compra_repuestos: { label: 'Compra de repuestos',     color: '#3b82c4' },
  pintura_dyp:      { label: 'Pintura/Desabolladura',   color: '#1aa88a' },
  lavado:           { label: 'Lavado',                  color: '#8a8f98' },
  alineacion:       { label: 'Alineación',              color: '#4aa3df' },
  prueba_ruta:      { label: 'Prueba en ruta',          color: '#6b7a8a' },
  retroceso:        { label: 'Retroceso',               color: '#5b6470' },
  listo_entrega:    { label: 'Listo para entrega',      color: '#b0603a' },
  completada:       { label: 'Completada',              color: '#1f9d57' }
}
export const PRIORIDADES_TALLER = {
  normal:  { label: 'Normal',  color: '#94a3b8' },
  alta:    { label: 'Alta',    color: '#e0a020' },
  urgente: { label: 'Urgente', color: '#e0382b' }
}
export const ESTADOS_PRESUP_TALLER = {
  solicitado: { label: 'Solicitado', color: '#94a3b8' },
  cotizando:  { label: 'Cotizando',  color: '#4aa3df' },
  enviado:    { label: 'Enviado al cliente', color: '#B07A2E' },
  aprobado:   { label: 'Aprobado',   color: '#1f9d57' },
  rechazado:  { label: 'Rechazado',  color: '#e0382b' },
  parcial:    { label: 'Entrega parcial', color: '#7A5C8E' }
}
export const ROLES_TALLER = ['jefe_taller', 'tecnico', 'coordinador_adquisiciones', 'encargado_bodega']
// hh:mm:ss para cronómetros
export const fmtCrono = (seg) => {
  const s = Math.max(0, Math.floor(seg || 0))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0')
}

// ====================================================================
// v21 — Tipo de vehículo, secciones de presupuesto y utilitarios
// ====================================================================
export const TIPOS_VEHICULO = ['AUTO', 'SUV', 'PICK UP', 'VAN/FURGON/CAMION']

// Secciones del presupuesto (formato oficial DIDIAL). Los tipos antiguos
// (lubricante/filtro/consumible) se agrupan bajo "Lubricantes y Otros Insumos".
export const SECCIONES_PRESUP = {
  repuesto:         'Repuestos',
  insumo:           'Lubricantes y Otros Insumos',
  mano_obra:        'Mano de Obra',
  servicio_externo: 'Servicios Externos'
}
export const seccionDe = (tipo) =>
  ['lubricante', 'filtro', 'consumible', 'insumo'].includes(tipo) ? 'insumo'
  : SECCIONES_PRESUP[tipo] ? tipo : 'repuesto'

// Nombre completo (nombres + apellidos, con fallback a registros antiguos)
export const nombreCompleto = (c) => [c?.nombre, c?.apellidos].filter(Boolean).join(' ').trim()

// IVA chileno: los precios de la base van con IVA incluido.
// El presupuesto impreso desglosa NETO / IVA / TOTAL hacia atrás.
export const IVA_PCT = 19
export const desgloseIVA = (total) => {
  const neto = Math.round((+total || 0) / (1 + IVA_PCT / 100))
  return { neto, iva: (+total || 0) - neto, total: +total || 0 }
}

// Envía un payload a un Apps Script (form POST + iframe oculto, sin CORS).
// Mismo mecanismo que la app de registro de OT. Fire-and-forget.
export function enviarASheet(url, data) {
  return new Promise((resolve) => {
    if (!url) return resolve(false)
    const frameName = 'ot_sheet_' + Date.now() + '_' + Math.floor(Math.random() * 1e4)
    const iframe = document.createElement('iframe')
    iframe.name = frameName; iframe.style.display = 'none'
    document.body.appendChild(iframe)
    const form = document.createElement('form')
    form.method = 'POST'; form.action = url; form.target = frameName
    const input = document.createElement('input')
    input.type = 'hidden'; input.name = 'payload'; input.value = JSON.stringify(data)
    form.appendChild(input); document.body.appendChild(form)
    let hecho = false
    const limpiar = () => { if (hecho) return; hecho = true; try { form.remove(); iframe.remove() } catch {} ; resolve(true) }
    iframe.onload = () => setTimeout(limpiar, 300)
    setTimeout(limpiar, 2500)
    form.submit()
  })
}


// ====================================================================
// v27 — Roles ampliados y sucursal por asesor
// ====================================================================
export const ROLES_USUARIO = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  asesor_toyota: 'Asesor Toyota',
  asesor_multimarca: 'Asesor Multimarca',
  supervisor: 'Supervisor',
  postventa: 'Postventa',
  jefe_taller: 'Jefe de Taller',
  tecnico: 'Técnico',
  coordinador_adquisiciones: 'Encargado de Presupuestos / Adquisiciones',
  encargado_bodega: 'Encargado de Bodega',
  asistente_administrativo: 'Asistente Administrativo',
  asistente_bodega: 'Asistente de Bodega'
}
export const rolLabel = (r) => ROLES_USUARIO[r] || r || '—'

// Roles con función de asesor comercial (cartera de clientes, ficha, OT)
export const ROLES_ASESOR = ['vendedor', 'asesor_toyota', 'asesor_multimarca']
export const esRolAsesor = (rol) => ROLES_ASESOR.includes(rol)

// Sucursal fija según quién ingresa la OT: por rol, con respaldo por
// nombre para los asesores actuales (Diego Leyton = Toyota; David Rivera
// y Matías Ponce = Multimarca).
export const sucursalDeAsesor = (perfil) => {
  if (perfil?.rol === 'asesor_toyota') return 'Toyota'
  if (perfil?.rol === 'asesor_multimarca') return 'Multimarca'
  const n = (perfil?.nombre || '').toLowerCase()
  if (n.includes('diego') && n.includes('leyton')) return 'Toyota'
  if ((n.includes('david') && n.includes('rivera')) || (n.includes('matias') && n.includes('ponce')) || (n.includes('matías') && n.includes('ponce'))) return 'Multimarca'
  return null // sin sucursal fija: el usuario elige (ej. admin)
}
