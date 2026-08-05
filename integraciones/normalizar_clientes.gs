/**
 * DIDIAL · Consolidación de clientes y normalización de patentes en la base de OT
 * ------------------------------------------------------------------------------
 * PARA QUÉ
 * La identidad del cliente en la base de OT es el texto libre de la columna
 * "Propietario", sin RUT. Eso genera fichas separadas para un mismo cliente:
 *   "INIA" / "INS. INV. AGROPECUARIA"      (mismo correo WILSON.ROJAS@INIA.CL)
 *   "Rafel Valderrama" / "Rafael Valderrama"
 *   "Katterine Rodriguez" / "Katerine"
 * y la facturación histórica queda repartida entre ellas.
 * Lo mismo ocurre con las patentes: "GR WW76" y "GR WW 76" son el mismo vehículo.
 *
 * CÓMO FUNCIONA (tres pasos, con revisión humana en el medio)
 *   1. mapaClientesGenerar()  → NO modifica nada. Analiza la base y crea/actualiza
 *      la pestaña "Map_Clientes" con los grupos de variantes detectadas y un
 *      nombre canónico sugerido.
 *   2. TÚ revisas Map_Clientes: corriges el canónico y marcas la casilla Aplicar
 *      solo en los grupos que confirmes. Los que no marques no se tocan.
 *   3. mapaClientesAplicar()  → escribe el canónico en la columna Propietario,
 *      guardando ANTES el valor original en una columna de respaldo. Reversible
 *      con mapaClientesRevertir().
 *
 * Y ADEMÁS
 *   normalizarPatentes() crea/actualiza la columna "Patente Norm" con la patente
 *   sin separadores y en mayúsculas, que es exactamente lo que guarda la columna
 *   generada `vehiculos.patente_norm` de Supabase (migración 49). Con eso ambos
 *   lados comparten la misma llave de vehículo.
 *
 * INSTALACIÓN
 *   Extensiones → Apps Script → Archivo nuevo → pegar este código → Guardar.
 *   Los nombres llevan prefijo propio, así que convive con los scripts ya
 *   instalados (sincronizar_servicios.gs, crm_actualizar_ot.gs, etc.).
 *   Queda un menú "DIDIAL · Datos" en la barra de la planilla.
 *
 * SEGURIDAD
 *   - Ninguna función borra filas.
 *   - El paso 3 respalda el valor original antes de sobrescribirlo.
 *   - Nada se aplica sin que marques la casilla Aplicar.
 */

const MC_HOJA_DATOS   = 'Hoja 1';
const MC_HOJA_MAPA    = 'Map_Clientes';
const MC_COL_NOMBRE   = ['Propietario', 'Nombre Propietario', 'Cliente'];
const MC_COL_TELEFONO = ['Teléfono', 'Telefono', 'Fono'];
const MC_COL_EMAIL    = ['E-Mail', 'Email', 'Correo', 'E-mail'];
const MC_COL_TOTAL    = ['Total Reparación', 'Total Reparacion'];
const MC_COL_PATENTE  = ['Patente'];
const MC_COL_RESPALDO = 'Propietario Original';
const MC_COL_PAT_NORM = 'Patente Norm';

/**
 * Umbral de parecido para agrupar por nombre (0 a 1). Más alto = más estricto.
 * Calibrado con casos reales de la base:
 *   0.903  Rafel Valderrama / Rafael Valderrama          → debe unir
 *   0.893  UNVERSIONES GASTRONIMICAS / INVERSIONES GAST. → debe unir
 *   0.870  Fernnda Vega / Fernanda Vega                  → debe unir
 *   0.850  Contreras Hermanos Ltda / Contreras Hnos Ltda → debe unir
 *   0.818  Felioe Pavez / Felipe Pavez                   → debe unir
 *   ----------------------------------------------------- 0.80 (umbral)
 *   0.710  Maria Elena Rojas / Maria Elena Soto          → NO debe unir
 *   0.583  Gabriel Monge / Gabriel Nuñez                 → NO debe unir
 * Casos como "Katterine Rodriguez"/"Katerine" (0.56) o "INIA"/"INS. INV.
 * AGROPECUARIA" (0.18) NO se detectan por nombre: dependen de que compartan
 * teléfono o correo, o de que los agregues a mano en Map_Clientes.
 */
