export const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency', currency: 'CLP', maximumFractionDigits: 0
})

export const fmtCLP = (n) => CLP.format(Number(n) || 0)

export const fmtFecha = (d) => {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('es-CL') } catch { return d }
}

export const SEGMENTOS = {
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
  llamada:      'Llamada',
  propuesta:    'Propuesta',
  agendamiento: 'Agendamiento',
  visita:       'Visita',
  email:        'Email',
  whatsapp:     'WhatsApp'
}

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
