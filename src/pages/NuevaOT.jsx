import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  formatPatente, patenteLimpia, fmtMiles, otTotal, fmtFonoOT,
  OT_TIPO_INGRESO, OT_ES_GARANTIA, OT_TIPO_CLIENTE, OT_ESTADO_VEHICULO,
  OT_TIPO_DOCUMENTO, OT_SVC_GRUPOS, otBU, OT_MARCAS, OT_CIUDADES
} from '../lib/helpers'

const hoy = () => new Date().toISOString().slice(0, 10)

// Envía la OT a la planilla (Apps Script) con form POST + iframe oculto.
// Es el mismo método de la app de registro: evita por completo el CORS
// que Apps Script genera al llamarlo con fetch desde otro dominio.
function enviarASheet(url, data) {
  return new Promise((resolve) => {
    const frameName = 'ot_sheet_' + Date.now()
    const iframe = document.createElement('iframe')
    iframe.name = frameName; iframe.style.display = 'none'
    document.body.appendChild(iframe)
    const form = document.createElement('form')
    form.method = 'POST'; form.action = url; form.target = frameName
    const input = document.createElement('input')
    input.type = 'hidden'; input.name = 'payload'; input.value = JSON.stringify(data)
    form.appendChild(input); document.body.appendChild(form)
    let hecho = false
    const limpiar = () => { if (hecho) return; hecho = true; try { form.remove(); iframe.remove() } catch {} ; resolve(true) }
    iframe.onload = () => setTimeout(limpiar, 300)
    setTimeout(limpiar, 2500) // respaldo
    form.submit()
  })
}
const VACIA = {
  ot_numero: '', fecha: hoy(), tipo_ingreso: 'Normal', sucursal: 'Toyota',
  tecnico_principal: '', tecnicos_secundarios: '',
  patente: '', marca: '', marcaOtra: '', modelo: '', cilindrada: '', anio: '', km: '',
  tipo_cliente: 'Particular', propietario: '', telefono: '', email: '',
  ciudad: '', ciudadOtra: '', direccion: '', direccion_ref: '',
  repuestos: '', lubricantes: '', mo: '', servicioExterno: '', descSE: '', descuento: '',
  tipo_servicio_1: '', tipo_servicio_2: '',
  estado_vehiculo: 'Entregado', fecha_entrega: hoy(), tipo_documento: 'Boleta', nro_documento: '',
  presup_solicito: 'No', presup_numero: '', presup_aprueba: '', presup_detalle: '',
  encuesta_aplica: 'No', enc_p1: '', enc_p2: '', enc_p3: '', enc_p4: '', enc_conocio: ''
}

function Seccion({ n, titulo, children }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="grid place-items-center w-6 h-6 rounded-full bg-deep text-white text-xs font-bold">{n}</span>
        <h2 className="font-semibold text-ink">{titulo}</h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </div>
  )
}
const Campo = ({ label, req, hint, full, children }) => (
  <div className={full ? 'sm:col-span-2' : ''}>
    <label className="label">{label} {req && <span className="text-red-500">*</span>}
      {hint && <span className="text-green-600 text-xs font-semibold ml-1">{hint}</span>}
    </label>
    {children}
  </div>
)

