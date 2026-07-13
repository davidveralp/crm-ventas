/**
 * DIDIAL CRM · Sincroniza la PLANILLA DE FACTURAS DE REPUESTOS -> CRM · v1 (v33)
 * ---------------------------------------------------------------------------
 * Pipeline: AppSheet -> Google Drive -> Anthropic Vision -> esta planilla.
 * Este script sube al CRM las cabeceras (pestaña FACTURAS) y el detalle por
 * línea (pestaña DETALLE). La VALIDACIÓN y la revisión de confianza se hacen
 * DENTRO DEL CRM (módulo Presupuestos → Facturas), no en la planilla.
 *
 * Control de duplicados (doble, como se pidió):
 *   1. Idempotente por id (id_factura para cabeceras; id_factura-nro_linea
 *      para detalle) vía upsert — re-ejecutar no duplica.
 *   2. Marca la columna sync_crm = 'SINCRONIZADO' en la pestaña FACTURAS al
 *      subir cada factura, para seguimiento visual en la planilla.
 *
 * IMPORTANTE: sube TODAS las facturas capturadas (la validación es en el
 * CRM). La confianza y las alertas viajan para mostrarse allá.
 *
 * INSTALACIÓN (en la planilla de facturas, Extensiones -> Apps Script):
 *   1. Pega este archivo. Completa SB_URL y SB_KEY (service_role).
 *   2. Ejecuta crmSyncFacturas(). Revisa el registro.
 *   3. Activador por tiempo -> crmSyncFacturas -> cada hora (o el intervalo
 *      que uses para capturar).
 */

// ====== CONFIG ======
const SB_URL  = 'https://TU-PROYECTO.supabase.co';   // VITE_SUPABASE_URL
const SB_KEY  = 'TU_SERVICE_ROLE_KEY';               // service_role (NO la anon)
const EMPRESA_ID = '00000000-0000-0000-0000-000000000001';

const HOJA_FACTURAS = 'FACTURAS';
const HOJA_DETALLE  = 'DETALLE';

function crmSyncFacturas() {
  var ss = SpreadsheetApp.getActive();

  // ---- 1) Cabeceras (FACTURAS) -----------------------------------------
  var shF = ss.getSheetByName(HOJA_FACTURAS);
  if (!shF) throw new Error('No encuentro la pestaña ' + HOJA_FACTURAS);
  var dF = shF.getDataRange().getValues();
  var hF = dF.shift().map(function(h){ return String(h).trim() });
  var iF = {};
  hF.forEach(function(h, i){ iF[h] = i });
  var colSync = iF['sync_crm'];

  var cabeceras = [];
  var filasSync = [];   // filas de la hoja a marcar como SINCRONIZADO (1-based +1 por encabezado)
  dF.forEach(function(r, idx) {
    var id = val(r[iF['id_factura']]);
    if (!id) return;
    cabeceras.push({
      id: id, empresa_id: EMPRESA_ID,
      tipo_doc: val(r[iF['tipo_doc']]), folio: val(r[iF['folio']]),
      rut_emisor: val(r[iF['rut_emisor']]), razon_social: val(r[iF['razon_social']]),
      fecha_emision: fecha(r[iF['fecha_emision']]),
      neto: num(r[iF['neto']]), iva: num(r[iF['iva']]),
      exento: num(r[iF['exento']]), total: num(r[iF['total']]),
      patente_sugerida: val(r[iF['patente_validada']]) || val(r[iF['patente_candidata']]),
      ot_sugerida: val(r[iF['ot_validada']]) || val(r[iF['ot_candidata']]),
      confianza: val(r[iF['confianza']]), alertas: val(r[iF['alertas']])
    });
    if (colSync != null) filasSync.push(idx + 2);
  });
  upsert('facturas_repuestos', cabeceras, 'id');

  // ---- 2) Detalle (DETALLE) --------------------------------------------
  var shD = ss.getSheetByName(HOJA_DETALLE);
  if (!shD) throw new Error('No encuentro la pestaña ' + HOJA_DETALLE);
  var dD = shD.getDataRange().getValues();
  var hD = dD.shift().map(function(h){ return String(h).trim() });
  var iD = {};
  hD.forEach(function(h, i){ iD[h] = i });

  var detalle = [];
  dD.forEach(function(r) {
    var idf = val(r[iD['id_factura']]);
    var linea = num(r[iD['nro_linea']]);
    if (!idf || linea == null) return;
    var cant = num(r[iD['cantidad']]) || 1;
    detalle.push({
      id: idf + '-' + linea, empresa_id: EMPRESA_ID,
      id_factura: idf, nro_linea: linea,
      codigo: val(r[iD['codigo']]), descripcion: val(r[iD['descripcion']]),
      cantidad: cant,
      costo_unitario: num(r[iD['precio_unitario']]) || 0,
      descuento: num(r[iD['descuento']]) || 0,
      total_linea: num(r[iD['total_linea']]) || 0
    });
  });
  // upsert sin pisar la asignación ya hecha en el CRM: solo inserta lo nuevo
  // (on_conflict do nothing) para no borrar cantidad_asignada/estado_asig.
  upsert('repuestos_facturados', detalle, 'id', true);

  // ---- 3) Marca sync_crm = SINCRONIZADO en la planilla -----------------
  if (colSync != null) {
    filasSync.forEach(function(fila) {
      shF.getRange(fila, colSync + 1).setValue('SINCRONIZADO');
    });
  }

  Logger.log('Facturas: ' + cabeceras.length + ' · Líneas de repuesto: ' + detalle.length + ' sincronizadas.');
}

// upsert genérico a PostgREST. Si ignorarConflicto=true usa
// resolution=ignore-duplicates (no pisa filas existentes).
function upsert(tabla, filas, pk, ignorarConflicto) {
  if (!filas.length) return;
  var resolution = ignorarConflicto ? 'ignore-duplicates' : 'merge-duplicates';
  var lote = 200;
  for (var i = 0; i < filas.length; i += lote) {
    var resp = UrlFetchApp.fetch(SB_URL + '/rest/v1/' + tabla + '?on_conflict=' + pk, {
      method: 'post', contentType: 'application/json',
      headers: {
        apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
        Prefer: 'resolution=' + resolution + ',return=minimal'
      },
      payload: JSON.stringify(filas.slice(i, i + lote)),
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() >= 300) Logger.log('Error en ' + tabla + ' lote ' + i + ': ' + resp.getContentText());
  }
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
function fecha(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  return s || null;
}
