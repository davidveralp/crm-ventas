/**
 * DIDIAL CRM · Sincroniza la PLANILLA DE PRECIOS -> tabla `precios_base` · v4 (v27)
 * ---------------------------------------------------------------------------
 * Adaptado a la estructura real de "Base de datos de precios Didial" v2
 * (pestañas: Guía, Servicios (Mano de Obra), Lubricantes e Insumos, Resumen
 * por Segmento, Parámetros Base) — confirmada contra el archivo entregado.
 * Tratamiento igual que DIDIAL_Base_OT: la planilla es la FUENTE DE VERDAD.
 * Lo que cambies ahí (precios, servicios nuevos, códigos) llega al CRM en
 * la próxima sincronización y alimenta al instante la búsqueda de
 * servicios en cotizaciones rápidas, la elaboración de presupuestos y los
 * rangos mín/máx de repuestos.
 *
 * ESTRUCTURA REAL confirmada:
 *  Pestaña "Servicios (Mano de Obra)":
 *    Segmento | Categoría | Código | Servicio | Tipo Vehículo | Aplica |
 *    Horas MO | Valor MO (CLP) | Repuestos mín (CLP) | Repuestos máx (CLP) |
 *    Insumos (CLP) | Total mín (CLP) | Total máx (CLP) | Fuente | Notas
 *  Pestaña "Lubricantes e Insumos":
 *    Tipo | Código | Producto | Precio (CLP) | Descripción
 *
 *  - Aplica = "No" -> se omite la fila.
 *  - Fuente = "Precio fijo" (o Tipo Vehículo = "TODOS") -> precio único,
 *    tomado de "Total mín (CLP)" (o Valor MO si no hay total).
 *  - Fuente = "Tarifario por vehículo" -> servicio con Valor MO propio y
 *    "Repuestos mín/máx" como referencia de rango económico/premium
 *    (estos SON solo repuestos, no un total combinado — no se resta nada).
 *  - Celdas combinadas: si el código se repite y "Servicio" viene vacío,
 *    se propaga el último nombre visto para ese código.
 *
 * INSTALACIÓN (en esta planilla de precios, Extensiones -> Apps Script):
 *  1. Pegar este archivo. Completar SB_URL y SB_KEY (los mismos de
 *     sincronizar_servicios.gs, el service_role de Supabase).
 *  2. Ejecutar crmVerificarColumnasPrecios() -> revisar el registro (por si
 *     alguna vez cambian encabezados o agregan pestañas).
 *  3. Ejecutar crmSyncPrecios() -> revisar "Precios sincronizados: N".
 *  4. Activador por tiempo (icono de reloj) -> crmSyncPrecios -> cada hora.
 *
 * Requiere haber ejecutado la migración 33 (columna segmento en
 * precios_base).
 * Nota: el código AC13 (A/C y Calefacción) llega sin nombre de servicio en
 * la planilla; se carga como "A/C y Calefacción AC13 (nombre por
 * completar)" — corrígelo en la planilla cuando puedas.
 */

// ====== CONFIG ======
const SB_URL  = 'https://TU-PROYECTO.supabase.co';   // VITE_SUPABASE_URL
const SB_KEY  = 'TU_SERVICE_ROLE_KEY';               // service_role (NO la anon)
const EMPRESA_ID = '00000000-0000-0000-0000-000000000001';

const HOJA_SERVICIOS = 'Servicios (Mano de Obra)';
const HOJA_INSUMOS   = 'Lubricantes e Insumos';

const COL_SERVICIOS = {
  segmento:  'Segmento',
  categoria: 'Categoría',
  codigo:    'Código',
  servicio:  'Servicio',
  tipoVeh:   'Tipo Vehículo',
  aplica:    'Aplica',
  horas:     'Horas MO',
  valorMO:   'Valor MO (CLP)',
  repMin:    'Repuestos mín (CLP)',
  repMax:    'Repuestos máx (CLP)',
  insumos:   'Insumos (CLP)',
  totalMin:  'Total mín (CLP)',
  totalMax:  'Total máx (CLP)',
  fuente:    'Fuente',
  notas:     'Notas'
};
const COL_INSUMOS = {
  tipo:    'Tipo',
  codigo:  'Código',
  nombre:  'Producto',
  precio:  'Precio (CLP)',
  notas:   'Descripción'
};

// Normaliza el tipo de vehículo al valor exacto que usa el CRM (constante
// TIPOS_VEHICULO en src/lib/helpers.js: AUTO, SUV, PICK UP,
// VAN/FURGON/CAMION). La planilla trae además combinaciones como
// "PICK UP/VAN/FURGON" o "VAN/FURGON/CAMION DOBLE RODADO": se guardan tal
// cual (no se filtran) para no perder el dato — quedan visibles al buscar
// pero no calzan con ningún vehículo cuyo tipo sea uno de los 4 estándar.
function normTipoVeh(v) {
  var s = String(v || '').trim().toUpperCase();
  if (!s || s === 'TODOS') return null;   // precio fijo, sin tarifario por vehículo
  if (s === 'AUTO') return 'AUTO';
  if (s === 'SUV') return 'SUV';
  if (s === 'PICK UP') return 'PICK UP';
  if (s === 'VAN/FURGON/CAMION') return 'VAN/FURGON/CAMION';
  return s;  // combinaciones especiales: se conservan tal cual
}