const MC_UMBRAL = 0.80;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('DIDIAL · Datos')
    .addItem('1. Detectar clientes duplicados', 'mapaClientesGenerar')
    .addItem('2. Aplicar nombres confirmados', 'mapaClientesAplicar')
    .addItem('Revertir última aplicación', 'mapaClientesRevertir')
    .addSeparator()
    .addItem('Normalizar patentes', 'normalizarPatentes')
    .addToUi();
}

/* ------------------------------ utilidades ------------------------------ */

function mcNorm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quita acentos
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')                        // puntuación fuera
    .replace(/\s+/g, ' ')
    .trim();
}

function mcPatente(s) {
  return String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/** Últimos 8 dígitos: agrupa +569 92764347 / 992764347 / 92764347. */
function mcFono(s) {
  const d = String(s || '').replace(/[^0-9]/g, '');
  return d.length >= 8 ? d.slice(-8) : '';
}

function mcEmail(s) {
  const e = String(s || '').trim().toLowerCase();
  return e.indexOf('@') > 0 ? e : '';
}

function mcNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

/** Similitud por bigramas (Dice). Barata y suficiente para erratas de tipeo. */
function mcSimilitud(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bg = (s) => {
    const m = {};
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.substr(i, 2);
      m[g] = (m[g] || 0) + 1;
    }
    return m;
  };
  const A = bg(a), B = bg(b);
  let inter = 0, total = 0;
  for (const g in A) { total += A[g]; if (B[g]) inter += Math.min(A[g], B[g]); }
  for (const g in B) total += B[g];
  return (2 * inter) / total;
}

function mcIndiceCols(cab, candidatos) {
  for (let i = 0; i < candidatos.length; i++) {
    const j = cab.indexOf(candidatos[i]);
    if (j >= 0) return j;
  }
  // segundo intento, tolerante a mayúsculas y acentos
  const norm = cab.map((h) => mcNorm(h));
  for (let i = 0; i < candidatos.length; i++) {
    const j = norm.indexOf(mcNorm(candidatos[i]));
    if (j >= 0) return j;
  }
  return -1;
}

function mcHojaDatos() {
  const sh = SpreadsheetApp.getActive().getSheetByName(MC_HOJA_DATOS);
  if (!sh) throw new Error('No existe la pestaña "' + MC_HOJA_DATOS + '".');
  return sh;
}

/* ------------------- PASO 1 · detectar duplicados ----------------------- */

