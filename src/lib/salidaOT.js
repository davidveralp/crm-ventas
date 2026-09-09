/* ============================================================================
   PDF de salida · Orden de Trabajo cerrada
   ----------------------------------------------------------------------------
   El documento que se le entrega al cliente al retirar el vehículo. Mismo
   formato que el acta de ingreso, pero con el detalle de lo que se hizo y su
   valor línea por línea.

   Se usa window.print() como el resto de los documentos del sistema: el
   navegador imprime a vectorial y el usuario elige "Guardar como PDF".
   ========================================================================== */

const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))
const clp = (n) => '$' + Number(n || 0).toLocaleString('es-CL')
const fecha = (d) => d ? new Date(d).toLocaleDateString('es-CL') : ''

const GRUPOS = [
  ['repuesto', 'Repuestos'],
  ['servicio', 'Mano de obra y servicios'],
  ['insumo', 'Insumos y lubricantes'],
  ['servicio_externo', 'Servicios externos']
]

export function imprimirSalidaOT(d) {
  const {
    otNumero, fechaIngreso, fechaEntrega, patente, marca, modelo, anio, color, km,
    cliente, rut, direccion, telefono, email,
    servicioPrincipal, serviciosAdicionales = [], observacionesEntrega, retiraNombre,
    detalle = [], descuento = 0, tipoDocumento, nroDocumento, asesor
  } = d

  const filasGrupo = (tipo) => {
    const ls = detalle.filter((x) => x.tipo === tipo)
    if (!ls.length) return ''
    const sub = ls.reduce((s, x) => s + (x.cantidad * x.precio_unit), 0)
    return `
      <tr class="grp"><td colspan="5">${esc(GRUPOS.find((g) => g[0] === tipo)[1])}</td></tr>
      ${ls.map((x) => `
        <tr>
          <td>${esc(x.codigo || '')}</td>
          <td>${esc(x.detalle)}</td>
          <td class="c">${Number(x.cantidad) % 1 === 0 ? x.cantidad : Number(x.cantidad).toFixed(2)}</td>
          <td class="r">${clp(x.precio_unit)}</td>
          <td class="r">${clp(x.cantidad * x.precio_unit)}</td>
        </tr>`).join('')}
      <tr class="sub"><td colspan="4" class="r">Subtotal ${esc(GRUPOS.find((g) => g[0] === tipo)[1].toLowerCase())}</td><td class="r">${clp(sub)}</td></tr>`
  }

  const bruto = detalle.reduce((s, x) => s + (x.cantidad * x.precio_unit), 0)
  const neto = bruto - Number(descuento || 0)

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>OT ${esc(otNumero || '')}</title>
<style>
  @page { size: letter portrait; margin: 12mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 10.5pt; color: #000; margin: 0; }
  .hdr { display: flex; justify-content: space-between; align-items: flex-start; }
  .emp { font-weight: bold; line-height: 1.35; text-transform: uppercase; }
  .emp .sub { font-weight: normal; text-transform: none; font-size: 9.5pt; }
  .doc { text-align: right; font-weight: bold; font-size: 12pt; line-height: 1.4; }
  hr { border: 0; border-top: 1px solid #000; margin: 6px 0; }
  .datos { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 18px; margin: 4px 0; }
  .datos div { line-height: 1.5; }
  h3 { font-size: 10.5pt; font-weight: bold; margin: 9px 0 3px; }
  .txt { padding-left: 14px; line-height: 1.5; white-space: pre-wrap; }
  table.det { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 3px; }
  table.det th { border-bottom: 1px solid #000; padding: 3px 4px; text-align: left; font-size: 9pt; }
  table.det td { padding: 2.5px 4px; border-bottom: .5px solid #ddd; }
  .grp td { font-weight: bold; background: #f0f0f0; padding-top: 5px !important; }
  .sub td { font-style: italic; border-bottom: 1px solid #000; }
  .c { text-align: center; } .r { text-align: right; }
  .tot { margin-top: 8px; margin-left: auto; width: 58%; }
  .tot tr td { padding: 2.5px 4px; }
  .tot .final td { font-weight: bold; font-size: 12pt; border-top: 1.5px solid #000; padding-top: 5px; }
  .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 30px; }
  .firmas .l { border-top: 1px solid #000; padding-top: 3px; text-align: center; font-size: 9pt; }
  .nota { font-size: 8.5pt; margin-top: 12px; line-height: 1.45; }
  @media print { .noprint { display: none !important; } }
</style></head><body>

  <div class="hdr">
    <div class="emp">
      Servicio Automotriz Didial Ltda<br>
      Avda. Cuatro Esquinas 759, La Serena
      <div class="sub">serviciotecnico@didial.cl · +569 89748626</div>
    </div>
    <div class="doc">
      ORDEN DE TRABAJO N° ${esc(otNumero || 's/n')}<br>
      SALIDA: ${esc(fecha(fechaEntrega) || new Date().toLocaleDateString('es-CL'))}
    </div>
  </div>
  <hr>

  <div class="datos">
    <div><span>Nombre Cliente:</span> ${esc(cliente)}</div>
    <div><span>R.U.T.:</span> ${esc(rut)}</div>
    <div><span>Dirección:</span> ${esc(direccion)}</div>
    <div><span>Fonos:</span> ${esc(telefono)}</div>
    <div><span>email:</span> ${esc(email)}</div>
    <div><span>Ingreso:</span> ${esc(fecha(fechaIngreso))}</div>
    <div><span>Marca:</span> ${esc(marca)} &nbsp; <span>Modelo:</span> ${esc(modelo)}</div>
    <div><span>Color:</span> ${esc(color)} &nbsp; <span>Año:</span> ${esc(anio)}</div>
    <div><span>Kilometraje:</span> ${km ? Number(km).toLocaleString('es-CL') : '0'}</div>
    <div><span>Patente:</span> ${esc(patente)}</div>
  </div>
  <hr>

  <h3>Trabajo realizado</h3>
  <div class="txt">${esc(servicioPrincipal || '')}${
    serviciosAdicionales.length ? '\n' + serviciosAdicionales.map((s, i) => `${i + 1}. ${esc(s)}`).join('\n') : ''}</div>

  <h3>Detalle</h3>
  <table class="det">
    <thead><tr>
      <th style="width:70px">Código</th><th>Descripción</th>
      <th style="width:40px" class="c">Cant.</th>
      <th style="width:80px" class="r">Unitario</th>
      <th style="width:85px" class="r">Total</th>
    </tr></thead>
    <tbody>
      ${GRUPOS.map(([t]) => filasGrupo(t)).join('')}
      ${!detalle.length ? '<tr><td colspan="5" class="c">Sin detalle registrado</td></tr>' : ''}
    </tbody>
  </table>

  <table class="tot">
    <tr><td>Subtotal</td><td class="r">${clp(bruto)}</td></tr>
    ${Number(descuento) > 0 ? `<tr><td>Descuento</td><td class="r">− ${clp(descuento)}</td></tr>` : ''}
    <tr class="final"><td>TOTAL</td><td class="r">${clp(neto)}</td></tr>
  </table>

  ${observacionesEntrega ? `<h3>Observaciones de entrega</h3><div class="txt">${esc(observacionesEntrega)}</div>` : ''}

  <div class="nota">
    Documento: ${esc(tipoDocumento || '—')} ${esc(nroDocumento || '')}.
    Los trabajos realizados cuentan con garantía según las condiciones informadas al momento
    de la recepción. Ante cualquier observación posterior, comuníquese con su asesor.
  </div>

  <div class="firmas">
    <div><div style="height:40px"></div><div class="l">RETIRA${retiraNombre ? ' · ' + esc(retiraNombre) : ''}</div></div>
    <div><div style="height:40px"></div><div class="l">ENTREGA${asesor ? ' · ' + esc(asesor) : ''}</div></div>
  </div>

  <div class="noprint" style="text-align:center;margin-top:20px;font-family:sans-serif">
    <button onclick="window.print()" style="padding:10px 20px;font-size:14px;cursor:pointer">Imprimir / Guardar PDF</button>
  </div>
  <script>window.onload = function () { setTimeout(function () { window.print() }, 250) }<\/script>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) { alert('El navegador bloqueó la ventana emergente. Habilítala para imprimir.'); return }
  w.document.write(html); w.document.close()
}
