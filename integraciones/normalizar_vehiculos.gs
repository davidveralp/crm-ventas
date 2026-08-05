/**
 * DIDIAL · Normalización de MARCAS y MODELOS de vehículos
 * ------------------------------------------------------------------------------
 * PROBLEMA DETECTADO EN LA BASE (columnas F=Marca, G=Modelo, H=Cilindrada)
 *
 *   1. Mayúsculas/minúsculas mezcladas .... "Toyota"/"TOYOTA", "hilux"/"HILUX"
 *   2. Espacios sobrantes al final ........ "explorer ", "HILUX ", "F PACE "
 *   3. Erratas y acentos en la marca ...... "MERCEDEZ BENZ", "CITROËN"
 *   4. Cilindrada dentro del modelo ....... "HILUX 2.4"  (¡y ya existe la columna H!)
 *   5. Tracción dentro del modelo ......... "NP 300 4X4", "RANGER 4X2", "XTRAIL 4X4"
 *   6. Transmisión dentro del modelo ...... "I 10 MT", "SANTA FE AT", "New XV AT"
 *   7. Versión/equipamiento en el modelo .. "TUCSON GL", "TERRITORY TITANIUM",
 *                                           "grand cherokee laredo", "FULWIN SPOT"
 *   8. Espaciado inconsistente ............ "D MAX"/"DMAX", "BT 50"/"BT50",
 *                                           "I 10"/"I10", "4 runner"/"4RUNNER"
 *
 * ESTRATEGIA: dos capas, porque no todo se puede resolver igual.
 *
 *   CAPA AUTOMÁTICA (determinista, sin revisión)
 *     Los puntos 1 a 6 son reglas exactas. La cilindrada, la tracción y la
 *     transmisión se EXTRAEN del modelo y se llevan a columnas propias.
 *     Probado contra la base real: no rompe modelos que son números
 *     (M4, F150, T60, BT 50, 560 OTTO, VAN 700, Mazda 5).
 *
 *   CAPA REVISADA (pestaña Map_Vehiculos)
 *     Los puntos 7 y 8 exigen criterio: "GRAND NOMADE" es modelo completo pero
 *     "GRAND CHEROKEE LAREDO" lleva versión; "D MAX" y "DMAX" son el mismo
 *     modelo pero ningún algoritmo lo sabe sin conocer el catálogo del fabricante.
 *
 * COLUMNAS QUE CREA (ninguna se sobrescribe sin respaldo)
 *     Marca Original · Modelo Original ..... respaldo, para poder revertir
 *     Tracción ............................. 4X4 / 4X2 / AWD / 4WD / 2WD
 *     Transmisión .......................... AT / MT / CVT / DSG / AMT
 *     Versión .............................. GL, TITANIUM, LAREDO, SPORT…
 *     Cilindrada (H) ....................... solo se RELLENA si está vacía;
 *                                            nunca se pisa un valor existente
 *
 * INSTALACIÓN
 *   Extensiones → Apps Script → Archivo nuevo → pegar → Guardar.
 *   Convive con normalizar_clientes.gs y los demás (prefijos propios).
 *   Agrega el menú "DIDIAL · Vehículos".
 */

const MV_HOJA        = 'Hoja 1';
const MV_HOJA_MAPA   = 'Map_Vehiculos';
const MV_HOJA_MARCAS = 'Map_Marcas';

const MV_C_MARCA   = ['Marca'];
const MV_C_MODELO  = ['Modelo'];
const MV_C_CILIND  = ['Cilindrada'];
const MV_C_PATENTE = ['Patente'];

const MV_BK_MARCA  = 'Marca Original';
const MV_BK_MODELO = 'Modelo Original';
const MV_N_TRAC    = 'Tracción';
const MV_N_TRANS   = 'Transmisión';
const MV_N_VERSION = 'Versión';

/** Catálogo de marcas del mercado chileno. Clave = forma normalizada, valor = canónica.
 *  Editable desde la pestaña Map_Marcas si aparece una marca nueva. */