function mapaClientesGenerar() {
  const ss = SpreadsheetApp.getActive();
  const sh = mcHojaDatos();
  const datos = sh.getDataRange().getValues();
  const cab = datos[0];

  const cN = mcIndiceCols(cab, MC_COL_NOMBRE);
  const cT = mcIndiceCols(cab, MC_COL_TELEFONO);
  const cE = mcIndiceCols(cab, MC_COL_EMAIL);
  const cM = mcIndiceCols(cab, MC_COL_TOTAL);
  if (cN < 0) throw new Error('No se encontró la columna de Propietario.');

  // 1. Agrupar por nombre normalizado exacto
  const variantes = {};   // norm -> {original, ot, monto, fonos:{}, emails:{}}
  for (let i = 1; i < datos.length; i++) {
    const bruto = String(datos[i][cN] || '').trim();
    if (!bruto) continue;
    const k = mcNorm(bruto);
    if (!k) continue;
    if (!variantes[k]) variantes[k] = { original: bruto, ot: 0, monto: 0, fonos: {}, emails: {} };
    const v = variantes[k];
    v.ot++;
    v.monto += cM >= 0 ? mcNum(datos[i][cM]) : 0;
    if (cT >= 0) { const f = mcFono(datos[i][cT]); if (f) v.fonos[f] = 1; }
    if (cE >= 0) { const e = mcEmail(datos[i][cE]); if (e) v.emails[e] = 1; }
  }

  const claves = Object.keys(variantes);

  // 2. Unir variantes en grupos (union-find) por evidencia fuerte y débil
  const padre = {};
  claves.forEach((k) => { padre[k] = k; });
  function raiz(x) { while (padre[x] !== x) { padre[x] = padre[padre[x]]; x = padre[x]; } return x; }
  function unir(a, b) { const ra = raiz(a), rb = raiz(b); if (ra !== rb) padre[rb] = ra; }

  const evidencia = {};
  const porFono = {}, porEmail = {};
  claves.forEach((k) => {
    Object.keys(variantes[k].fonos).forEach((f) => { (porFono[f] = porFono[f] || []).push(k); });
    Object.keys(variantes[k].emails).forEach((e) => { (porEmail[e] = porEmail[e] || []).push(k); });
  });
  // evidencia fuerte: mismo teléfono o mismo correo
  Object.keys(porFono).forEach((f) => {
    const g = porFono[f];
    for (let i = 1; i < g.length; i++) { unir(g[0], g[i]); evidencia[g[i]] = 'mismo teléfono'; evidencia[g[0]] = evidencia[g[0]] || 'mismo teléfono'; }
  });
  Object.keys(porEmail).forEach((e) => {
    const g = porEmail[e];
    for (let i = 1; i < g.length; i++) { unir(g[0], g[i]); evidencia[g[i]] = 'mismo correo'; evidencia[g[0]] = evidencia[g[0]] || 'mismo correo'; }
  });
  // evidencia débil: nombres muy parecidos (solo entre nombres con la misma inicial,
  // para no comparar todos contra todos en una base de miles de valores)
  const porInicial = {};
  claves.forEach((k) => { (porInicial[k.charAt(0)] = porInicial[k.charAt(0)] || []).push(k); });
  Object.keys(porInicial).forEach((ini) => {
    const g = porInicial[ini];
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) {
        if (raiz(g[i]) === raiz(g[j])) continue;
        if (mcSimilitud(g[i], g[j]) >= MC_UMBRAL) {
          unir(g[i], g[j]);
          evidencia[g[j]] = evidencia[g[j]] || 'nombre parecido';
          evidencia[g[i]] = evidencia[g[i]] || 'nombre parecido';
        }
      }
    }
  });

  // 3. Armar grupos con más de una variante
  const grupos = {};
  claves.forEach((k) => { (grupos[raiz(k)] = grupos[raiz(k)] || []).push(k); });

  const filas = [];
  let nGrupo = 0;
  Object.keys(grupos).forEach((r) => {
    const miembros = grupos[r];
    if (miembros.length < 2) return;
    nGrupo++;
    // canónico sugerido: la variante con más OTs (desempata por facturación)
    miembros.sort((a, b) => (variantes[b].ot - variantes[a].ot) || (variantes[b].monto - variantes[a].monto));
    const canon = variantes[miembros[0]].original;
    miembros.forEach((k) => {
      filas.push([
        nGrupo,
        variantes[k].original,
        variantes[k].ot,
        variantes[k].monto,
        evidencia[k] || 'nombre parecido',
        canon,
        false
      ]);
    });
  });

  // 4. Escribir la pestaña de mapeo.
  //    Se conservan las filas que ya estaban marcadas en "Aplicar" (incluidas
  //    las que hayas agregado a mano), para que regenerar no borre tu trabajo.
  let mapa = ss.getSheetByName(MC_HOJA_MAPA);
  const previas = [];
  if (mapa) {
    const vp = mapa.getDataRange().getValues();
    const yaListadas = {};
    filas.forEach((f) => { yaListadas[mcNorm(f[1])] = 1; });
    for (let i = 1; i < vp.length; i++) {
      if (vp[i][6] !== true) continue;
      const variante = String(vp[i][1] || '').trim();
      if (!variante || yaListadas[mcNorm(variante)]) continue;
      previas.push([vp[i][0] || 0, variante, vp[i][2] || '', vp[i][3] || '', 'confirmado antes', vp[i][5] || '', true]);
    }
  } else {
    mapa = ss.insertSheet(MC_HOJA_MAPA);
  }
  filas.push.apply(filas, previas);
  mapa.clear();

  const cabecera = ['Grupo', 'Variante en la base', 'OTs', 'Facturación', 'Evidencia', 'Nombre canónico', 'Aplicar'];
  mapa.getRange(1, 1, 1, cabecera.length).setValues([cabecera])
      .setFontWeight('bold').setBackground('#111922').setFontColor('#ffffff');

  if (!filas.length) {
    mapa.getRange(2, 1).setValue('No se detectaron grupos de variantes con los criterios actuales.');
    SpreadsheetApp.getUi().alert('Sin duplicados detectados con umbral ' + MC_UMBRAL + '.');
    return;
  }

  mapa.getRange(2, 1, filas.length, cabecera.length).setValues(filas);
  mapa.getRange(2, 4, filas.length, 1).setNumberFormat('$#,##0');
  mapa.getRange(2, 7, filas.length, 1).insertCheckboxes();
  mapa.setFrozenRows(1);
  mapa.autoResizeColumns(1, cabecera.length);
  // Bandas por grupo para leerlo cómodo
  for (let i = 0; i < filas.length; i++) {
    if (filas[i][0] % 2 === 0) mapa.getRange(i + 2, 1, 1, cabecera.length).setBackground('#f1f5f9');
  }

  SpreadsheetApp.getUi().alert(
    'Se detectaron ' + nGrupo + ' grupos de variantes (' + filas.length + ' nombres).\n\n' +
    'Revisa la pestaña ' + MC_HOJA_MAPA + ':\n' +
    '· Corrige el "Nombre canónico" si no es el correcto.\n' +
    '· Marca "Aplicar" SOLO en los grupos que confirmes.\n\n' +
    'Después ejecuta el paso 2. Los grupos sin marcar no se tocan.'
  );
}

