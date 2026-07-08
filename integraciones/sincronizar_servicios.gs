/**
 * DIDIAL CRM · Sincroniza el historial de OT (Google Sheet) -> tabla `servicios`  · v2 (v21)
 * ------------------------------------------------------------------------------
 * Pégalo en el proyecto Apps Script de tu planilla base de OT y ejecuta
 * crmSyncServicios() (o ponle un activador por tiempo, ej. cada hora).
 *
 * NOVEDADES v2:
 *  - CORRIGE el bug de OT con "—" sin descripción ni monto: antes, si una OT
 *    aparecía DUPLICADA en la planilla y la fila más reciente venía incompleta,
 *    esa fila vacía pisaba a la completa ("la última gana"). Ahora las filas
 *    duplicadas se FUSIONAN prefiriendo siempre el dato no vacío.
 *  - Sube también la boleta/factura (tipo y N° de documento) de cada OT, para
 *    mostrarla como respaldo de garantía en el historial del CRM.
 *  - Sincroniza datos de contacto y de vehículo hacia el CRM vía la función
 *    crm_aplicar_datos_ot (política: SOLO COMPLETA campos vacíos del CRM, no
 *    pisa lo que ya editaste ahí; el km sí sube si es mayor).
 */

// ====== CONFIG ======
const SB_URL  = 'https://TU-PROYECTO.supabase.co';      // VITE_SUPABASE_URL
const SB_KEY  = 'TU_SERVICE_ROLE_KEY';                  // service_role (NO la anon)
const EMPRESA_ID = '00000000-0000-0000-0000-000000000001';
const HOJA_OT = 'Hoja 1';   // nombre EXACTO de la pestaña con las OT en DIDIAL_Base_OT
const SYNC_CONTACTOS = true;   // false para desactivar el bloque Sheet -> CRM de contacto/vehículo

// ====== MAPEO DE COLUMNAS (por encabezado de la fila 1) ======
// Obligatorias:
const COL = {
  ot_numero:       'N° Orden Trabajo',
  fecha:           'F. Ingreso',
  patente:         'Patente',
  tipo_servicio:   'Tipo Servicio 1',
  tipo_servicio_2: 'Tipo Servicio 2',
  monto:           'Total Reparación',
  km:              'Kilometraje'
};
// Opcionales: se prueban varios nombres posibles; si ninguno existe, se omiten
// sin error. Ejecuta crmVerificarColumnas() para ver qué detectó.
const COL_OPC = {
  tipo_documento: ['Tipo Documento', 'Tipo de Documento', 'Documento'],
  nro_documento:  ['N° Documento', 'Nro Documento', 'N° Doc', 'Numero Documento', 'Número Documento'],
  propietario:    ['Propietario', 'Nombre Propietario', 'Cliente'],
  telefono:       ['Teléfono', 'Telefono', 'Fono'],
  email:          ['Email', 'Correo', 'E-mail'],
  ciudad:         ['Ciudad'],
  direccion:      ['Dirección', 'Direccion'],
  marca:          ['Marca'],
  modelo:         ['Modelo'],
  anio:           ['Año', 'Ano', 'Anio']
};

function crmVerificarColumnas() {
  const sh = SpreadsheetApp.getActive().getSheetByName(HOJA_OT);
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  Object.keys(COL).forEach(k => Logger.log(k + ' -> ' + (head.indexOf(COL[k]) >= 0 ? 'OK ("' + COL[k] + '")' : 'NO ENCONTRADA ("' + COL[k] + '")')));
  Object.keys(COL_OPC).forEach(k => {
    const hit = COL_OPC[k].find(c => head.indexOf(c) >= 0);
    Logger.log('(opcional) ' + k + ' -> ' + (hit ? 'OK ("' + hit + '")' : 'no detectada, se omite'));
  });
}

