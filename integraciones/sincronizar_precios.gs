/**
 * DIDIAL CRM · Sincroniza la PLANILLA DE PRECIOS -> tabla `precios_base` · v2 (v26)
 * ---------------------------------------------------------------------------
 * Adaptado a la estructura consolidada "Base de datos de precios Didial"
 * (pestañas: Guía, Servicios (Mano de Obra), Lubricantes e Insumos, Resumen
 * por Segmento, Parámetros Base). Tratamiento igual que DIDIAL_Base_OT: la
 * planilla es la FUENTE DE VERDAD — lo que cambies ahí llega al CRM en la
 * próxima sincronización y alimenta al instante cotizaciones y presupuestos.
 *
 * IMPORTANTE - LEE ESTO ANTES DE USARLO:
 * No fue posible leer las celdas reales de la planilla (Google Sheets no
 * entrega el contenido renderizado a un fetch externo), así que los nombres
 * de columna de abajo son los MAS PROBABLES según la pestaña "Guía" del
 * archivo, con reconocimiento flexible (varias variantes por campo):
 *   1. Ejecuta primero crmVerificarColumnasPrecios() y revisa el registro
 *      (Ver -> Registro de ejecución). Te dice columna por columna si la
 *      detectó o no.
 *   2. Si algo sale "NO ENCONTRADA", indica el nombre EXACTO del encabezado
 *      de la planilla para esa columna y se ajusta el script.
 *   3. Solo después ejecuta crmSyncPrecios().
 *
 * SUPUESTO CLAVE (confirmar): la guía dice que "Total Económico / Premium"
 * es el total con dos niveles de repuestos (genérico vs original). Como el
 * CRM cotiza por SEPARADO la línea de Mano de Obra y la línea de Repuestos,
 * este script calcula:
 *     repuestos_económico = Total Económico - Valor MO
 *     repuestos_premium   = Total Premium   - Valor MO
 * Si "Total Económico/Premium" en la planilla YA es solo repuestos (sin la
 * MO incluida), avisar para quitar esa resta en una línea.
 *
 * INSTALACIÓN (en esta planilla de precios, Extensiones -> Apps Script):
 *  1. Pegar este archivo. Completar SB_URL y SB_KEY (los mismos de
 *     sincronizar_servicios.gs, el service_role de Supabase).
 *  2. Ejecutar crmVerificarColumnasPrecios() -> revisar el registro.
 *  3. Ejecutar crmSyncPrecios() -> revisar "Precios sincronizados: N".
 *  4. Activador por tiempo (icono de reloj) -> crmSyncPrecios -> cada hora.
 */

// ====== CONFIG ======
const SB_URL  = 'https://TU-PROYECTO.supabase.co';   // VITE_SUPABASE_URL
const SB_KEY  = 'TU_SERVICE_ROLE_KEY';               // service_role (NO la anon)
const EMPRESA_ID = '00000000-0000-0000-0000-000000000001';

const HOJA_SERVICIOS = 'Servicios (Mano de Obra)';
const HOJA_INSUMOS   = 'Lubricantes e Insumos';

// Candidatos de encabezado por campo (se prueban en orden; el primero que
// exista en la fila 1 de la pestaña es el que se usa).
const COL_SERVICIOS = {
  segmento:  ['Segmento'],
  categoria: ['Categoría', 'Categoria'],
  codigo:    ['Código', 'Codigo'],
  servicio:  ['Servicio', 'Nombre Servicio', 'Nombre'],
  tipoVeh:   ['Tipo_Vehiculo', 'Tipo Vehículo', 'Tipo Vehiculo'],
  horas:     ['Horas MO', 'Horas'],
  minutos:   ['Minutos', 'Minutos MO'],
  valorMO:   ['Valor MO (CLP)', 'Valor MO', 'MO (CLP)', 'Valor Mano de Obra'],
  totalEco:  ['Total Económico (CLP)', 'Total Económico', 'Total Economico (CLP)', 'Total Economico'],
  totalPre:  ['Total Premium (CLP)', 'Total Premium'],
  fuente:    ['Fuente'],
  aplica:    ['Aplica'],
  notas:     ['Notas', 'Observaciones']
};
const COL_INSUMOS = {
  tipo:    ['Tipo'],                                   // Lubricante | Insumo
  codigo:  ['Código', 'Codigo'],
  nombre:  ['Producto', 'Insumo', 'Nombre'],
  precio:  ['Precio (CLP)', 'Precio_CLP', 'Precio'],
  notas:   ['Descripción', 'Descripcion', 'Notas']
};