/* ------------------- PASO 2 · aplicar los confirmados ------------------- */

function mapaClientesAplicar() {
  const ss = SpreadsheetApp.getActive();
  const mapa = ss.getSheetByName(MC_HOJA_MAPA);
  if (!mapa) throw new Error('Falta la pestaña ' + MC_HOJA_MAPA + '. Ejecuta primero el paso 1.');

  const m = mapa.getDataRange().getValues();
  const dicc = {};   // norm(variante) -> canónico
  let confirmados = 0;
  for (let i = 1; i < m.length; i++) {
    if (m[i][6] !== true) continue;              // solo los marcados
    const variante = String(m[i][1] || '').trim();
    const canon = String(m[i][5] || '').trim();
    if (!variante || !canon || variante === canon) continue;
    dicc[mcNorm(variante)] = canon;
    confirmados++;
  }
  if (!confirmados) {
    SpreadsheetApp.getUi().alert('No hay ninguna fila marcada en "Aplicar". No se modificó nada.');
    return;
  }

  const sh = mcHojaDatos();
  const rango = sh.getDataRange();
  const datos = rango.getValues();
  const cab = datos[0];
  const cN = mcIndiceCols(cab, MC_COL_NOMBRE);
  if (cN < 0) throw new Error('No se encontró la columna de Propietario.');

  // Columna de respaldo: se crea una sola vez, al final de la hoja
  let cR = mcIndiceCols(cab, [MC_COL_RESPALDO]);
  if (cR < 0) {
    cR = cab.length;
    sh.getRange(1, cR + 1).setValue(MC_COL_RESPALDO).setFontWeight('bold');
    cab.push(MC_COL_RESPALDO);
  }

  const colNombre = [], colResp = [], n = datos.length - 1;
  let cambiadas = 0;
  for (let i = 1; i < datos.length; i++) {
    const actual = String(datos[i][cN] || '').trim();
    const respaldoPrevio = cR < datos[i].length ? String(datos[i][cR] || '') : '';
    const canon = dicc[mcNorm(actual)];
    if (canon && canon !== actual) {
      colNombre.push([canon]);
      // Solo se respalda la PRIMERA vez, para no perder el original tras dos pasadas
      colResp.push([respaldoPrevio || actual]);
      cambiadas++;
    } else {
      colNombre.push([datos[i][cN]]);
      colResp.push([respaldoPrevio]);
    }
  }

  sh.getRange(2, cN + 1, n, 1).setValues(colNombre);
  sh.getRange(2, cR + 1, n, 1).setValues(colResp);

  SpreadsheetApp.getUi().alert(
    'Listo.\n\n' +
    'Grupos aplicados: ' + confirmados + '\n' +
    'Filas modificadas: ' + cambiadas + '\n\n' +
    'El nombre original quedó guardado en la columna "' + MC_COL_RESPALDO + '".\n' +
    'Si algo salió mal, usa "Revertir última aplicación".'
  );
}

