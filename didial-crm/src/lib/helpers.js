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
  pendiente:     'Pendiente',
  exitosa:       'Exitosa',
  no_contesta:   'No contesta',
  interesado:    'Interesado',
  no_interesado: 'No interesado',
  agendado:      'Agendó',
  reagendar:     'Reagendar'
}

export const segLabel = (s) => SEGMENTOS[s]?.label || '—'
export const segColor = (s) => SEGMENTOS[s]?.color || '#73726c'