// Normaliza el tipo de vehículo al valor exacto que usa el CRM
// (constante TIPOS_VEHICULO en src/lib/helpers.js).
function normTipoVeh(v) {
  const s = String(v || '').trim().toUpperCase();
  if (!s || s === 'TODOS') return null;                 // precio fijo, sin tarifario por vehículo
  if (s === 'AUTO') return 'AUTO';
  if (s === 'SUV') return 'SUV';
  if (s.indexOf('PICK') >= 0) return 'PICK UP';
  if (s.indexOf('VAN') >= 0 || s.indexOf('FURG') >= 0 || s.indexOf('CAMION') >= 0 || s.indexOf('CAMIÓN') >= 0) return 'VAN/FURGON/CAMION';
  return s;   // valor no reconocido: se guarda tal cual para no perder el dato
}

function _indice(head, candidatos) {
  for (var k = 0; k < candidatos.length; k++) { var i = head.indexOf(candidatos[k]); if (i >= 0) return i; }
  return -1;
}

function crmVerificarColumnasPrecios() {
  var ss = SpreadsheetApp.getActive();
  var shS = ss.getSheetByName(HOJA_SERVICIOS);
  if (!shS) { Logger.log('No encuentro la pestaña "' + HOJA_SERVICIOS + '". Pestañas disponibles: ' + ss.getSheets().map(function(s){return s.getName()}).join(' | ')); return; }
  var headS = shS.getRange(1, 1, 1, shS.getLastColumn()).getValues()[0].map(function(h){return String(h).trim()});
  Logger.log('--- ' + HOJA_SERVICIOS + ' (encabezados detectados: ' + headS.join(' | ') + ') ---');
  Object.keys(COL_SERVICIOS).forEach(function(k) {
    var i = _indice(headS, COL_SERVICIOS[k]);
    Logger.log(k + ' -> ' + (i >= 0 ? 'OK ("' + headS[i] + '")' : 'NO ENCONTRADA (busqué: ' + COL_SERVICIOS[k].join(' / ') + ')'));
  });

  var shI = ss.getSheetByName(HOJA_INSUMOS);
  if (!shI) { Logger.log('No encuentro la pestaña "' + HOJA_INSUMOS + '"'); return; }
  var headI = shI.getRange(1, 1, 1, shI.getLastColumn()).getValues()[0].map(function(h){return String(h).trim()});
  Logger.log('--- ' + HOJA_INSUMOS + ' (encabezados detectados: ' + headI.join(' | ') + ') ---');
  Object.keys(COL_INSUMOS).forEach(function(k) {
    var i = _indice(headI, COL_INSUMOS[k]);
    Logger.log(k + ' -> ' + (i >= 0 ? 'OK ("' + headI[i] + '")' : 'NO ENCONTRADA (busqué: ' + COL_INSUMOS[k].join(' / ') + ')'));
  });
}