const MV_MARCAS = {
  'TOYOTA':'Toyota', 'CHEVROLET':'Chevrolet', 'HYUNDAI':'Hyundai', 'KIA':'Kia',
  'NISSAN':'Nissan', 'SUZUKI':'Suzuki', 'MAZDA':'Mazda', 'MITSUBISHI':'Mitsubishi',
  'FORD':'Ford', 'PEUGEOT':'Peugeot', 'RENAULT':'Renault', 'CITROEN':'Citroën',
  'FIAT':'Fiat', 'JEEP':'Jeep', 'DODGE':'Dodge', 'RAM':'RAM', 'SUBARU':'Subaru',
  'HONDA':'Honda', 'VOLKSWAGEN':'Volkswagen', 'VW':'Volkswagen',
  'MERCEDES BENZ':'Mercedes Benz', 'MERCEDEZ BENZ':'Mercedes Benz',
  'MERCEDES':'Mercedes Benz', 'MERCEDEZ':'Mercedes Benz', 'BENZ':'Mercedes Benz',
  'BMW':'BMW', 'AUDI':'Audi', 'VOLVO':'Volvo', 'JAGUAR':'Jaguar',
  'LAND ROVER':'Land Rover', 'RANGE ROVER':'Land Rover', 'MINI':'MINI',
  'CHERY':'Chery', 'GREAT WALL':'Great Wall', 'GREATWALL':'Great Wall',
  'HAVAL':'Haval', 'CHANGAN':'Changan', 'JAC':'JAC', 'DFSK':'DFSK',
  'DONGFENG':'Dongfeng', 'MAXUS':'Maxus', 'MG':'MG', 'BAIC':'BAIC',
  'BRILLIANCE':'Brilliance', 'SWM':'SWM', 'FOTON':'Foton', 'GEELY':'Geely',
  'BYD':'BYD', 'OPEL':'Opel', 'SEAT':'SEAT', 'SKODA':'Škoda',
  'SSANGYONG':'SsangYong', 'SSANG YONG':'SsangYong', 'DAIHATSU':'Daihatsu',
  'ISUZU':'Isuzu', 'IVECO':'Iveco', 'HINO':'Hino', 'JETOUR':'Jetour',
  'LEXUS':'Lexus', 'INFINITI':'Infiniti', 'PORSCHE':'Porsche', 'TESLA':'Tesla'
};

/**
 * Umbral de parecido entre modelos de una misma marca. Calibrado contra la base:
 *   0.889  MARCH / MARCHA        → unir (errata)
 *   0.857  TIIDA / TIDA          → unir (errata)
 *   ------------------------------ 0.85 (umbral)
 *   0.625  VITARA / GRAND VITARA → separar (modelos distintos)
 *   0.600  NP 300 / NP 200       → separar
 *   0.600  ACCENT / ASCENT       → separar
 *   0.500  206 / 207             → separar
 *   0.364  SOLUTO / SORENTO      → separar
 *   0.000  C35 / C45 · T60 / T70 → separar
 * Los modelos que se distinguen solo por un número (NP 300/NP 200, F150/F250,
 * C35/C45) quedan bien separados: es el riesgo más caro y está cubierto.
 */
const MV_UMBRAL = 0.85;

/* Reglas deterministas. Probadas contra la base real. */
const MV_RX_CIL   = /\b(\d{1,2})[.,](\d)\b/;
const MV_RX_TRAC  = /\b(4\s*X\s*4|4\s*X\s*2|AWD|4WD|2WD)\b/;
const MV_RX_TRANS = /\b(TIPTRONIC|CVT|DSG|AMT|AUT|MEC|AT|MT)\b/;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('DIDIAL · Vehículos')
    .addItem('1. Analizar marcas y modelos', 'mapaVehiculosGenerar')
    .addItem('2. Aplicar normalización', 'mapaVehiculosAplicar')
    .addItem('Revertir última aplicación', 'mapaVehiculosRevertir')
    .addToUi();
}

/* ------------------------------ utilidades ------------------------------ */

