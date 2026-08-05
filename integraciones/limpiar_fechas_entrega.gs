/**
 * DIDIAL · Limpieza de la columna Fecha de Entrega
 * ------------------------------------------------------------------------------
 * CRITERIO ACORDADO
 *   Si la fecha de entrega está VACÍA          → se usa la fecha de ingreso.
 *   Si la fecha de entrega es FALSA            → se usa la fecha de ingreso.
 *
 * QUÉ CUENTA COMO "FALSA" (cada caso se reporta por separado, no se mezclan)
 *   a) Año 1900 o anterior. Es el artefacto clásico de las hojas de cálculo:
 *      un 0 o una celda numérica vacía se interpreta como 30/12/1899.
 *   b) Año anterior al primer registro real de la base (por defecto, 2020).
 *   c) Fecha ANTERIOR a la de ingreso. Un vehículo no se entrega antes de entrar.
 *   d) Fecha absurdamente futura: más de 2 años por delante de hoy.
 *   e) Texto que no es una fecha reconocible.
 *
 * QUÉ NO TOCA
 *   - Filas sin fecha de ingreso: sin referencia no hay con qué reemplazar,
 *     así que se cuentan y se informan, pero se dejan como están.
 *   - Fechas de entrega posteriores a la de ingreso y dentro de rango: son
 *     válidas aunque la permanencia sea larga. No es tarea de este script
 *     decidir si 40 días de taller son razonables.
 *
 * SEGURIDAD
 *   - Antes de escribir, guarda el valor original en "Fecha Entrega Original".
 *     Solo la primera vez, para que dos pasadas no pierdan el dato real.
 *   - Reversible con limpiarFechasRevertir().
 *   - El paso de diagnóstico NO modifica nada: conviene correrlo primero.
 *
 * INSTALACIÓN
 *   Extensiones → Apps Script → Archivo nuevo → pegar → Guardar.
 *   Agrega el menú "DIDIAL · Fechas".
 */

const LF_HOJA        = 'Hoja 1';
const LF_C_INGRESO   = ['F. Ingreso', 'Fecha Ingreso', 'F Ingreso'];
const LF_C_ENTREGA   = ['Fecha Entrega', 'F. Entrega', 'Fecha de Entrega', 'F Entrega'];
const LF_BACKUP      = 'Fecha Entrega Original';

/** Año mínimo aceptable. Todo lo anterior se considera dato falso. */
const LF_ANIO_MIN    = 2020;
/** Margen hacia el futuro, en años. */
const LF_ANIOS_FUTURO = 2;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('DIDIAL · Fechas')
    .addItem('1. Diagnosticar Fecha de Entrega', 'limpiarFechasDiagnostico')
    .addItem('2. Limpiar Fecha de Entrega', 'limpiarFechasAplicar')
    .addItem('Revertir limpieza', 'limpiarFechasRevertir')
    .addToUi();
}

/* ------------------------------ utilidades ------------------------------ */

function lfNorm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

function lfIdx(cab, cands) {
  for (var i = 0; i < cands.length; i++) {
    var j = cab.indexOf(cands[i]);
    if (j >= 0) return j;
  }
  var n = cab.map(function (h) { return lfNorm(h); });
  for (var k = 0; k < cands.length; k++) {
    var j2 = n.indexOf(lfNorm(cands[k]));
    if (j2 >= 0) return j2;
  }
  return -1;
}

function lfHoja() {
  var sh = SpreadsheetApp.getActive().getSheetByName(LF_HOJA);
  if (!sh) throw new Error('No existe la pestaña "' + LF_HOJA + '".');
  return sh;
}