function crmSyncPrecios() {
  var ss = SpreadsheetApp.getActive();
  var filas = [];

  // ---- 1) Servicios (Mano de Obra) --------------------------------------
  var shS = ss.getSheetByName(HOJA_SERVICIOS);
  if (!shS) throw new Error('No encuentro la pestaña ' + HOJA_SERVICIOS);
  var dS = shS.getDataRange().getValues();
  var headS = dS.shift().map(function(h){return String(h).trim()});
  var iS = {}; Object.keys(COL_SERVICIOS).forEach(function(k){ iS[k] = _indice(headS, COL_SERVICIOS[k]) });
  var faltanS = ['categoria', 'codigo', 'servicio', 'valorMO'].filter(function(k){ return iS[k] === -1 });
  if (faltanS.length) throw new Error('Faltan columnas clave en "' + HOJA_SERVICIOS + '": ' + faltanS.join(', ') + '. Ejecuta crmVerificarColumnasPrecios() y ajusta COL_SERVICIOS.');

  // Celdas combinadas: si el código se repite y el nombre de servicio viene
  // vacío, se propaga el último nombre visto para ese código.
  var ultCod = null, ultSvc = null;
  dS.forEach(function(r) {
    if (iS.aplica >= 0 && String(r[iS.aplica]).trim().toLowerCase() === 'no') return;
    var codigo = iS.codigo >= 0 ? val(r[iS.codigo]) : null;
    var nombre = val(r[iS.servicio]);
    if (codigo && codigo === ultCod && !nombre) nombre = ultSvc;
    if (nombre) { ultCod = codigo; ultSvc = nombre; }
    if (!codigo && !nombre) return;

    var valorMO = num(r[iS.valorMO]);
    var totalEco = iS.totalEco >= 0 ? num(r[iS.totalEco]) : null;
    var totalPre = iS.totalPre >= 0 ? num(r[iS.totalPre]) : null;
    var esFijo = (iS.fuente >= 0 && /fijo/i.test(String(r[iS.fuente]))) ||
                 (iS.tipoVeh >= 0 && /todos/i.test(String(r[iS.tipoVeh])));

    var horas = iS.horas >= 0 ? num(r[iS.horas]) : null;
    if (horas == null && iS.minutos >= 0) { var m = num(r[iS.minutos]); horas = m != null ? Math.round((m / 60) * 100) / 100 : null; }

    if (esFijo) {
      filas.push({
        empresa_id: EMPRESA_ID, tipo: 'fijo',
        categoria: iS.categoria >= 0 ? val(r[iS.categoria]) : null,
        codigo: codigo, nombre: nombre || (codigo + ' (nombre por completar)'),
        tipo_vehiculo: null, horas_mo: null, valor_mo: null,
        rep_eco: null, rep_premium: null, insumos: null,
        precio: totalEco != null ? totalEco : valorMO,
        notas: iS.notas >= 0 ? val(r[iS.notas]) : null
      });
      return;
    }

    // Tarifario por vehículo: separa el Total (MO + repuestos) en sus dos
    // componentes, porque el CRM cotiza MO y Repuestos como líneas
    // independientes. Ver nota de "SUPUESTO CLAVE" arriba.
    var repEco = (totalEco != null && valorMO != null) ? Math.max(0, Math.round((totalEco - valorMO) * 100) / 100) : null;
    var repPre = (totalPre != null && valorMO != null) ? Math.max(0, Math.round((totalPre - valorMO) * 100) / 100) : null;

    filas.push({
      empresa_id: EMPRESA_ID, tipo: 'servicio',
      categoria: iS.categoria >= 0 ? val(r[iS.categoria]) : null,
      codigo: codigo, nombre: nombre || (codigo + ' (nombre por completar)'),
      tipo_vehiculo: normTipoVeh(iS.tipoVeh >= 0 ? r[iS.tipoVeh] : null),
      horas_mo: horas, valor_mo: valorMO,
      rep_eco: repEco, rep_premium: repPre, insumos: null,
      precio: null,
      notas: [
        iS.segmento >= 0 ? val(r[iS.segmento]) : null,
        iS.notas >= 0 ? val(r[iS.notas]) : null
      ].filter(function(x){return x}).join(' · ') || null
    });
  });

  // ---- 2) Lubricantes e Insumos ------------------------------------------
  var shI = ss.getSheetByName(HOJA_INSUMOS);
  if (shI) {
    var dI = shI.getDataRange().getValues();
    var headI = dI.shift().map(function(h){return String(h).trim()});
    var iI = {}; Object.keys(COL_INSUMOS).forEach(function(k){ iI[k] = _indice(headI, COL_INSUMOS[k]) });
    dI.forEach(function(r) {
      var nombre = iI.nombre >= 0 ? val(r[iI.nombre]) : null;
      if (!nombre) return;
      var tipoTxt = iI.tipo >= 0 ? String(r[iI.tipo] || '').trim().toLowerCase() : '';
      filas.push({
        empresa_id: EMPRESA_ID, tipo: 'insumo',
        categoria: tipoTxt || 'Insumos',
        codigo: iI.codigo >= 0 ? val(r[iI.codigo]) : null,
        nombre: nombre, tipo_vehiculo: null, horas_mo: null, valor_mo: null,
        rep_eco: null, rep_premium: null, insumos: null,
        precio: iI.precio >= 0 ? num(r[iI.precio]) : null,
        notas: iI.notas >= 0 ? val(r[iI.notas]) : null
      });
    });
  }

  if (!filas.length) throw new Error('La planilla no entregó filas — no se borra nada por seguridad.');

  // ---- 3) Recarga en Supabase (borrar + insertar en lotes) ---------------
  var del = UrlFetchApp.fetch(SB_URL + '/rest/v1/precios_base?empresa_id=eq.' + EMPRESA_ID, {
    method: 'delete',
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Prefer: 'return=minimal' },
    muteHttpExceptions: true
  });
  if (del.getResponseCode() >= 300) throw new Error('Error borrando precios: ' + del.getContentText());

  var lote = 200;
  for (var i = 0; i < filas.length; i += lote) {
    var resp = UrlFetchApp.fetch(SB_URL + '/rest/v1/precios_base', {
      method: 'post', contentType: 'application/json',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Prefer: 'return=minimal' },
      payload: JSON.stringify(filas.slice(i, i + lote)),
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() >= 300) Logger.log('Error lote ' + i + ': ' + resp.getContentText());
  }
  Logger.log('Precios sincronizados: ' + filas.length +
    ' (servicios: ' + filas.filter(function(f){return f.tipo === 'servicio'}).length +
    ' · fijos: ' + filas.filter(function(f){return f.tipo === 'fijo'}).length +
    ' · insumos: ' + filas.filter(function(f){return f.tipo === 'insumo'}).length + ')');
}

function val(v) { return v === '' || v == null ? null : String(v).trim(); }
function num(v) {
  if (v === '' || v == null) return null;
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  var s = String(v).trim().replace(/[^0-9.,-]/g, '');
  if (!s) return null;
  s = s.replace(/\./g, '').replace(',', '.');
  var n = Number(s);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}
