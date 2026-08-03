/* ============================================================================
   Benchmarks de gestión · postventa automotriz
   ----------------------------------------------------------------------------
   Fuente: "DIDIAL_KPI_Comercial_Operativo.xlsx" — batería de indicadores
   construida a partir de literatura de gestión de postventa y del estudio de
   industria de julio 2026 (mercado La Serena–Coquimbo).

   ADVERTENCIA QUE VIAJA CON EL DATO (textual del archivo de origen):
   los rangos son órdenes de magnitud de gestión, NO percentiles calculados
   sobre una muestra de talleres chilenos comparables. Se usan como referencia
   de dirección, no como umbral contractual. Esta advertencia se imprime en los
   informes; no debe eliminarse al mostrar los indicadores.
   ========================================================================== */

export const FUENTE_BENCHMARKS =
  'Literatura de gestión de postventa + estudio de industria La Serena–Coquimbo (julio 2026). ' +
  'Órdenes de magnitud de gestión, no percentiles de una muestra de talleres chilenos comparables.'

/* Estados posibles, alineados al código del archivo de origen */
export const ESTADO = {
  ok: { k: 'ok', label: 'En meta', color: '#1f9d57', bg: '#e8f6ee' },
  vigilar: { k: 'vigilar', label: 'Vigilar', color: '#e0a020', bg: '#fdf6e3' },
  fuera: { k: 'fuera', label: 'Fuera de meta', color: '#e0382b', bg: '#fdecea' },
  nd: { k: 'nd', label: 'No medible', color: '#6b7a8a', bg: '#f1f5f9' }
}