function mvUp(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

function mvIdx(cab, cands) {
  for (var i = 0; i < cands.length; i++) {
    var j = cab.indexOf(cands[i]);
    if (j >= 0) return j;
  }
  var n = cab.map(function (h) { return mvUp(h); });
  for (var k = 0; k < cands.length; k++) {
    var p = n.indexOf(mvUp(cands[k]));
    if (p >= 0) return p;
  }
  return -1;
}

function mvHoja() {
  var sh = SpreadsheetApp.getActive().getSheetByName(MV_HOJA);
  if (!sh) throw new Error('No existe la pestaña "' + MV_HOJA + '".');
  return sh;
}

/** Marca canónica: usa el catálogo, y si no la encuentra deja Título Capitalizado. */
function mvMarca(bruto, extra) {
  var k = mvUp(bruto);
  if (!k) return '';
  if (extra && extra[k]) return extra[k];
  if (MV_MARCAS[k]) return MV_MARCAS[k];
  // sin acentos ni espacios, por si viene "CITROEN" o "GREATWALL"
  var k2 = k.replace(/\s/g, '');
  for (var key in MV_MARCAS) {
    if (key.replace(/\s/g, '') === k2) return MV_MARCAS[key];
  }
  return k.charAt(0) + k.slice(1).toLowerCase();
}

/** Separa el modelo en sus componentes. Devuelve {modelo, cil, trac, trans}. */
function mvPartir(modelo) {
  var m = mvUp(modelo);
  var cil = '', trac = '', trans = '';
  var c = m.match(MV_RX_CIL);
  if (c) { cil = c[1] + '.' + c[2]; m = m.replace(MV_RX_CIL, ' '); }
  var t = m.match(MV_RX_TRAC);
  if (t) { trac = t[1].replace(/\s/g, ''); m = m.replace(MV_RX_TRAC, ' '); }
  var x = m.match(MV_RX_TRANS);
  if (x) { trans = x[1]; m = m.replace(MV_RX_TRANS, ' '); }
  m = m.replace(/\s+/g, ' ').trim();
  return { modelo: m, cil: cil, trac: trac, trans: trans };
}

function mvSim(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  var bg = function (s) {
    var m = {};
    for (var i = 0; i < s.length - 1; i++) { var g = s.substr(i, 2); m[g] = (m[g] || 0) + 1; }
    return m;
  };
  var A = bg(a), B = bg(b), inter = 0, total = 0;
  for (var g in A) { total += A[g]; if (B[g]) inter += Math.min(A[g], B[g]); }
  for (var h in B) total += B[h];
  return (2 * inter) / total;
}

/** Catálogo de marcas ampliable desde la pestaña Map_Marcas. */
function mvMarcasExtra() {
  var sh = SpreadsheetApp.getActive().getSheetByName(MV_HOJA_MARCAS);
  var extra = {};
  if (!sh) return extra;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    var de = mvUp(v[i][0]), a = String(v[i][1] || '').trim();
    if (de && a) extra[de] = a;
  }
  return extra;
}

/* ------------------- PASO 1 · analizar (no modifica nada) --------------- */