function crmSyncServicios() {
  const sh = SpreadsheetApp.getActive().getSheetByName(HOJA_OT);
  if (!sh) throw new Error('No encuentro la pestaña ' + HOJA_OT);
  const datos = sh.getDataRange().getValues();
  const head = datos.shift().map(h => String(h).trim());

  const idx = {};
  const faltan = [];
  Object.keys(COL).forEach(k => {
    idx[k] = head.indexOf(COL[k]);
    if (idx[k] === -1) faltan.push(COL[k]);
  });
  if (faltan.length) {
    throw new Error('No encuentro estos encabezados: ' + faltan.join(' | ') +
      '\nEncabezados detectados: ' + head.join(' | '));
  }
  const idxOpc = {};
  Object.keys(COL_OPC).forEach(k => {
    const hit = COL_OPC[k].find(c => head.indexOf(c) >= 0);
    idxOpc[k] = hit ? head.indexOf(hit) : -1;
  });
  const opc = (r, k) => idxOpc[k] >= 0 ? val(r[idxOpc[k]]) : null;

  // Arma filas válidas y FUSIONA duplicados por N° de OT prefiriendo el
  // dato NO VACÍO (v2: corrige el bug de filas duplicadas incompletas).
  const vistos = {};
  const contactos = {};   // por patente, para el bloque Sheet -> CRM
  datos.forEach(r => {
    const ot = val(r[idx.ot_numero]);
    if (!ot || /^(sin\s*ot|nula|n\/?a|-)$/i.test(ot)) return;
    const fila = {
      empresa_id:      EMPRESA_ID,
      ot_numero:       ot,
      fecha:           fecha(r[idx.fecha]),
      patente:         patente(r[idx.patente]),
      tipo_servicio:   val(r[idx.tipo_servicio]),
      tipo_servicio_2: val(r[idx.tipo_servicio_2]),
      monto:           num(r[idx.monto]),
      km:              intnum(r[idx.km]),
      tipo_documento:  opc(r, 'tipo_documento'),
      nro_documento:   opc(r, 'nro_documento')
    };
    const prev = vistos[ot];
    if (!prev) vistos[ot] = fila;
    else Object.keys(fila).forEach(k => {
      // La fila más reciente gana SOLO si trae dato; si viene vacía, se
      // conserva el valor anterior.
      if (fila[k] !== null && fila[k] !== '') prev[k] = fila[k];
    });

    if (SYNC_CONTACTOS && fila.patente) {
      const c = contactos[fila.patente] || (contactos[fila.patente] = { patente: fila.patente });
      const setSi = (k, v) => { if (v !== null && v !== '') c[k] = v; };
      setSi('propietario', opc(r, 'propietario'));
      setSi('telefono',    opc(r, 'telefono'));
      setSi('email',       opc(r, 'email'));
      setSi('ciudad',      opc(r, 'ciudad'));
      setSi('direccion',   opc(r, 'direccion'));
      setSi('marca',       opc(r, 'marca'));
      setSi('modelo',      opc(r, 'modelo'));
      setSi('anio',        intnum(idxOpc.anio >= 0 ? r[idxOpc.anio] : null));
      setSi('km',          fila.km);
    }
  });
  const filas = Object.values(vistos);

  // Sube en lotes con upsert por (empresa_id, ot_numero)
  const lote = 200;
  for (let i = 0; i < filas.length; i += lote) {
    const trozo = filas.slice(i, i + lote);
    const resp = UrlFetchApp.fetch(SB_URL + '/rest/v1/servicios?on_conflict=empresa_id,ot_numero', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        apikey: SB_KEY,
        Authorization: 'Bearer ' + SB_KEY,
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      payload: JSON.stringify(trozo),
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() >= 300) {
      Logger.log('Error lote ' + i + ': ' + resp.getContentText());
    }
  }
  Logger.log('Servicios sincronizados: ' + filas.length);

  // Sheet -> CRM: completa datos de contacto y vehículo (solo campos vacíos)
  if (SYNC_CONTACTOS) {
    const lista = Object.values(contactos);
    for (let i = 0; i < lista.length; i += 300) {
      const resp = UrlFetchApp.fetch(SB_URL + '/rest/v1/rpc/crm_aplicar_datos_ot', {
        method: 'post',
        contentType: 'application/json',
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
        payload: JSON.stringify({ p_empresa: EMPRESA_ID, filas: lista.slice(i, i + 300) }),
        muteHttpExceptions: true
      });
      if (resp.getResponseCode() >= 300) Logger.log('Error contactos lote ' + i + ': ' + resp.getContentText());
    }
    Logger.log('Contactos/vehículos aplicados: ' + lista.length + ' patentes');
  }
}

function val(v)    { return v === '' || v == null ? null : String(v).trim(); }
function num(v) {
  if (v === '' || v == null) return null;
  if (typeof v === 'number') return v;
  let s = String(v).trim().replace(/[^0-9.,-]/g, '');
  if (!s) return null;
  s = s.replace(/\./g, '').replace(',', '.');   // . = miles, , = decimal (formato CL)
  const n = Number(s);
  return isNaN(n) ? null : n;
}
function intnum(v){ const n = num(v); return n == null ? null : Math.round(n); }
function patente(v){ return v ? String(v).replace(/[^A-Za-z0-9]/g, '').toUpperCase() : null; }
function fecha(v) {
  if (v === '' || v == null) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);   // dd/mm/yyyy o dd-mm-yyyy
  if (m) {
    let y = m[3]; if (y.length === 2) y = '20' + y;
    return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}