function _indice(head, nombre) { return head.indexOf(nombre); }

function crmVerificarColumnasPrecios() {
  var ss = SpreadsheetApp.getActive();
  var shS = ss.getSheetByName(HOJA_SERVICIOS);
  if (!shS) { Logger.log('No encuentro la pestaña "' + HOJA_SERVICIOS + '". Pestañas: ' + ss.getSheets().map(function(s){return s.getName()}).join(' | ')); return; }
  var headS = shS.getRange(1, 1, 1, shS.getLastColumn()).getValues()[0].map(function(h){return String(h).trim()});
  Logger.log('--- ' + HOJA_SERVICIOS + ': ' + headS.join(' | ') + ' ---');
  Object.keys(COL_SERVICIOS).forEach(function(k) {
    var i = _indice(headS, COL_SERVICIOS[k]);
    Logger.log(k + ' ("' + COL_SERVICIOS[k] + '") -> ' + (i >= 0 ? 'OK' : 'NO ENCONTRADA'));
  });

  var shI = ss.getSheetByName(HOJA_INSUMOS);
  if (!shI) { Logger.log('No encuentro la pestaña "' + HOJA_INSUMOS + '"'); return; }
  var headI = shI.getRange(1, 1, 1, shI.getLastColumn()).getValues()[0].map(function(h){return String(h).trim()});
  Logger.log('--- ' + HOJA_INSUMOS + ': ' + headI.join(' | ') + ' ---');
  Object.keys(COL_INSUMOS).forEach(function(k) {
    var i = _indice(headI, COL_INSUMOS[k]);
    Logger.log(k + ' ("' + COL_INSUMOS[k] + '") -> ' + (i >= 0 ? 'OK' : 'NO ENCONTRADA'));
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
  if (faltanS.length) throw new Error('Faltan columnas clave: ' + faltanS.map(function(k){return COL_SERVICIOS[k]}).join(', ') + '. Encabezados detectados: ' + headS.join(' | '));

  var ultCod = null, ultSvc = null;
  dS.forEach(function(r) {
    if (iS.aplica >= 0 && String(r[iS.aplica]).trim() === 'No') return;
    var codigo = val(r[iS.codigo]);
    var nombre = val(r[iS.servicio]);
    if (codigo && codigo === ultCod && !nombre) nombre = ultSvc;   // celdas combinadas
    if (nombre) { ultCod = codigo; ultSvc = nombre; }
    if (!codigo && !nombre) return;

    var valorMO = num(r[iS.valorMO]);
    var tipoVehTxt = iS.tipoVeh >= 0 ? String(r[iS.tipoVeh] || '').trim() : '';
    var fuenteTxt = iS.fuente >= 0 ? String(r[iS.fuente] || '').trim() : '';
    var esFijo = fuenteTxt === 'Precio fijo' || tipoVehTxt === 'TODOS';

    var segmento = iS.segmento >= 0 ? val(r[iS.segmento]) : null;
    var notas = iS.notas >= 0 ? val(r[iS.notas]) : null;

    if (esFijo) {
      var totalMin = iS.totalMin >= 0 ? num(r[iS.totalMin]) : null;
      filas.push({
        empresa_id: EMPRESA_ID, tipo: 'fijo', segmento: segmento,
        categoria: iS.categoria >= 0 ? val(r[iS.categoria]) : null,
        codigo: codigo, nombre: nombre || (codigo + ' (nombre por completar)'),
        tipo_vehiculo: null, horas_mo: null, valor_mo: null,
        rep_eco: null, rep_premium: null, insumos: null,
        precio: totalMin != null ? totalMin : valorMO,
        notas: notas
      });
      return;
    }

    filas.push({
      empresa_id: EMPRESA_ID, tipo: 'servicio', segmento: segmento,
      categoria: iS.categoria >= 0 ? val(r[iS.categoria]) : null,
      codigo: codigo, nombre: nombre || (codigo + ' (nombre por completar)'),
      tipo_vehiculo: normTipoVeh(tipoVehTxt),
      horas_mo: iS.horas >= 0 ? num(r[iS.horas]) : null,
      valor_mo: valorMO,
      rep_eco: iS.repMin >= 0 ? num(r[iS.repMin]) : null,
      rep_premium: iS.repMax >= 0 ? num(r[iS.repMax]) : null,
      insumos: iS.insumos >= 0 ? num(r[iS.insumos]) : null,
      precio: null,
      notas: notas
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
      var tipoTxt = iI.tipo >= 0 ? String(r[iI.tipo] || '').trim() : '';
      filas.push({
        empresa_id: EMPRESA_ID, tipo: 'insumo', segmento: null,
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
