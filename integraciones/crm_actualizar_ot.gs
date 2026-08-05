/**
 * DIDIAL CRM · Actualización CRM -> planilla base de OT  · v21
 * -----------------------------------------------------------------
 * Al editar los DATOS DE CONTACTO de un cliente o los DATOS DE UN
 * VEHÍCULO en el CRM, este Web App actualiza las filas correspondientes
 * de la base de OT (todas las OT relacionadas, por patente y/o N° OT).
 *
 * INSTALACIÓN (mismo proyecto Apps Script de la planilla base de OT):
 *  1. Archivo nuevo -> pega este código (convive con sincronizar_servicios.gs
 *     y con el Apps Script de la app de registro; nombres con prefijo crmUpd).
 *  2. Cambia CRM_UPD_TOKEN por un texto secreto propio.
 *  3. Implementar -> Nueva implementación -> Aplicación web ->
 *     Ejecutar como: TÚ · Acceso: "Cualquier usuario" -> Implementar.
 *  4. Copia la URL del Web App y guárdala en Supabase:
 *       update empresa_config
 *          set valor = to_jsonb('URL_DEL_WEBAPP?token=TU_TOKEN'::text)
 *        where empresa_id = '00000000-0000-0000-0000-000000000001'
 *          and clave = 'sheet_update_url';
 *     (el CRM la lee de ahí; incluye el token en la URL).
 *
 * POLÍTICA DE CONFLICTOS: el CRM escribe SIEMPRE en la planilla al
 * momento de editar (fuente de la edición). La vuelta (planilla -> CRM)
 * solo completa campos vacíos, así ninguna sincronización pisa lo que
 * editaste en el CRM.
 */

const CRM_UPD_TOKEN = 'CAMBIA_ESTE_TOKEN';
const CRM_UPD_HOJA  = 'Hoja 1';   // nombre EXACTO de la pestaña con las OT
// Encabezado que identifica a la pestaña de OT. Se usa como respaldo si el
// nombre de arriba no existe (la pestaña se renombró, se duplicó la planilla,
// etc.). Antes esta constante decía 'OT' y la pestaña real es 'Hoja 1': el
// Web App lanzaba "No encuentro la pestaña OT" y la sincronización
// CRM -> planilla no ocurría nunca, en silencio.
const CRM_UPD_ENCABEZADO_CLAVE = 'N° Orden Trabajo';

// Columnas a actualizar (candidatos de encabezado; si no existen se omiten).
const CRM_UPD_COLS = {
  // datos de contacto del cliente
  propietario: ['Propietario', 'Nombre Propietario', 'Cliente'],
  telefono:    ['Teléfono', 'Telefono', 'Fono'],
  email:       ['E-Mail', 'Email', 'Correo', 'E-mail'],
  ciudad:      ['Ciudad'],
  direccion:   ['Dirección', 'Direccion'],
  rut:         ['RUT', 'Rut'],
  tipo_cliente:['Tipo Cliente', 'Tipo de Cliente'],
  // datos del vehículo
  marca:  ['Marca'],
  modelo: ['Modelo'],
  anio:   ['Año', 'Ano', 'Anio'],
  patente_nueva: ['Patente']
};
const CRM_UPD_KEY = {
  ot:      ['N° Orden Trabajo'],
  patente: ['Patente']
};

function doPost(e) {
  try {
    const p = JSON.parse(e.parameter.payload || '{}');
    // token en la URL (?token=) o dentro del payload
    const token = (e.parameter.token || p.token || '').trim();
    if (token !== CRM_UPD_TOKEN) return _crmUpdSalida('token inválido');
    if (p.accion === 'actualizar_cliente')  return _crmUpdSalida(crmUpdCliente(p));
    if (p.accion === 'actualizar_vehiculo') return _crmUpdSalida(crmUpdVehiculo(p));
    return _crmUpdSalida('acción desconocida');
  } catch (err) {
    return _crmUpdSalida('error: ' + err);
  }
}
function _crmUpdSalida(msg) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, msg: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