/* ----------------------------------------------------------------------------
   Definición de cada indicador.
   - meta / alerta: textos tal como aparecen en el tablero de origen.
   - evaluar(v): devuelve la clave de estado. Recibe el valor ya calculado.
   - dir: 'alto' (más es mejor) | 'bajo' (menos es mejor) | 'rango'.
   - nota: observación de gestión (qué significa y qué hacer).
-------------------------------------------------------------------------------*/
export const KPIS = {
  ticket: {
    label: 'Ticket promedio',
    unidad: '$',
    meta: 'Crecer sobre el IPC',
    alerta: 'Caída real 2 meses seguidos',
    dir: 'alto',
    // Sin serie de IPC en el sistema, solo se compara contra la meta interna.
    evaluar: (v, ctx) => v >= (ctx?.metaTicket || 0) ? 'ok' : 'vigilar',
    nota: 'Compare siempre contra el IPC del período: subir 3% con inflación de 4,2% es caer en términos reales.'
  },
  moSobreVenta: {
    label: 'Mano de obra sobre venta',
    unidad: '%',
    meta: '40% – 48%',
    alerta: 'Bajo 35%',
    dir: 'rango',
    evaluar: (v) => v < 35 ? 'fuera' : (v >= 40 && v <= 48) ? 'ok' : 'vigilar',
    nota: 'Es la parte del ingreso que no depende del proveedor y donde el margen es más alto.'
  },
  repSobreVenta: {
    label: 'Repuestos y lubricantes sobre venta',
    unidad: '%',
    meta: '50% – 58%',
    alerta: 'Sobre 62%',
    dir: 'rango',
    evaluar: (v) => v > 62 ? 'fuera' : (v >= 50 && v <= 58) ? 'ok' : 'vigilar',
    nota: 'Un peso creciente indica desplazamiento hacia el negocio de menor margen.'
  },
  sinTipoServicio: {
    label: 'Órdenes sin tipo de servicio',
    unidad: '%',
    meta: 'Bajo 5%',
    alerta: 'Sobre 15%',
    dir: 'bajo',
    evaluar: (v) => v > 15 ? 'fuera' : v < 5 ? 'ok' : 'vigilar',
    nota: 'Una OT sin tipo de servicio no se puede analizar ni usar para armar una campaña.'
  },
  covKm: {
    label: 'Cobertura de kilometraje',
    unidad: '%',
    meta: 'Sobre 95%',
    alerta: 'Bajo 80%',
    dir: 'alto',
    evaluar: (v) => v < 80 ? 'fuera' : v > 95 ? 'ok' : 'vigilar',
    nota: 'Sin kilometraje no se puede calcular cuándo toca la próxima mantención.'
  },
  covContacto: {
    label: 'Cobertura de contacto',
    unidad: '%',
    meta: 'Sobre 90%',
    alerta: 'Bajo 70%',
    dir: 'alto',
    evaluar: (v) => v < 70 ? 'fuera' : v > 90 ? 'ok' : 'vigilar',
    nota: 'Sin contacto no hay campaña de retorno. Es el habilitador de todo el bloque de retención.'
  },
  frecuencia: {
    label: 'Frecuencia de visita',
    unidad: 'veces',
    meta: '1,8 – 2,4',
    alerta: 'Bajo 1,3',
    dir: 'rango',
    evaluar: (v) => v < 1.3 ? 'fuera' : (v >= 1.8 && v <= 2.4) ? 'ok' : 'vigilar',
    nota: 'Define cuántas veces se le puede vender al mismo parque sin captar a nadie.'
  },
  unaVisita: {
    label: 'Vehículos de una sola visita',
    unidad: '%',
    meta: 'Bajo 40%',
    alerta: 'Sobre 55%',
    dir: 'bajo',
    evaluar: (v) => v > 55 ? 'fuera' : v < 40 ? 'ok' : 'vigilar',
    nota: 'Es la lectura cruda de la fuga de clientes.'
  },
  clienteEmpresa: {
    label: 'Peso del cliente empresa',
    unidad: '%',
    meta: '20% – 35%',
    alerta: 'Bajo 10%',
    dir: 'rango',
    evaluar: (v) => v < 10 ? 'fuera' : (v >= 20 && v <= 35) ? 'ok' : 'vigilar',
    nota: 'El cliente empresa nivela la agenda y reduce la estacionalidad.'
  },
  concentracion: {
    label: 'Concentración de clientes (top 5)',
    unidad: '%',
    meta: 'Bajo 25%',
    alerta: 'Sobre 40%',
    dir: 'bajo',
    evaluar: (v) => v > 40 ? 'fuera' : v < 25 ? 'ok' : 'vigilar',
    nota: 'Riesgo de dependencia, relevante sobre todo en flota y aseguradoras.'
  },
  mixCentro: {
    label: 'Mix por centro de ingreso',
    unidad: '%',
    meta: 'Ningún centro sobre 70%',
    alerta: 'Un centro sobre 80%',
    dir: 'bajo',
    evaluar: (v) => v > 80 ? 'fuera' : v > 70 ? 'vigilar' : 'ok',
    nota: 'Mide dependencia de un solo centro de ingreso.'
  },
  permanencia: {
    label: 'Permanencia promedio',
    unidad: 'días',
    meta: '1 día o menos (mecánica)',
    alerta: 'Sobre 2 días',
    dir: 'bajo',
    // Umbrales definidos por administración DIDIAL: >5 días malo, >=2 días alerta.
    evaluar: (v) => v > 5 ? 'fuera' : v >= 2 ? 'vigilar' : 'ok',
    nota: 'Cada día extra ocupa una bahía y retrasa la facturación.'
  },
  detenidos: {
    label: 'Vehículos sobre 5 días de permanencia',
    unidad: 'unidades',
    meta: 'Bajo 10% de las OT',
    alerta: 'Sobre 25% de las OT',
    dir: 'bajo',
    evaluar: (v, ctx) => {
      const pct = ctx?.totalOT ? v / ctx.totalOT * 100 : 0
      return pct > 25 ? 'fuera' : pct > 10 ? 'vigilar' : 'ok'
    },
    nota: 'Indicador de gestión diaria: se mira en la reunión de la mañana, no a fin de mes.'
  },
  garantias: {
    label: 'Garantías por sucursal',
    unidad: 'unidades',
    meta: 'Hasta 3 por sucursal al mes',
    alerta: 'Sobre 3 por sucursal',
    dir: 'bajo',
    evaluar: (v, ctx) => { const tope = ctx?.tope ?? 3; return v > tope ? 'fuera' : v === tope ? 'vigilar' : 'ok' },
    nota: 'El retrabajo consume capacidad ya cobrada y destruye confianza.'
  },
  conversion: {
    label: 'Conversión de presupuestos',
    unidad: '%',
    meta: 'Sobre 65%',
    alerta: 'Bajo 45%',
    dir: 'alto',
    evaluar: () => 'nd',
    nota: 'Los rechazos no se registran: un 100% aparente no significa nada. Habilitar el registro del rechazo con motivo.'
  },
  cumplimientoMeta: {
    label: 'Cumplimiento de metas de venta',
    unidad: '%',
    meta: 'Sobre 100%',
    alerta: 'Bajo 80%',
    dir: 'alto',
    evaluar: (v) => v >= 100 ? 'ok' : v >= 80 ? 'vigilar' : 'fuera',
    nota: 'Se evalúa contra la meta prorrateada por los meses equivalentes del período.'
  }
}

