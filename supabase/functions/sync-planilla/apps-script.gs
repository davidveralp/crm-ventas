/**
 * DIDIAL · Receptor de OT en la planilla histórica
 * ---------------------------------------------------------------------------
 * UNA OT = UNA FILA. Al ingresar el vehículo se crea la fila con lo que se
 * sabe; al cerrar la OT se actualiza la MISMA fila con montos, documento y
 * fecha de entrega. Nunca se duplica: se busca por N° Orden Trabajo.
 *
 * INSTALACIÓN
 *  1. En la planilla: Extensiones → Apps Script
 *  2. Borra lo que haya y pega este archivo completo
 *  3. Cambia TOKEN por un texto propio (el mismo que pondrás en Supabase)
 *  4. Guardar
 *  5. Implementar → Nueva implementación → "Aplicación web"
 *       Ejecutar como:      Yo
 *       Quién tiene acceso: Cualquier usuario     ← IMPORTANTE
 *  6. Copia la URL que termina en /exec
 *  7. Supabase → Edge Functions → Secrets:
 *       SHEET_WEBAPP_URL = esa URL
 *       SHEET_TOKEN      = el texto del paso 3
 *
 * Si el acceso del paso 5 queda restringido, Google devuelve una página de
 * login en vez de datos y la sincronización falla sin explicar por qué.
 */

const TOKEN = 'CAMBIA_ESTE_TEXTO';
const HOJA = 'Hoja 1';
const COL_OT = 1;   // "N° Orden Trabajo" está en la columna A

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    if (req.token !== TOKEN) return responder({ ok: false, error: 'Token incorrecto' });
    if (req.accion === 'upsert') return upsertFila(req.fila);
    if (req.accion === 'leer') return leerFilas(req.desde || 2);
    return responder({ ok: false, error: 'Acción no reconocida: ' + req.accion });
  } catch (err) {
    return responder({ ok: false, error: String(err) });
  }
}

/** Crea o actualiza la fila de una OT, identificada por su número. */
function upsertFila(fila) {
  const hoja = SpreadsheetApp.getActive().getSheetByName(HOJA);
  if (!hoja) return responder({ ok: false, error: 'No existe la hoja ' + HOJA });

  const encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map(String);
  const ot = String(fila['N° Orden Trabajo'] || '').trim();
  if (!ot) return responder({ ok: false, error: 'La fila no trae N° Orden Trabajo' });

  const ultimaFila = hoja.getLastRow();
  let destino = 0;
  if (ultimaFila > 1) {
    const numeros = hoja.getRange(2, COL_OT, ultimaFila - 1, 1).getValues();
    for (let i = 0; i < numeros.length; i++) {
      if (String(numeros[i][0]).trim() === ot) { destino = i + 2; break; }
    }
  }

  const esNueva = destino === 0;
  if (esNueva) destino = ultimaFila + 1;

  /* Se escribe celda por celda y solo lo que viene con valor. Escribir la fila
     completa borraría las columnas calculadas de la planilla —Rentabilidad,
     Total Encuesta— que el CRM no produce. */
  var escritas = 0;
  encabezados.forEach(function (nombre, i) {
    if (!(nombre in fila)) return;
    const valor = fila[nombre];
    if (valor === null || valor === undefined || valor === '') return;
    hoja.getRange(destino, i + 1).setValue(valor);
    escritas++;
  });

  return responder({ ok: true, fila: destino, nueva: esNueva, columnas: escritas });
}

/** Devuelve las filas como objetos, para que el CRM complete lo que le falta. */
function leerFilas(desde) {
  const hoja = SpreadsheetApp.getActive().getSheetByName(HOJA);
  if (!hoja) return responder({ ok: false, error: 'No existe la hoja ' + HOJA });

  const ultima = hoja.getLastRow();
  if (ultima < desde) return responder({ ok: true, filas: [] });

  const encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  const datos = hoja.getRange(desde, 1, ultima - desde + 1, hoja.getLastColumn()).getValues();

  const filas = datos.map(function (r) {
    const o = {};
    encabezados.forEach(function (h, i) { o[String(h)] = r[i]; });
    return o;
  }).filter(function (o) {
    // Filas sin número de OT son separadores o restos: no aportan.
    return String(o['N° Orden Trabajo'] || '').trim() !== '';
  });

  return responder({ ok: true, filas: filas, total: filas.length });
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Para probar desde el editor: Ejecutar → prueba */
function prueba() {
  Logger.log(upsertFila({
    'N° Orden Trabajo': 'TEST-1', 'Patente': 'AA BB 11', 'Marca': 'Prueba'
  }).getContent());
}