export default function NuevaOT() {
  const { perfil } = useAuth()
  const [params] = useSearchParams()
  const [f, setF] = useState(VACIA)
  const [veh, setVeh] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [sheetUrl, setSheetUrl] = useState('')
  const [enviarSheet, setEnviarSheet] = useState(true)

  // URL del Apps Script de la planilla (config por empresa)
  useEffect(() => {
    if (!perfil?.empresa_id) return
    supabase.from('empresa_config').select('valor')
      .eq('empresa_id', perfil.empresa_id).eq('clave', 'ot_sheet_url').maybeSingle()
      .then(({ data }) => {
        const v = data?.valor
        setSheetUrl(typeof v === 'string' ? v : (v?.url || ''))
      })
  }, [perfil?.empresa_id])

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const esGarantia = OT_ES_GARANTIA(f.tipo_ingreso)
  const total = useMemo(() => otTotal(f), [f.repuestos, f.lubricantes, f.mo, f.servicioExterno, f.descuento])
  const unidades = useMemo(() => {
    const bus = [otBU(f.tipo_servicio_1), otBU(f.tipo_servicio_2)].filter(Boolean)
    return [...new Set(bus)]
  }, [f.tipo_servicio_1, f.tipo_servicio_2])

  // Precarga por parámetros URL (mismas claves que la app de OT)
  useEffect(() => {
    if (![...params.keys()].length) return
    const g = (k) => params.get(k) || ''
    const matchLista = (val, lista) => lista.find((x) => x.toLowerCase() === val.trim().toLowerCase())
    setF((x) => {
      const n = { ...x }
      if (g('ot')) n.ot_numero = g('ot')
      if (g('patente')) n.patente = formatPatente(g('patente'))
      if (g('marca')) { const m = matchLista(g('marca'), OT_MARCAS); if (m) n.marca = m; else { n.marca = '__otra__'; n.marcaOtra = g('marca') } }
      if (g('modelo')) n.modelo = g('modelo')
      if (g('cilindrada')) n.cilindrada = g('cilindrada')
      if (g('anio')) n.anio = g('anio')
      if (g('km')) n.km = g('km')
      if (g('nombre')) n.propietario = g('nombre')
      if (g('telefono')) n.telefono = fmtFonoOT(g('telefono'))
      if (g('email')) n.email = g('email')
      if (g('ciudad')) { const c = matchLista(g('ciudad'), OT_CIUDADES); if (c) n.ciudad = c; else { n.ciudad = '__otra__'; n.ciudadOtra = g('ciudad') } }
      if (g('direccion')) n.direccion = g('direccion')
      if (g('referencia')) n.direccion_ref = g('referencia')
      if (g('documento')) n.nro_documento = g('documento')
      if (g('repuestos')) n.repuestos = g('repuestos')
      if (g('lubricantes')) n.lubricantes = g('lubricantes')
      if (g('mo')) n.mo = g('mo')
      return n
    })
    if (g('patente')) buscarVehiculo(g('patente'))
  }, []) // eslint-disable-line

  async function buscarVehiculo(patente) {
    const limpia = patenteLimpia(patente)
    if (limpia.length < 5) { setVeh(null); return }
    const { data } = await supabase.from('vehiculos')
      .select('id,marca,modelo,cliente_id,clientes(nombre)')
      .ilike('patente', `%${formatPatente(patente)}%`).limit(1)
    setVeh(data?.[0] || null)
  }

  const marcaFinal = () => (f.marca === '__otra__' ? f.marcaOtra.trim() : f.marca)
  const ciudadFinal = () => (f.ciudad === '__otra__' ? f.ciudadOtra.trim() : f.ciudad)

  async function guardar(e) {
    e.preventDefault()
    if (!f.patente.trim() || !f.tipo_servicio_1) { setMsg({ t: 'err', m: 'Ingresa al menos patente y tipo de servicio.' }); return }
    if (!esGarantia && (+f.mo || 0) <= 0) { setMsg({ t: 'err', m: 'La mano de obra es obligatoria (salvo garantía).' }); return }
    setGuardando(true); setMsg(null)

    const patFmt = formatPatente(f.patente)
    const kmNum = parseInt(f.km, 10) || null
    const fila = {
      empresa_id: perfil.empresa_id,
      vehiculo_id: veh?.id || null, cliente_id: veh?.cliente_id || null,
      ot_numero: f.ot_numero.trim() || null, fecha: f.fecha || null,
      patente: patFmt, marca: marcaFinal(), modelo: f.modelo.trim(),
      cilindrada: f.cilindrada.trim(), anio: f.anio.trim(), km: kmNum,
      tipo_cliente: f.tipo_cliente, propietario: f.propietario.trim(),
      telefono: f.telefono.trim(), email: f.email.trim(), ciudad: ciudadFinal(),
      asesor: perfil?.nombre || '', tipo_ingreso: f.tipo_ingreso,
      tecnico_principal: f.tecnico_principal.trim(), tecnicos_secundarios: f.tecnicos_secundarios.trim(),
      monto_repuestos: +f.repuestos || 0, monto_lubricantes: +f.lubricantes || 0,
      monto_mano_obra: +f.mo || 0, monto_servicio_externo: +f.servicioExterno || 0,
      desc_servicio_externo: f.descSE.trim(), descuento: +f.descuento || 0, total_reparacion: total,
      tipo_servicio_1: f.tipo_servicio_1, tipo_servicio_2: f.tipo_servicio_2 || null,
      unidades_negocio: unidades.join('; '),
      estado_vehiculo: f.estado_vehiculo, fecha_entrega: f.fecha_entrega || null,
      tipo_documento: f.tipo_documento, nro_documento: f.nro_documento.trim(),
      sucursal: f.sucursal, email_asesor: perfil?.email || '',
      encuesta_aplica: f.encuesta_aplica,
      enc_p1: f.enc_p1, enc_p2: f.enc_p2, enc_p3: f.enc_p3, enc_p4: f.enc_p4, enc_conocio: f.enc_conocio.trim(),
      presup_solicito: f.presup_solicito, presup_numero: f.presup_numero.trim(),
      presup_aprueba: f.presup_aprueba, presup_detalle: f.presup_detalle.trim(),
      direccion: f.direccion.trim(), direccion_ref: f.direccion_ref.trim()
    }

    const { error: e1 } = await supabase.from('ordenes_trabajo').insert(fila)
    if (e1) { setMsg({ t: 'err', m: 'Error al guardar la OT: ' + e1.message }); setGuardando(false); return }

    // Historial comercial: subconjunto en "servicios" (triggers enlazan por patente)
    await supabase.from('servicios').upsert({
      empresa_id: perfil.empresa_id, ot_numero: fila.ot_numero, fecha: fila.fecha,
      patente: patenteLimpia(f.patente), tipo_servicio: f.tipo_servicio_1,
      tipo_servicio_2: f.tipo_servicio_2 || null, monto: total, km: kmNum,
      vehiculo_id: veh?.id || null, cliente_id: veh?.cliente_id || null
    }, { onConflict: 'empresa_id,ot_numero' })
    if (veh?.id && kmNum) await supabase.from('vehiculos').update({ km_ultimo: kmNum }).eq('id', veh.id)

    // Envío a la planilla DIDIAL_Base_OT (mismo backend que la app de registro)
    let aviso = `OT guardada — Total $${fmtMiles(total)}`
    if (enviarSheet && sheetUrl) {
      const payload = {
        nroOT: fila.ot_numero || '', fechaIngreso: f.fecha,
        asesor: perfil?.nombre || '', asesorEmail: perfil?.email || '', sucursal: f.sucursal,
        tipoIngreso: f.tipo_ingreso, tecnicoPrincipal: f.tecnico_principal,
        tecnicosSecundarios: f.tecnicos_secundarios,
        patente: patFmt, marca: marcaFinal(), modelo: f.modelo, cilindrada: f.cilindrada,
        anio: f.anio, km: f.km, tipoCliente: f.tipo_cliente, propietario: f.propietario,
        telefono: f.telefono, email: f.email, ciudad: ciudadFinal(),
        direccion: f.direccion, direccionRef: f.direccion_ref,
        montoRepuestos: +f.repuestos || 0, montoLubricantes: +f.lubricantes || 0,
        montoMO: +f.mo || 0, montoServicioExterno: +f.servicioExterno || 0,
        descServicioExterno: f.descSE, descuento: +f.descuento || 0, totalReparacion: total,
        tipoServicio1: f.tipo_servicio_1, tipoServicio2: f.tipo_servicio_2 || '',
        unidadesNegocio: unidades.join('; '), estadoVehiculo: f.estado_vehiculo,
        fechaEntrega: f.fecha_entrega, tipoDocumento: f.tipo_documento, nroDocumento: f.nro_documento,
        presupSolicito: f.presup_solicito, presupNumero: f.presup_numero,
        presupAprueba: f.presup_aprueba, presupDetalle: f.presup_detalle,
        encuestaAplica: f.encuesta_aplica, encP1Tiempo: f.enc_p1, encP2Atencion: f.enc_p2,
        encP3Servicio: f.enc_p3, encP4Recomienda: f.enc_p4, encConocio: f.enc_conocio,
        otInicio: new Date().toISOString()
      }
      await enviarASheet(sheetUrl, payload)
      aviso += ' · enviada a la planilla'
    }

    setGuardando(false)
    setMsg({ t: 'ok', m: aviso })
    setF({ ...VACIA, fecha: hoy(), fecha_entrega: hoy() }); setVeh(null)
  }

  return (
    <form onSubmit={guardar} className="space-y-5 max-w-4xl pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Nueva Orden de Trabajo</h1>
          <p className="text-sm text-slate-500">Asesor: <b>{perfil?.nombre}</b></p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Total reparación</div>
          <div className="text-2xl font-bold text-deep">$ {fmtMiles(total)}</div>
        </div>
      </div>

      <Seccion n={1} titulo="Ingreso de Orden">
        <Campo label="N° Orden de Trabajo">
          <input className="input" value={f.ot_numero} onChange={(e) => set('ot_numero', e.target.value)} placeholder="Ej: 13050" />
        </Campo>
        <Campo label="Fecha de Ingreso" req>
          <input type="date" className="input" value={f.fecha} onChange={(e) => set('fecha', e.target.value)} />
        </Campo>
        <Campo label="Tipo de Ingreso" req>
          <select className="input" value={f.tipo_ingreso} onChange={(e) => set('tipo_ingreso', e.target.value)}>
            {OT_TIPO_INGRESO.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Campo>
        <Campo label="Sucursal">
          <select className="input" value={f.sucursal} onChange={(e) => set('sucursal', e.target.value)}>
            <option>Toyota</option><option>Multimarca</option>
          </select>
        </Campo>
        <Campo label="Técnico Principal">
          <input className="input" value={f.tecnico_principal} onChange={(e) => set('tecnico_principal', e.target.value)} />
        </Campo>
        <Campo label="Técnicos Secundarios">
          <input className="input" value={f.tecnicos_secundarios} onChange={(e) => set('tecnicos_secundarios', e.target.value)} placeholder="Separados por ;" />
        </Campo>
      </Seccion>

      <Seccion n={2} titulo="Datos del Vehículo">
        <Campo label="Patente" req>
          <input className="input" value={f.patente} maxLength={9}
                 onChange={(e) => { set('patente', formatPatente(e.target.value)); buscarVehiculo(e.target.value) }}
                 placeholder="XX XX XX" />
          {veh && <p className="text-xs text-green-600 mt-1">Vehículo encontrado: {veh.clientes?.nombre || 'cliente'}</p>}
        </Campo>
        <Campo label="Año"><input className="input" value={f.anio} onChange={(e) => set('anio', e.target.value)} placeholder="Ej: 2019" /></Campo>
        <Campo label="Marca" req>
          <select className="input" value={f.marca} onChange={(e) => set('marca', e.target.value)}>
            <option value="">Seleccionar marca…</option>
            {OT_MARCAS.map((m) => <option key={m}>{m}</option>)}
            <option value="__otra__">Otra (especificar)</option>
          </select>
          {f.marca === '__otra__' && (
            <input className="input mt-2" value={f.marcaOtra} onChange={(e) => set('marcaOtra', e.target.value)} placeholder="Nombre de la marca…" autoFocus />
          )}
        </Campo>
        <Campo label="Modelo"><input className="input" value={f.modelo} onChange={(e) => set('modelo', e.target.value)} placeholder="Ej: Hilux, Yaris…" /></Campo>
        <Campo label="Cilindrada"><input className="input" value={f.cilindrada} onChange={(e) => set('cilindrada', e.target.value)} placeholder="Ej: 2.0, 2.4…" /></Campo>
        <Campo label="Kilometraje"><input className="input" type="number" value={f.km} onChange={(e) => set('km', e.target.value)} placeholder="Ej: 87500" /></Campo>
      </Seccion>

      <Seccion n={3} titulo="Datos del Cliente">
        <Campo label="Tipo de Cliente" req>
          <select className="input" value={f.tipo_cliente} onChange={(e) => set('tipo_cliente', e.target.value)}>
            {OT_TIPO_CLIENTE.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Campo>
        <Campo label="Propietario / Razón Social" req>
          <input className="input" value={f.propietario} onChange={(e) => set('propietario', e.target.value)} placeholder="Nombre o razón social" />
        </Campo>
        <Campo label="Teléfono">
          <input className="input" value={f.telefono} onChange={(e) => set('telefono', e.target.value)}
                 onBlur={(e) => set('telefono', fmtFonoOT(e.target.value))} placeholder="+56 9 XXXX XXXX" />
        </Campo>
        <Campo label="Correo Electrónico"><input className="input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="cliente@ejemplo.com" /></Campo>
        <Campo label="Ciudad">
          <select className="input" value={f.ciudad} onChange={(e) => set('ciudad', e.target.value)}>
            <option value="">Seleccionar…</option>
            {OT_CIUDADES.map((c) => <option key={c}>{c}</option>)}
            <option value="__otra__">Otra (especificar)</option>
          </select>
          {f.ciudad === '__otra__' && (
            <input className="input mt-2" value={f.ciudadOtra} onChange={(e) => set('ciudadOtra', e.target.value)} placeholder="Nombre de la ciudad…" autoFocus />
          )}
        </Campo>
        <Campo label="Dirección (calle y número)"><input className="input" value={f.direccion} onChange={(e) => set('direccion', e.target.value)} placeholder="Ej: Av. Balmaceda 1234" /></Campo>
        <Campo label="Depto / Casa / Referencia" full><input className="input" value={f.direccion_ref} onChange={(e) => set('direccion_ref', e.target.value)} placeholder="Ej: Depto 502, Torre B" /></Campo>
      </Seccion>

      <Seccion n={4} titulo="Información de la Reparación">
        <Campo label="Repuestos"><input className="input" type="number" min="0" value={f.repuestos} onChange={(e) => set('repuestos', e.target.value)} placeholder="0" /></Campo>
        <Campo label="Lubricantes e Insumos"><input className="input" type="number" min="0" value={f.lubricantes} onChange={(e) => set('lubricantes', e.target.value)} placeholder="0" /></Campo>
        <Campo label="Mano de Obra" req={!esGarantia} hint={esGarantia ? '✓ Garantía: puede ser $0' : ''}>
          <input className="input" type="number" min="0" value={f.mo} onChange={(e) => set('mo', e.target.value)} placeholder="0" />
        </Campo>
        <Campo label="Servicio Externo"><input className="input" type="number" min="0" value={f.servicioExterno} onChange={(e) => set('servicioExterno', e.target.value)} placeholder="0" /></Campo>
        {(+f.servicioExterno || 0) > 0 && (
          <Campo label="Detalle del Servicio Externo" req full>
            <input className="input" value={f.descSE} onChange={(e) => set('descSE', e.target.value)} placeholder="Proveedor y concepto…" />
          </Campo>
        )}
        <Campo label="Descuento"><input className="input" type="number" min="0" value={f.descuento} onChange={(e) => set('descuento', e.target.value)} placeholder="0" /></Campo>
        <Campo label="Total Reparación">
          <div className="input bg-mist font-bold text-deep">$ {fmtMiles(total)}</div>
        </Campo>
      </Seccion>

      <Seccion n={5} titulo="Clasificación del Servicio">
        <Campo label="Tipo de Servicio 1" req>
          <select className="input" value={f.tipo_servicio_1} onChange={(e) => set('tipo_servicio_1', e.target.value)}>
            <option value="">Seleccionar…</option>
            {OT_SVC_GRUPOS.map((g) => (
              <optgroup key={g.bu} label={g.bu}>{g.items.map((s) => <option key={s}>{s}</option>)}</optgroup>
            ))}
          </select>
        </Campo>
        <Campo label="Tipo de Servicio 2 (opcional)">
          <select className="input" value={f.tipo_servicio_2} onChange={(e) => set('tipo_servicio_2', e.target.value)}>
            <option value="">Ninguno</option>
            {OT_SVC_GRUPOS.map((g) => (
              <optgroup key={g.bu} label={g.bu}>{g.items.map((s) => <option key={s}>{s}</option>)}</optgroup>
            ))}
          </select>
        </Campo>
        <Campo label="Unidades de Negocio" full>
          <div className="flex flex-wrap gap-2 mt-1">
            {unidades.length ? unidades.map((u) => <span key={u} className="pill bg-deep text-white">{u}</span>)
              : <span className="text-sm text-slate-400">Se deriva del tipo de servicio</span>}
          </div>
        </Campo>
      </Seccion>

      <Seccion n={6} titulo="Estado y Entrega">
        <Campo label="Estado del Vehículo" req>
          <select className="input" value={f.estado_vehiculo} onChange={(e) => set('estado_vehiculo', e.target.value)}>
            {OT_ESTADO_VEHICULO.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Campo>
        <Campo label="Fecha de Entrega"><input type="date" className="input" value={f.fecha_entrega} onChange={(e) => set('fecha_entrega', e.target.value)} /></Campo>
        <Campo label="Tipo de Documento">
          <select className="input" value={f.tipo_documento} onChange={(e) => set('tipo_documento', e.target.value)}>
            {OT_TIPO_DOCUMENTO.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Campo>
        <Campo label="N° Documento"><input className="input" value={f.nro_documento} onChange={(e) => set('nro_documento', e.target.value)} /></Campo>
      </Seccion>

      <Seccion n={7} titulo="Presupuesto y Encuesta (opcional)">
        <Campo label="¿Solicitó Presupuesto?">
          <select className="input" value={f.presup_solicito} onChange={(e) => set('presup_solicito', e.target.value)}>
            <option>No</option><option>Sí</option>
          </select>
        </Campo>
        {f.presup_solicito === 'Sí' && <>
          <Campo label="N° Presupuesto"><input className="input" value={f.presup_numero} onChange={(e) => set('presup_numero', e.target.value)} /></Campo>
          <Campo label="¿Aprobó Presupuesto?">
            <select className="input" value={f.presup_aprueba} onChange={(e) => set('presup_aprueba', e.target.value)}>
              <option value="">—</option><option>Sí</option><option>No</option>
            </select>
          </Campo>
          <Campo label="Detalle de Presupuestos" full><input className="input" value={f.presup_detalle} onChange={(e) => set('presup_detalle', e.target.value)} /></Campo>
        </>}
        <Campo label="¿Aplica Encuesta?">
          <select className="input" value={f.encuesta_aplica} onChange={(e) => set('encuesta_aplica', e.target.value)}>
            <option>No</option><option>Sí</option>
          </select>
        </Campo>
        {f.encuesta_aplica === 'Sí' && <>
          {[['enc_p1', 'P1 · Entrega a tiempo'], ['enc_p2', 'P2 · Atención al cliente'], ['enc_p3', 'P3 · Servicio mecánico'], ['enc_p4', 'P4 · Recomendaría']].map(([k, lbl]) => (
            <Campo key={k} label={lbl}>
              <select className="input" value={f[k]} onChange={(e) => set(k, e.target.value)}>
                <option value="">—</option>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n}>{n}</option>)}
              </select>
            </Campo>
          ))}
          <Campo label="¿Cómo conoció DIDIAL?" full><input className="input" value={f.enc_conocio} onChange={(e) => set('enc_conocio', e.target.value)} /></Campo>
        </>}
      </Seccion>

      {msg && (
        <div className={`rounded-lg px-4 py-2.5 text-sm ${msg.t === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{msg.m}</div>
      )}
      <div className="flex justify-between items-center gap-3 sticky bottom-0 bg-paper/80 backdrop-blur py-3">
        <label className={`flex items-center gap-2 text-sm ${sheetUrl ? 'text-slate-600' : 'text-slate-300'}`}>
          <input type="checkbox" checked={enviarSheet && !!sheetUrl} disabled={!sheetUrl}
                 onChange={(e) => setEnviarSheet(e.target.checked)} />
          Enviar también a la planilla DIDIAL_Base_OT
        </label>
        <button type="submit" disabled={guardando} className="btn-primary px-6">
          {guardando ? 'Guardando…' : 'Guardar OT'}
        </button>
      </div>
    </form>
  )
}