function _crmUpdContexto() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CRM_UPD_HOJA);

  // Respaldo: buscar la pestaña que tenga el encabezado clave en su fila 1.
  if (!sh) {
    const hojas = ss.getSheets();
    for (let i = 0; i < hojas.length; i++) {
      const ultima = hojas[i].getLastColumn();
      if (ultima < 1) continue;
      const fila1 = hojas[i].getRange(1, 1, 1, ultima).getValues()[0]
        .map(function (h) { return String(h).trim(); });
      if (fila1.indexOf(CRM_UPD_ENCABEZADO_CLAVE) >= 0) { sh = hojas[i]; break; }
    }
  }
  if (!sh) {
    throw new Error('No encuentro la pestaña "' + CRM_UPD_HOJA + '" ni ninguna con la columna "' +
                    CRM_UPD_ENCABEZADO_CLAVE + '". Revisa CRM_UPD_HOJA.');
  }

  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());

  // Comparación tolerante: sin acentos, sin mayúsculas y sin espacios dobles.
  // Antes era `head.indexOf(c)`, sensible a mayúsculas, así que el candidato
  // 'E-mail' NO calzaba con el encabezado real 'E-Mail' y esa columna jamás
  // se sincronizaba. Mismo riesgo con 'Teléfono' vs 'Telefono'.
  const _norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                        .toUpperCase().replace(/\s+/g, ' ').trim();
  const headNorm = head.map(_norm);
  const col = (cands) => {
    for (let i = 0; i < cands.length; i++) {
      const j = head.indexOf(cands[i]);            // coincidencia exacta primero
      if (j >= 0) return j;
    }
    for (let k = 0; k < cands.length; k++) {
      const j = headNorm.indexOf(_norm(cands[k])); // luego tolerante
      if (j >= 0) return j;
    }
    return -1;
  };
  return { sh, head, col };
}

/**
 * Diagnóstico manual: ejecutar desde el editor de Apps Script para comprobar
 * que el Web App encuentra la hoja y las columnas antes de depender de él.
 */
function crmUpdDiagnostico() {
  const ctx = _crmUpdContexto();
  const faltan = [];
  Object.keys(CRM_UPD_COLS).forEach(function (k) {
    if (ctx.col(CRM_UPD_COLS[k]) < 0) faltan.push(k);
  });
  const msg =
    'Pestaña encontrada: ' + ctx.sh.getName() + '\n' +
    'Filas: ' + ctx.sh.getLastRow() + ' · Columnas: ' + ctx.head.length + '\n' +
    (faltan.length ? 'Columnas NO encontradas: ' + faltan.join(', ')
                   : 'Todas las columnas configuradas existen.');
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* sin interfaz, solo log */ }
  return msg;
}
const _pat = (v) => v ? String(v).replace(/[^A-Za-z0-9]/g, '').toUpperCase() : '';

// Actualiza los datos de contacto en todas las filas cuyo N° de OT esté en
// p.ots o cuya patente (normalizada) esté en p.patentes.
function crmUpdCliente(p) {
  const { sh, col } = _crmUpdContexto();
  const iOT  = col(CRM_UPD_KEY.ot), iPat = col(CRM_UPD_KEY.patente);
  const ots  = (p.ots || []).map(String);
  const pats = (p.patentes || []).map(_pat).filter(Boolean);
  const campos = ['propietario', 'telefono', 'email', 'ciudad', 'direccion', 'rut', 'tipo_cliente']
    .map(k => ({ k, i: col(CRM_UPD_COLS[k]) }))
    .filter(c => c.i >= 0 && p[c.k] !== undefined && p[c.k] !== null && String(p[c.k]) !== '');
  if (!campos.length) return 'sin columnas que actualizar';

  const datos = sh.getDataRange().getValues();
  let n = 0;
  for (let r = 1; r < datos.length; r++) {
    const matchOT  = iOT  >= 0 && ots.indexOf(String(datos[r][iOT]).trim()) >= 0;
    const matchPat = iPat >= 0 && pats.indexOf(_pat(datos[r][iPat])) >= 0;
    if (!matchOT && !matchPat) continue;
    campos.forEach(c => sh.getRange(r + 1, c.i + 1).setValue(p[c.k]));
    n++;
  }
  return 'cliente actualizado en ' + n + ' filas';
}

// Actualiza marca/modelo/año (y la patente corregida) en todas las filas
// cuya patente coincida con alguna de p.patentes (busca por la patente
// anterior y la nueva, por si se corrigió).
function crmUpdVehiculo(p) {
  const { sh, col } = _crmUpdContexto();
  const iPat = col(CRM_UPD_KEY.patente);
  if (iPat < 0) return 'no encuentro la columna Patente';
  const pats = (p.patentes || []).map(_pat).filter(Boolean);
  const campos = ['marca', 'modelo', 'anio']
    .map(k => ({ k, i: col(CRM_UPD_COLS[k]) }))
    .filter(c => c.i >= 0 && p[c.k] !== undefined && p[c.k] !== null && String(p[c.k]) !== '');

  const datos = sh.getDataRange().getValues();
  let n = 0;
  for (let r = 1; r < datos.length; r++) {
    if (pats.indexOf(_pat(datos[r][iPat])) < 0) continue;
    campos.forEach(c => sh.getRange(r + 1, c.i + 1).setValue(p[c.k]));
    if (p.patente_nueva && _pat(p.patente_nueva) !== _pat(datos[r][iPat])) {
      sh.getRange(r + 1, iPat + 1).setValue(p.patente_nueva);
    }
    n++;
  }
  return 'vehículo actualizado en ' + n + ' filas';
}