/** Convierte a Date lo que venga (Date real, texto dd/mm/aaaa o aaaa-mm-dd). */
function lfFecha(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  var s = String(v || '').trim();
  if (!s) return null;

  // Número suelto: en una hoja de cálculo es un número de serie de fecha,
  // con época 30/12/1899. El 0 es justamente esa época, que es el origen del
  // clásico "año 1900". Sin este caso, new Date('0') daría el año 2000 y la
  // fila quedaría mal etiquetada (aunque igual se corrigiera).
  if (/^\d+(\.\d+)?$/.test(s)) {
    var serie = parseFloat(s);
    var base = new Date(1899, 11, 30);
    base.setDate(base.getDate() + Math.floor(serie));
    return isNaN(base.getTime()) ? null : base;
  }

  var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);   // dd/mm/aaaa
  if (m) {
    var a = parseInt(m[3], 10);
    if (a < 100) a += (a < 50 ? 2000 : 1900);
    var d = new Date(a, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    return isNaN(d.getTime()) ? null : d;
  }
  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);          // aaaa-mm-dd
  if (m) {
    var d2 = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    return isNaN(d2.getTime()) ? null : d2;
  }
  var d3 = new Date(s);
  return isNaN(d3.getTime()) ? null : d3;
}

/**
 * Clasifica la fecha de entrega respecto de la de ingreso.
 * Devuelve una de: 'ok' | 'vacia' | 'epoca1900' | 'anterior_min' |
 *                  'antes_ingreso' | 'futuro' | 'ilegible'
 */
function lfClasificar(entregaBruta, ingreso) {
  var s = String(entregaBruta || '').trim();
  if (!s) return 'vacia';

  var e = lfFecha(entregaBruta);
  if (!e) return 'ilegible';

  var a = e.getFullYear();
  if (a <= 1900) return 'epoca1900';
  if (a < LF_ANIO_MIN) return 'anterior_min';

  var limite = new Date();
  limite.setFullYear(limite.getFullYear() + LF_ANIOS_FUTURO);
  if (e > limite) return 'futuro';

  if (ingreso) {
    // se comparan solo las fechas, sin la hora
    var e0 = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    var i0 = new Date(ingreso.getFullYear(), ingreso.getMonth(), ingreso.getDate());
    if (e0 < i0) return 'antes_ingreso';
  }
  return 'ok';
}

var LF_ETIQUETA = {
  ok:            'Correcta',
  vacia:         'Vacía',
  epoca1900:     'Año 1900 o anterior (celda vacía interpretada como fecha)',
  anterior_min:  'Año anterior a ' + LF_ANIO_MIN,
  antes_ingreso: 'Anterior a la fecha de ingreso',
  futuro:        'Más de ' + LF_ANIOS_FUTURO + ' años en el futuro',
  ilegible:      'Texto no reconocible como fecha'
};

/* ------------------- PASO 1 · diagnóstico (no modifica) ----------------- */

function limpiarFechasDiagnostico() {
  var sh = lfHoja();
  var datos = sh.getDataRange().getValues();
  var cab = datos[0];
  var cI = lfIdx(cab, LF_C_INGRESO), cE = lfIdx(cab, LF_C_ENTREGA);
  if (cI < 0) throw new Error('No se encontró la columna de fecha de ingreso.');
  if (cE < 0) throw new Error('No se encontró la columna de fecha de entrega.');

  var conteo = {}, sinIngreso = 0, ejemplos = {};
  for (var i = 1; i < datos.length; i++) {
    var ing = lfFecha(datos[i][cI]);
    var cls = lfClasificar(datos[i][cE], ing);
    conteo[cls] = (conteo[cls] || 0) + 1;
    if (cls !== 'ok' && cls !== 'vacia' && !ejemplos[cls]) {
      ejemplos[cls] = 'fila ' + (i + 1) + ': "' + String(datos[i][cE]) + '"';
    }
    if (!ing && cls !== 'ok') sinIngreso++;
  }

  var total = datos.length - 1;
  var lineas = ['Filas analizadas: ' + total, ''];
  Object.keys(LF_ETIQUETA).forEach(function (k) {
    if (!conteo[k]) return;
    lineas.push(LF_ETIQUETA[k] + ': ' + conteo[k] +
                (ejemplos[k] ? '   (' + ejemplos[k] + ')' : ''));
  });
  var aCorregir = total - (conteo.ok || 0);
  lineas.push('');
  lineas.push('Se corregirían ' + aCorregir + ' filas.');
  if (sinIngreso) {
    lineas.push('De esas, ' + sinIngreso + ' NO tienen fecha de ingreso: se dejarán como están, ' +
                'porque no hay con qué reemplazarlas.');
  }
  lineas.push('');
  lineas.push('Este paso no modificó nada.');

  SpreadsheetApp.getUi().alert(lineas.join('\n'));
  Logger.log(lineas.join('\n'));
}

