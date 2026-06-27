/**
 * DIDIAL CRM · Sincroniza el historial de OT (Google Sheet) -> tabla `servicios`
 * ---------------------------------------------------------------------------
 * Pégalo en el proyecto Apps Script de tu planilla base de OT y ejecuta
 * crmSyncServicios() (o ponle un activador por tiempo, ej. cada hora).
 *
 * Ya viene mapeado a tus encabezados reales. Solo completa CONFIG.
 */

// ====== CONFIG ======
const SB_URL  = 'https://TU-PROYECTO.supabase.co';      // VITE_SUPABASE_URL
const SB_KEY  = 'TU_SERVICE_ROLE_KEY';                  // service_role (NO la anon)
const EMPRESA_ID = '00000000-0000-0000-0000-000000000001';
const HOJA_OT = 'OT';   // nombre EXACTO de la pestaña con las OT

// ====== MAPEO DE COLUMNAS (por encabezado de la fila 1) ======
const COL = {
  ot_numero:       'N° Orden Trabajo',
  fecha:           'F. Ingreso',
  patente:         'Patente',
  tipo_servicio:   'Tipo Servicio 1',
  tipo_servicio_2: 'Tipo Servicio 2',
  monto:           'Total Reparación',
  km:              'Kilometraje'
};

function crmSyncServicios() {
  const sh = SpreadsheetApp.getActive().getSheetByName(HOJA_OT);
  if (!sh) throw new Error('No encuentro la pestaña ' + HOJA_OT);
  const datos = sh.getDataRange().getValues();
  const head = datos.shift().map(h => String(h).trim());

  // Valida que los encabezados existan
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

  // Arma filas válidas y deduplica por N° de OT (la última gana)
  const vistos = {};
  datos.forEach(r => {
    const ot = val(r[idx.ot_numero]);
    if (!ot || /^(sin\s*ot|nula|n\/?a|-)$/i.test(ot)) return;  // descarta filas sin OT real
    vistos[ot] = {
      empresa_id:      EMPRESA_ID,
      ot_numero:       ot,
      fecha:           fecha(r[idx.fecha]),
      patente:         patente(r[idx.patente]),
      tipo_servicio:   val(r[idx.tipo_servicio]),
      tipo_servicio_2: val(r[idx.tipo_servicio_2]),
      monto:           num(r[idx.monto]),
      km:              intnum(r[idx.km])
    };
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
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);   // ya viene ISO
  return null;   // cualquier otro texto (ej. "NULA", "SIN OT") -> sin fecha
}