function mapaVehiculosGenerar() {
  var ss = SpreadsheetApp.getActive();
  var sh = mvHoja();
  var datos = sh.getDataRange().getValues();
  var cab = datos[0];

  var cMa = mvIdx(cab, MV_C_MARCA), cMo = mvIdx(cab, MV_C_MODELO);
  var cCi = mvIdx(cab, MV_C_CILIND), cPa = mvIdx(cab, MV_C_PATENTE);
  if (cMa < 0 || cMo < 0) throw new Error('No se encontraron las columnas Marca y Modelo.');

  var extra = mvMarcasExtra();

  // Agrupar: marca canónica -> modelo despiezado -> conteo
  var mapa = {};          // "MARCA||MODELO" -> {marca, modelo, ot, patentes:{}, trac, trans, cil}
  var marcasVistas = {};  // marca cruda -> {canon, ot}
  for (var i = 1; i < datos.length; i++) {
    var brutoMa = String(datos[i][cMa] || '').trim();
    var brutoMo = String(datos[i][cMo] || '').trim();
    if (!brutoMa && !brutoMo) continue;

    var canon = mvMarca(brutoMa, extra);
    var kMa = mvUp(brutoMa);
    if (kMa) {
      if (!marcasVistas[kMa]) marcasVistas[kMa] = { canon: canon, ot: 0, bruto: brutoMa };
      marcasVistas[kMa].ot++;
    }

    var p = mvPartir(brutoMo);
    var k = canon + '||' + p.modelo;
    if (!mapa[k]) mapa[k] = { marca: canon, modelo: p.modelo, ot: 0, patentes: {}, trac: {}, trans: {}, cilVacia: 0 };
    mapa[k].ot++;
    if (cPa >= 0) mapa[k].patentes[String(datos[i][cPa] || '')] = 1;
    if (p.trac) mapa[k].trac[p.trac] = 1;
    if (p.trans) mapa[k].trans[p.trans] = 1;
    if (cCi >= 0 && String(datos[i][cCi] || '').trim() === '' && p.cil) mapa[k].cilVacia++;
  }

  /* ---- Pestaña Map_Marcas: marcas crudas y su canónica ---- */
  var shM = ss.getSheetByName(MV_HOJA_MARCAS);
  if (!shM) shM = ss.insertSheet(MV_HOJA_MARCAS);
  shM.clear();
  shM.getRange(1, 1, 1, 4).setValues([['Marca en la base', 'Marca canónica', 'OTs', 'Reconocida']])
     .setFontWeight('bold').setBackground('#111922').setFontColor('#ffffff');
  var filasM = [];
  Object.keys(marcasVistas).sort(function (a, b) { return marcasVistas[b].ot - marcasVistas[a].ot; })
    .forEach(function (k) {
      var reconocida = !!(MV_MARCAS[k] || extra[k]);
      filasM.push([marcasVistas[k].bruto, marcasVistas[k].canon, marcasVistas[k].ot, reconocida ? 'sí' : 'REVISAR']);
    });
  if (filasM.length) {
    shM.getRange(2, 1, filasM.length, 4).setValues(filasM);
    for (var f = 0; f < filasM.length; f++) {
      if (filasM[f][3] === 'REVISAR') shM.getRange(f + 2, 1, 1, 4).setBackground('#fdf6e3');
    }
  }
  shM.setFrozenRows(1);
  shM.autoResizeColumns(1, 4);

  /* ---- Pestaña Map_Vehiculos: modelos agrupados por marca ---- */
  var claves = Object.keys(mapa);
  // Agrupar variantes de modelo dentro de una misma marca
  var porMarca = {};
  claves.forEach(function (k) { (porMarca[mapa[k].marca] = porMarca[mapa[k].marca] || []).push(k); });

  var filas = [];
  Object.keys(porMarca).sort().forEach(function (marca) {
    var ks = porMarca[marca];
    // union-find por parecido de modelo o por prefijo compartido
    var padre = {};
    ks.forEach(function (k) { padre[k] = k; });
    function raiz(x) { while (padre[x] !== x) { padre[x] = padre[padre[x]]; x = padre[x]; } return x; }
    function unir(a, b) { var ra = raiz(a), rb = raiz(b); if (ra !== rb) padre[rb] = ra; }
    for (var i = 0; i < ks.length; i++) {
      for (var j = i + 1; j < ks.length; j++) {
        var A = mapa[ks[i]].modelo, B = mapa[ks[j]].modelo;
        if (!A || !B) continue;
        var sinEsp = A.replace(/\s/g, '') === B.replace(/\s/g, '');       // D MAX vs DMAX
        var prefijo = A.indexOf(B + ' ') === 0 || B.indexOf(A + ' ') === 0; // TUCSON vs TUCSON GL
        if (sinEsp || prefijo || mvSim(A, B) >= MV_UMBRAL) unir(ks[i], ks[j]);
      }
    }
    var grupos = {};
    ks.forEach(function (k) { (grupos[raiz(k)] = grupos[raiz(k)] || []).push(k); });
    Object.keys(grupos).forEach(function (r) {
      var g = grupos[r];
      // canónico: el más frecuente; si empatan, el más corto (sin versión)
      g.sort(function (a, b) {
        return (mapa[b].ot - mapa[a].ot) || (mapa[a].modelo.length - mapa[b].modelo.length);
      });
      var canon = mapa[g[0]].modelo;
      g.forEach(function (k) {
        var e = mapa[k];
        // versión sugerida = lo que sobra del modelo respecto del canónico
        var version = '';
        if (e.modelo !== canon && e.modelo.indexOf(canon + ' ') === 0) {
          version = e.modelo.slice(canon.length + 1);
        }
        filas.push([
          e.marca, e.modelo, e.ot, Object.keys(e.patentes).length,
          Object.keys(e.trac).join('/'), Object.keys(e.trans).join('/'),
          canon, version, g.length > 1
        ]);
      });
    });
  });

  var shV = ss.getSheetByName(MV_HOJA_MAPA);
  if (!shV) shV = ss.insertSheet(MV_HOJA_MAPA);
  shV.clear();
  var cabV = ['Marca', 'Modelo detectado', 'OTs', 'Vehículos', 'Tracción', 'Transmisión',
              'Modelo canónico', 'Versión', 'Aplicar'];
  shV.getRange(1, 1, 1, cabV.length).setValues([cabV])
     .setFontWeight('bold').setBackground('#111922').setFontColor('#ffffff');
  if (filas.length) {
    shV.getRange(2, 1, filas.length, cabV.length).setValues(filas);
    shV.getRange(2, 9, filas.length, 1).insertCheckboxes();
    for (var q = 0; q < filas.length; q++) {
      if (filas[q][1] !== filas[q][6]) shV.getRange(q + 2, 1, 1, cabV.length).setBackground('#fdf6e3');
    }
  }
  shV.setFrozenRows(1);
  shV.autoResizeColumns(1, cabV.length);

  SpreadsheetApp.getUi().alert(
    'Análisis listo. NO se modificó la base.\n\n' +
    'Map_Marcas: ' + filasM.length + ' marcas distintas.\n' +
    '  Las marcadas REVISAR no están en el catálogo: agrégalas ahí y vuelve a analizar.\n\n' +
    'Map_Vehiculos: ' + filas.length + ' combinaciones marca+modelo.\n' +
    '  En amarillo, las que cambiarían. Ajusta "Modelo canónico" y "Versión",\n' +
    '  y marca "Aplicar" solo en las que confirmes.\n\n' +
    'La cilindrada, tracción y transmisión se extraen automáticamente en el paso 2,\n' +
    'para TODAS las filas (eso no requiere confirmación fila por fila).'
  );
}