/** Evalúa un indicador y devuelve { estado, label, color, bg, meta, alerta, nota } */
export function evaluar(clave, valor, ctx) {
  const k = KPIS[clave]
  if (!k) return { ...ESTADO.nd, meta: '', alerta: '', nota: '' }
  const e = ESTADO[k.evaluar(valor, ctx)] || ESTADO.nd
  return { ...e, meta: k.meta, alerta: k.alerta, nota: k.nota, label: e.label, indicador: k.label }
}

/** Recomendación accionable según el estado. Solo devuelve texto si hay algo que hacer. */
export function recomendacion(clave, valor, ctx) {
  const r = evaluar(clave, valor, ctx)
  if (r.k === 'ok') return null
  const k = KPIS[clave]
  const RECS = {
    moSobreVenta: 'Revisar tarifa de mano de obra y tiempos cobrados frente al estándar.',
    repSobreVenta: 'Verificar margen de repuestos y si se está desplazando venta hacia el negocio de menor margen.',
    sinTipoServicio: 'Hacer obligatorio el campo Tipo de Servicio en la recepción; sin él la OT no se puede analizar ni convertir en campaña.',
    covKm: 'Incorporar la lectura de kilometraje al protocolo de recepción. Habilita el recordatorio de próxima mantención.',
    covContacto: 'Exigir teléfono o correo en la recepción. Sin contacto no existe campaña de retorno.',
    frecuencia: 'Activar recordatorios de mantención por kilometraje y tiempo sobre la cartera existente.',
    unaVisita: 'Diseñar campaña de recuperación sobre las patentes de una sola visita con contacto registrado.',
    clienteEmpresa: 'Prospectar flotas y convenios: el cliente empresa nivela la agenda y reduce estacionalidad.',
    concentracion: 'Diversificar cartera para reducir la dependencia de los mayores clientes.',
    mixCentro: 'Evaluar plan comercial propio para el centro de menor peso.',
    permanencia: 'Revisar programación, espera de repuestos y aprobación de presupuestos: son las tres causas típicas.',
    detenidos: 'Revisar caso a caso los vehículos sobre 5 días en la reunión diaria y liberar bahías.',
    garantias: 'Analizar la causa raíz de cada garantía y marcar la OT de retrabajo para poder costearla.',
    conversion: 'Habilitar el registro del presupuesto rechazado con su motivo. Hoy el indicador no se puede calcular.',
    ticket: 'Contrastar con el IPC del período antes de leerlo como crecimiento.',
    cumplimientoMeta: 'Revisar la meta prorrateada frente al avance de días del período.'
  }
  return { estado: r, texto: RECS[clave] || k.nota }
}