/* ------------------- Reversión ------------------------------------------ */

function mapaClientesRevertir() {
  const ui = SpreadsheetApp.getUi();
  const ok = ui.alert('Revertir', 'Se restaurará el Propietario original en todas las filas que tengan respaldo. ¿Continuar?', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;

  const sh = mcHojaDatos();
  const datos = sh.getDataRange().getValues();
  const cab = datos[0];
  const cN = mcIndiceCols(cab, MC_COL_NOMBRE);
  const cR = mcIndiceCols(cab, [MC_COL_RESPALDO]);
  if (cR < 0) { ui.alert('No hay columna de respaldo: no se ha aplicado ningún cambio.'); return; }

  const col = [];
  let n = 0;
  for (let i = 1; i < datos.length; i++) {
    const resp = String(datos[i][cR] || '').trim();
    if (resp) { col.push([resp]); n++; } else { col.push([datos[i][cN]]); }
  }
  sh.getRange(2, cN + 1, col.length, 1).setValues(col);
  ui.alert('Se restauraron ' + n + ' filas.');
}

/* ------------------- Normalización de patentes -------------------------- */

function normalizarPatentes() {
  const sh = mcHojaDatos();
  const datos = sh.getDataRange().getValues();
  const cab = datos[0];
  const cP = mcIndiceCols(cab, MC_COL_PATENTE);
  if (cP < 0) throw new Error('No se encontró la columna Patente.');

  let cPN = mcIndiceCols(cab, [MC_COL_PAT_NORM]);
  if (cPN < 0) {
    cPN = cab.length;
    sh.getRange(1, cPN + 1).setValue(MC_COL_PAT_NORM).setFontWeight('bold');
  }

  const col = [];
  const distintas = {};
  let conFormatoRaro = 0;
  for (let i = 1; i < datos.length; i++) {
    const bruto = String(datos[i][cP] || '');
    const norm = mcPatente(bruto);
    col.push([norm]);
    if (norm) {
      if (!distintas[norm]) distintas[norm] = {};
      distintas[norm][bruto] = 1;
    }
  }
  sh.getRange(2, cPN + 1, col.length, 1).setValues(col);

  // Reporte de patentes escritas de más de una forma
  const conflictivas = [];
  Object.keys(distintas).forEach((k) => {
    const formas = Object.keys(distintas[k]);
    if (formas.length > 1) { conflictivas.push(k + ': ' + formas.join(' | ')); conFormatoRaro++; }
  });

  SpreadsheetApp.getUi().alert(
    'Columna "' + MC_COL_PAT_NORM + '" actualizada.\n\n' +
    'Patentes únicas: ' + Object.keys(distintas).length + '\n' +
    'Escritas de más de una forma: ' + conFormatoRaro + '\n\n' +
    (conflictivas.length ? conflictivas.slice(0, 15).join('\n') : 'Sin conflictos de formato.') +
    (conflictivas.length > 15 ? '\n…y ' + (conflictivas.length - 15) + ' más.' : '') +
    '\n\nEsta columna equivale a vehiculos.patente_norm en Supabase (migración 49).'
  );
}