/* ------------------- PASO 2 · aplicar ----------------------------------- */

function mapaVehiculosAplicar() {
  var ss = SpreadsheetApp.getActive();
  var shV = ss.getSheetByName(MV_HOJA_MAPA);
  if (!shV) throw new Error('Falta ' + MV_HOJA_MAPA + '. Ejecuta primero el paso 1.');

  // Diccionario marca||modelo -> {canon, version}, solo confirmados
  var dicc = {}, confirmados = 0;
  var mv = shV.getDataRange().getValues();
  for (var i = 1; i < mv.length; i++) {
    if (mv[i][8] !== true) continue;
    var marca = String(mv[i][0] || '').trim();
    var det = mvUp(mv[i][1]);
    var canon = String(mv[i][6] || '').trim();
    if (!marca || !canon) continue;
    dicc[marca + '||' + det] = { canon: canon, version: String(mv[i][7] || '').trim() };
    confirmados++;
  }

  var sh = mvHoja();
  var datos = sh.getDataRange().getValues();
  var cab = datos[0];
  var cMa = mvIdx(cab, MV_C_MARCA), cMo = mvIdx(cab, MV_C_MODELO), cCi = mvIdx(cab, MV_C_CILIND);
  if (cMa < 0 || cMo < 0) throw new Error('No se encontraron las columnas Marca y Modelo.');

  // Crear columnas nuevas al final si no existen
  function asegurar(nombre) {
    var j = mvIdx(cab, [nombre]);
    if (j < 0) { j = cab.length; sh.getRange(1, j + 1).setValue(nombre).setFontWeight('bold'); cab.push(nombre); }
    return j;
  }
  var cBkMa = asegurar(MV_BK_MARCA), cBkMo = asegurar(MV_BK_MODELO);
  var cTr = asegurar(MV_N_TRAC), cTs = asegurar(MV_N_TRANS), cVe = asegurar(MV_N_VERSION);

  var extra = mvMarcasExtra();
  var n = datos.length - 1;
  var colMa = [], colMo = [], colBkMa = [], colBkMo = [], colTr = [], colTs = [], colVe = [], colCi = [];
  var camMarca = 0, camModelo = 0, extTrac = 0, extTrans = 0, relCil = 0;

  for (var r = 1; r < datos.length; r++) {
    var oMa = String(datos[r][cMa] || '').trim();
    var oMo = String(datos[r][cMo] || '').trim();
    var bkMa = cBkMa < datos[r].length ? String(datos[r][cBkMa] || '') : '';
    var bkMo = cBkMo < datos[r].length ? String(datos[r][cBkMo] || '') : '';

    var nuevaMa = oMa ? mvMarca(oMa, extra) : '';
    var p = mvPartir(oMo);
    var nuevoMo = p.modelo;
    var version = '';

    var hit = dicc[nuevaMa + '||' + p.modelo];
    if (hit) { nuevoMo = hit.canon; version = hit.version; }

    if (nuevaMa !== oMa) camMarca++;
    if (nuevoMo !== oMo) camModelo++;
    if (p.trac) extTrac++;
    if (p.trans) extTrans++;

    colMa.push([nuevaMa || datos[r][cMa]]);
    colMo.push([nuevoMo || datos[r][cMo]]);
    colBkMa.push([bkMa || oMa]);          // respaldo solo la primera vez
    colBkMo.push([bkMo || oMo]);
    colTr.push([p.trac]);
    colTs.push([p.trans]);
    colVe.push([version]);

    if (cCi >= 0) {
      var actual = String(datos[r][cCi] || '').trim();
      if (actual === '' && p.cil) { colCi.push([p.cil]); relCil++; }
      else { colCi.push([datos[r][cCi]]); }   // NUNCA se pisa un valor existente
    }
  }

  sh.getRange(2, cMa + 1, n, 1).setValues(colMa);
  sh.getRange(2, cMo + 1, n, 1).setValues(colMo);
  sh.getRange(2, cBkMa + 1, n, 1).setValues(colBkMa);
  sh.getRange(2, cBkMo + 1, n, 1).setValues(colBkMo);
  sh.getRange(2, cTr + 1, n, 1).setValues(colTr);
  sh.getRange(2, cTs + 1, n, 1).setValues(colTs);
  sh.getRange(2, cVe + 1, n, 1).setValues(colVe);
  if (cCi >= 0 && colCi.length) sh.getRange(2, cCi + 1, n, 1).setValues(colCi);

  SpreadsheetApp.getUi().alert(
    'Normalización aplicada.\n\n' +
    'Marcas corregidas: ' + camMarca + '\n' +
    'Modelos corregidos: ' + camModelo + ' (' + confirmados + ' reglas confirmadas)\n' +
    'Tracción extraída: ' + extTrac + '\n' +
    'Transmisión extraída: ' + extTrans + '\n' +
    'Cilindrada rellenada donde estaba vacía: ' + relCil + '\n\n' +
    'Los valores originales quedaron en "' + MV_BK_MARCA + '" y "' + MV_BK_MODELO + '".'
  );
}