/* ------------------- PASO 2 · aplicar ----------------------------------- */

function limpiarFechasAplicar() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Limpiar Fecha de Entrega',
      'Las fechas vacías o falsas se reemplazarán por la fecha de ingreso.\n' +
      'El valor original se guarda en "' + LF_BACKUP + '".\n\n¿Continuar?',
      ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  var sh = lfHoja();
  var datos = sh.getDataRange().getValues();
  var cab = datos[0];
  var cI = lfIdx(cab, LF_C_INGRESO), cE = lfIdx(cab, LF_C_ENTREGA);
  if (cI < 0 || cE < 0) throw new Error('No se encontraron las columnas de fecha.');

  // Columna de respaldo al final, una sola vez
  var cB = lfIdx(cab, [LF_BACKUP]);
  if (cB < 0) {
    cB = cab.length;
    sh.getRange(1, cB + 1).setValue(LF_BACKUP).setFontWeight('bold');
    cab.push(LF_BACKUP);
  }

  var colE = [], colB = [], conteo = {}, corregidas = 0, omitidas = 0;
  for (var i = 1; i < datos.length; i++) {
    var ing = lfFecha(datos[i][cI]);
    var bruto = datos[i][cE];
    var respPrevio = cB < datos[i].length ? datos[i][cB] : '';
    var cls = lfClasificar(bruto, ing);
    conteo[cls] = (conteo[cls] || 0) + 1;

    if (cls === 'ok' || !ing) {
      // correcta, o sin fecha de ingreso con la cual reemplazar
      if (cls !== 'ok' && !ing) omitidas++;
      colE.push([bruto]);
      colB.push([respPrevio]);
    } else {
      colE.push([ing]);
      colB.push([respPrevio !== '' ? respPrevio : (String(bruto).trim() === '' ? '(vacía)' : bruto)]);
      corregidas++;
    }
  }

  var n = datos.length - 1;
  sh.getRange(2, cE + 1, n, 1).setValues(colE);
  sh.getRange(2, cB + 1, n, 1).setValues(colB);
  sh.getRange(2, cE + 1, n, 1).setNumberFormat('dd/mm/yyyy');

  var det = [];
  Object.keys(LF_ETIQUETA).forEach(function (k) {
    if (k !== 'ok' && conteo[k]) det.push('  · ' + LF_ETIQUETA[k] + ': ' + conteo[k]);
  });

  ui.alert(
    'Limpieza aplicada.\n\n' +
    'Filas corregidas: ' + corregidas + '\n' +
    (det.length ? 'Desglose de lo detectado:\n' + det.join('\n') + '\n' : '') +
    (omitidas ? '\nOmitidas por no tener fecha de ingreso: ' + omitidas + '\n' : '') +
    '\nLos valores originales quedaron en "' + LF_BACKUP + '".'
  );
}

/* ------------------- Reversión ------------------------------------------ */

function limpiarFechasRevertir() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Revertir', 'Se restaurará la Fecha de Entrega original en las filas con respaldo. ¿Continuar?',
      ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  var sh = lfHoja();
  var datos = sh.getDataRange().getValues();
  var cab = datos[0];
  var cE = lfIdx(cab, LF_C_ENTREGA), cB = lfIdx(cab, [LF_BACKUP]);
  if (cB < 0) { ui.alert('No hay columna de respaldo: no se ha aplicado ninguna limpieza.'); return; }

  var col = [], n = 0;
  for (var i = 1; i < datos.length; i++) {
    var r = datos[i][cB];
    var s = String(r || '').trim();
    if (s === '(vacía)') { col.push(['']); n++; }
    else if (s !== '') { col.push([r]); n++; }
    else { col.push([datos[i][cE]]); }
  }
  sh.getRange(2, cE + 1, col.length, 1).setValues(col);
  ui.alert('Se restauraron ' + n + ' filas.');
}
