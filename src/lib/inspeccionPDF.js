/* ============================================================================
   PDF de la Inspección de Ingreso · formato oficial DIDIAL
   ----------------------------------------------------------------------------
   Réplica del documento en papel (Orden de Trabajo Nº 13544 como referencia):
   cabecera de empresa, datos de cliente y vehículo en dos columnas, "Cliente
   Solicita", políticas de servicio y bloque de firma.

   Se agrega lo que el papel no tiene y la inspección sí: luces de advertencia,
   inventario, combustible, daños numerados con su descripción y checklist.

   Usa window.print() como el resto de los documentos del sistema (presupuestos,
   cotización rápida). No requiere jsPDF: el navegador imprime a vectorial y el
   usuario elige "Guardar como PDF".
   ========================================================================== */

const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))
const fecha = (f) => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-CL') : ''

const NIVEL = ['E', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8', 'F']

export function imprimirInspeccion(datos) {
  const {
    numero, fecha: fch, patente, marca, modelo, anio, color, km, chasis,
    cliente, rut, direccion, email, telefono, dueno,
    trabajo, observacionesCliente, observacionesAsesor,
    luces = [], inventario = {}, combustible = 4, danos = [], checklist = {},
    firmaUrl, fotos = [], asesor
  } = datos

  const inv = Object.entries(inventario).filter(([, v]) => v).map(([k]) => k)
  const chkFilas = Object.entries(checklist)
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td class="c">${v === true || v === 'ok' ? '✓' : v === false || v === 'mal' ? '✕' : '—'}</td></tr>`)
    .join('')

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Inspección de ingreso${numero ? ' N° ' + esc(numero) : ''}</title>
<style>
  @page { size: letter portrait; margin: 12mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 10.5pt; color: #000; margin: 0; }
  .hdr { display: flex; justify-content: space-between; align-items: flex-start; }
  .emp { font-weight: bold; line-height: 1.35; text-transform: uppercase; }
  .emp .sub { font-weight: normal; text-transform: none; font-size: 9.5pt; }
  .doc { text-align: right; font-weight: bold; font-size: 12pt; line-height: 1.4; }
  .pag { text-align: right; font-size: 9pt; margin-top: 4px; }
  hr { border: 0; border-top: 1px solid #000; margin: 6px 0; }
  .datos { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 18px; margin: 4px 0 2px; }
  .datos div { line-height: 1.5; }
  .lbl { font-weight: normal; }
  .val { font-weight: normal; }
  h3 { font-size: 10.5pt; font-weight: bold; margin: 8px 0 3px; }
  .txt { padding-left: 14px; line-height: 1.5; white-space: pre-wrap; }
  .pol { font-size: 9.5pt; line-height: 1.45; padding-left: 14px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  td, th { padding: 1.5px 4px; }
  .box { border: 1px solid #000; padding: 5px 7px; }
  .box h4 { margin: 0 0 3px; font-size: 9.5pt; }
  .c { text-align: center; }
  .r { text-align: right; }
  .chips span { display: inline-block; border: 1px solid #000; padding: 1px 5px; margin: 1px; font-size: 8.5pt; }
  .comb { display: flex; align-items: center; gap: 5px; }
  .barra { flex: 1; height: 13px; border: 1px solid #000; position: relative; }
  .barra i { position: absolute; left: 0; top: 0; bottom: 0; background: #000; }
  .firmas { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 22px; margin-top: 26px; }
  .firmas .l { border-top: 1px solid #000; padding-top: 3px; text-align: center; font-size: 9pt; }
  .firmaimg { height: 42px; display: block; margin: 0 auto -4px; }
  .fotos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 4px; }
  .fotos img { width: 100%; height: 62px; object-fit: cover; border: 1px solid #000; }
  .total { text-align: right; font-weight: bold; margin-top: 14px; font-size: 11pt; }
  @media print { .noprint { display: none !important; } }
</style></head><body>

  <div class="hdr">
    <div class="emp">
      Servicio Automotriz Didial Ltda<br>
      Avda. Cuatro Esquinas 759, La Serena
      <div class="sub">serviciotecnico@didial.cl<br>+569 89748626</div>
    </div>
    <div>
      <div class="doc">
        INSPECCIÓN DE INGRESO${numero ? ' N° ' + esc(numero) : ''}<br>
        FECHA: ${esc(fecha(fch) || new Date().toLocaleDateString('es-CL'))}
      </div>
      <div class="pag">Página: 1</div>
    </div>
  </div>
  <hr>

  <div class="datos">
    <div><span class="lbl">Nombre Cliente:</span> <span class="val">${esc(cliente)}</span></div>
    <div><span class="lbl">R.U.T.:</span> <span class="val">${esc(rut)}</span></div>
    <div><span class="lbl">Dirección:</span> <span class="val">${esc(direccion)}</span></div>
    <div><span class="lbl">Dueño Vehículo:</span> <span class="val">${esc(dueno || cliente)}</span></div>
    <div><span class="lbl">email:</span> <span class="val">${esc(email)}</span></div>
    <div><span class="lbl">Fonos:</span> <span class="val">${esc(telefono)}</span></div>
    <div><span class="lbl">Marca:</span> <span class="val">${esc(marca)}</span> &nbsp;&nbsp;
         <span class="lbl">Modelo:</span> <span class="val">${esc(modelo)}</span></div>
    <div><span class="lbl">Color:</span> <span class="val">${esc(color)}</span> &nbsp;&nbsp;
         <span class="lbl">Año:</span> <span class="val">${esc(anio)}</span></div>
    <div><span class="lbl">Chasis:</span> <span class="val">${esc(chasis)}</span></div>
    <div><span class="lbl">Kilometraje:</span> <span class="val">${km ? Number(km).toLocaleString('es-CL') : '0'}</span> &nbsp;&nbsp;
         <span class="lbl">Patente:</span> <span class="val">${esc(patente)}</span></div>
  </div>
  <hr>

  <h3>Cliente Solicita:</h3>
  <div class="txt">${esc(trabajo || '')}${observacionesCliente ? '\n' + esc(observacionesCliente) : ''}</div>

  <h3>Estado del vehículo al ingreso</h3>
  <div class="cols">
    <div class="box">
      <h4>Nivel de combustible</h4>
      <div class="comb">
        <span>E</span>
        <span class="barra"><i style="width:${Math.round((combustible / 8) * 100)}%"></i></span>
        <span>F</span>
        <span>(${NIVEL[combustible] || ''})</span>
      </div>
      <h4 style="margin-top:6px">Luces de advertencia encendidas</h4>
      <div class="chips">${luces.length ? luces.map((l) => `<span>${esc(l)}</span>`).join('') : '<span>Ninguna</span>'}</div>
    </div>
    <div class="box">
      <h4>Inventario recibido</h4>
      <div class="chips">${inv.length ? inv.map((i) => `<span>${esc(i)}</span>`).join('') : '<span>Sin elementos declarados</span>'}</div>
    </div>
  </div>

  ${danos.length ? `
  <h3>Daños registrados al ingreso</h3>
  <table>
    <tr><th style="width:26px" class="c">N°</th><th>Descripción</th></tr>
    ${danos.map((x) => `<tr><td class="c">${x.numero}</td><td>${esc(x.descripcion || 'Sin descripción')}</td></tr>`).join('')}
  </table>` : '<h3>Daños registrados al ingreso</h3><div class="txt">Sin daños registrados.</div>'}

  ${chkFilas ? `<h3>Verificación</h3><table>${chkFilas}</table>` : ''}

  ${observacionesAsesor ? `<h3>Observaciones del asesor</h3><div class="txt">${esc(observacionesAsesor)}</div>` : ''}

  ${fotos.length ? `<h3>Fotografías (${fotos.length})</h3>
  <div class="fotos">${fotos.slice(0, 8).map((f) => `<img src="${esc(f.url || f)}">`).join('')}</div>` : ''}

  <h3>Políticas de Servicio</h3>
  <div class="pol">
    1) CLIENTE: Autorizo a Servicio Automotriz DIDIAL Ltda. Para efectuar trabajos indicados en esta orden de
    ingreso y en presupuesto efectuado. También autorizo la movilización del vehículo por calles y carretera con
    el fin de efectuar pruebas pertinentes.<br>
    2) EMPRESA: La entidad solo se hace responsable por el servicio prestado conforme a la petición del cliente,
    NO por desperfectos ajenos al trabajo efectuado, ya sea por cumplimiento de la vida útil de las piezas del
    mismo vehículo o por el uso dado por el cliente.
  </div>

  <div class="firmas">
    <div>
      ${firmaUrl ? `<img class="firmaimg" src="${esc(firmaUrl)}">` : '<div style="height:42px"></div>'}
      <div class="l">NOMBRE Y APELLIDO</div>
    </div>
    <div><div style="height:42px"></div><div class="l">N° DE CELULAR</div></div>
    <div><div style="height:42px"></div><div class="l">¿ERES DUEÑO O CONDUCTOR?</div></div>
  </div>

  <div class="firmas" style="grid-template-columns:1fr 1fr; margin-top:18px">
    <div>
      ${firmaUrl ? `<img class="firmaimg" src="${esc(firmaUrl)}">` : '<div style="height:42px"></div>'}
      <div class="l">FIRMA CLIENTE INGRESO</div>
    </div>
    <div><div style="height:42px"></div><div class="l">RECIBE${asesor ? ' · ' + esc(asesor) : ''}</div></div>
  </div>

  <div class="total">TOTAL: 0</div>

  <div class="noprint" style="text-align:center;margin-top:20px;font-family:sans-serif">
    <button onclick="window.print()" style="padding:10px 20px;font-size:14px;cursor:pointer">Imprimir / Guardar PDF</button>
  </div>

  <script>
    // Espera a que carguen firma y fotos antes de abrir el diálogo, o salen en blanco
    (function () {
      var listo = false;
      function go() { if (listo) return; listo = true; setTimeout(function () { window.print(); }, 250); }
      if (document.images.length === 0) { window.onload = go; return; }
      var n = 0, total = document.images.length;
      function cuenta() { if (++n >= total) go(); }
      for (var i = 0; i < total; i++) {
        if (document.images[i].complete) cuenta();
        else { document.images[i].onload = cuenta; document.images[i].onerror = cuenta; }
      }
      setTimeout(go, 3000);   // por si alguna imagen nunca responde
    })();
  <\/script>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) { alert('El navegador bloqueó la ventana emergente. Habilítala para imprimir.'); return }
  w.document.write(html)
  w.document.close()
}