/* ------------------- Reversión ------------------------------------------ */

function mapaVehiculosRevertir() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Revertir', 'Se restaurarán Marca y Modelo originales en las filas con respaldo. ¿Continuar?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  var sh = mvHoja();
  var datos = sh.getDataRange().getValues();
  var cab = datos[0];
  var cMa = mvIdx(cab, MV_C_MARCA), cMo = mvIdx(cab, MV_C_MODELO);
  var bMa = mvIdx(cab, [MV_BK_MARCA]), bMo = mvIdx(cab, [MV_BK_MODELO]);
  if (bMa < 0 || bMo < 0) { ui.alert('No hay columnas de respaldo: no se ha aplicado nada.'); return; }

  var colMa = [], colMo = [], n = 0;
  for (var i = 1; i < datos.length; i++) {
    var rMa = String(datos[i][bMa] || '').trim();
    var rMo = String(datos[i][bMo] || '').trim();
    colMa.push([rMa || datos[i][cMa]]);
    colMo.push([rMo || datos[i][cMo]]);
    if (rMa || rMo) n++;
  }
  sh.getRange(2, cMa + 1, colMa.length, 1).setValues(colMa);
  sh.getRange(2, cMo + 1, colMo.length, 1).setValues(colMo);
  ui.alert('Se restauraron ' + n + ' filas.');
}
