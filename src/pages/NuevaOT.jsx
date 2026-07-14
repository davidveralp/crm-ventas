import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  formatPatente, patenteLimpia, fmtMiles, otTotal, fmtFonoOT, formatRut,
  OT_TIPO_INGRESO, OT_ES_GARANTIA, OT_TIPO_CLIENTE, OT_ESTADO_VEHICULO,
  OT_TIPO_DOCUMENTO, OT_SVC_GRUPOS, otBU, OT_MARCAS, OT_CIUDADES,
  OT_TECNICOS, OT_CONOCIO, OT_ENCUESTA, enviarASheet, TIPOS_VEHICULO, sucursalDeAsesor
} from '../lib/helpers'

const hoy = () => new Date().toISOString().slice(0, 10)

const VACIA = {
  ot_numero: '', fecha: hoy(), tipo_ingreso: 'Normal', sucursal: 'Toyota', tipo_vehiculo: '',
  tecnico_principal: '', tecPrincipalOtro: '',
  patente: '', marca: '', marcaOtra: '', modelo: '', cilindrada: '', anio: '', km: '',
  tipo_cliente: 'Particular', propietario: '', apellidos: '', contacto_nombre: '', rut: '', telefono: '', email: '', sin_correo: false,
  ciudad: '', ciudadOtra: '', direccion: '', direccion_ref: '',
  repuestos: '', lubricantes: '', mo: '', servicioExterno: '', descSE: '', descuento: '',
  tipo_servicio_1: '', tipo_servicio_2: '',
  estado_vehiculo: 'Entregado', fecha_entrega: hoy(), tipo_documento: 'Boleta', nro_documento: '',
  presup_solicito: 'No', presup_numero: '', presup_aprueba: '', presup_detalle: '',
  encuesta_aplica: 'No', enc_p1: '', enc_p2: '', enc_p3: '', enc_p4: '', enc_conocio: '', conocioOtro: '',
  solicitar_anular: false, motivo_anulacion: ''
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

// Input de dinero con prefijo "$"
const Monto = ({ value, onChange }) => (
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
    <input className="input pl-7" type="number" min="0" value={value} onChange={onChange} placeholder="0" />
  </div>
)

// Chip seleccionable (para técnicos secundarios y "cómo conoció")
const Chip = ({ activo, onClick, children }) => (
  <button type="button" onClick={onClick}
    className={`px-3 py-1.5 rounded-lg border text-sm transition ${activo
      ? 'bg-deep text-white border-deep' : 'bg-white text-slate-600 border-slate-200 hover:border-deep'}`}>
    {children}
  </button>
)

export default function NuevaOT() {
  const { perfil } = useAuth()
  const [params] = useSearchParams()
  const [f, setF] = useState(VACIA)
  const [veh, setVeh] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [sheetUrl, setSheetUrl] = useState('')
  const [tecnicos, setTecnicos] = useState([])       // v27: usuarios activos rol técnico
  const [secSel, setSecSel] = useState([])   // técnicos secundarios elegidos
  const [secOtro, setSecOtro] = useState('') // técnico secundario "Otro"
  const [presups, setPresups] = useState([])   // presupuestos de taller del vehículo
  const [selItems, setSelItems] = useState({}) // "presupId:i" -> true

  // URL del Apps Script de la planilla (config por empresa)
  // v27: técnicos = usuarios activos con rol técnico o jefe de taller
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('usuarios')
        .select('id,nombre').in('rol', ['tecnico', 'jefe_taller']).eq('activo', true).order('nombre')
      setTecnicos((data || []).map((t) => t.nombre))
    })()
  }, [])

  // v27: sucursal fija según el asesor que ingresa (Diego Leyton = Toyota;
  // David Rivera y Matías Ponce = Multimarca; roles asesor_toyota /
  // asesor_multimarca definen la suya). Admin y otros roles pueden elegir.
  const sucursalFija = sucursalDeAsesor(perfil)
  useEffect(() => { if (sucursalFija) set('sucursal', sucursalFija) }, [sucursalFija])

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
  const LISTA_TECNICOS = tecnicos.length ? tecnicos : OT_TECNICOS
  // v28: el dropdown usa el catálogo FUSIONADO (lista anterior + categorías
  // nuevas de la planilla); los servicios específicos se desglosan en
  // taller/presupuestos filtrados por categoría y tipo de vehículo.
  const GRUPOS_SVC = OT_SVC_GRUPOS
  const esEmpresa = f.tipo_cliente === 'Empresa'
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
      .select('id,marca,modelo,tipo_vehiculo,cliente_id,clientes(nombre,apellidos)')
      .ilike('patente', `%${formatPatente(patente)}%`).limit(1)
    const v = data?.[0] || null
    setVeh(v)
    if (v?.tipo_vehiculo) set('tipo_vehiculo', v.tipo_vehiculo)   // v27: precarga el tipo
    // Presupuestos del taller pendientes de decisión para este vehículo
    if (v?.id) {
      const { data: tt } = await supabase.from('trabajos_taller').select('id').eq('vehiculo_id', v.id)
      const ids = (tt || []).map((x) => x.id)
      if (ids.length) {
        const { data: pp } = await supabase.from('presupuestos_taller')
          .select('*').in('trabajo_id', ids).in('estado', ['enviado', 'cotizando', 'aprobado', 'parcial'])
          .order('creado_en', { ascending: false })
        setPresups(pp || []); setSelItems({}); return
      }
    }
    setPresups([]); setSelItems({})
  }

  const marcaFinal = () => (f.marca === '__otra__' ? f.marcaOtra.trim() : f.marca)
  const ciudadFinal = () => (f.ciudad === '__otra__' ? f.ciudadOtra.trim() : f.ciudad)
  const tecPrincipalFinal = () => (f.tecnico_principal === 'Otro' ? f.tecPrincipalOtro.trim() : f.tecnico_principal)
  const conocioFinal = () => (f.enc_conocio === 'Otro' ? f.conocioOtro.trim() : f.enc_conocio)
  const tecSecFinal = () => {
    const lista = [...secSel]
    if (secSel.includes('Otro') && secOtro.trim()) {
      const i = lista.indexOf('Otro'); lista[i] = secOtro.trim()
    }
    return lista.join('; ')
  }
  const toggleSec = (t) => setSecSel((s) => s.includes(t) ? s.filter((x) => x !== t) : [...s, t])

  // Presupuesto de taller: completo o parcial punto a punto → llena los montos
  function aplicarPresupuesto(sel) {
    let rep = 0, lub = 0
    presups.forEach((p) => (p.items || []).forEach((x, i) => {
      if (!sel[p.id + ':' + i] || x.en_stock) return
      const m = (+x.precio || 0) * (+x.cant || 1)
      if (x.tipo === 'repuesto') rep += m; else lub += m
    }))
    setF((prev) => ({ ...prev, repuestos: rep ? String(rep) : prev.repuestos, lubricantes: lub ? String(lub) : prev.lubricantes }))
  }
  const toggleItem = (p, i) => { const k = p.id + ':' + i; const sel = { ...selItems, [k]: !selItems[k] }; setSelItems(sel); aplicarPresupuesto(sel) }
  const toggleTodo = (p, marcar) => {
    const sel = { ...selItems }
    ;(p.items || []).forEach((_, i) => { sel[p.id + ':' + i] = marcar })
    setSelItems(sel); aplicarPresupuesto(sel)
  }

  async function guardar(e) {
    e.preventDefault()
    if (!f.patente.trim() || !f.tipo_servicio_1) { setMsg({ t: 'err', m: 'Ingresa al menos patente y tipo de servicio.' }); return }
    // v23: datos de contacto obligatorios (mismos criterios que "Nuevo cliente")
    if (!f.propietario.trim()) { setMsg({ t: 'err', m: esEmpresa ? 'La razón social es obligatoria.' : 'El nombre del propietario es obligatorio.' }); return }
    if (!esEmpresa && !f.apellidos.trim()) { setMsg({ t: 'err', m: 'El apellido del propietario es obligatorio.' }); return }
    if (!f.rut.trim()) { setMsg({ t: 'err', m: 'El RUT es obligatorio.' }); return }
    if (!f.sin_correo && (!f.email.trim() || !f.email.includes('@'))) { setMsg({ t: 'err', m: 'El correo electrónico es obligatorio (o marca "El cliente no aporta correo").' }); return }
    if (!f.direccion.trim()) { setMsg({ t: 'err', m: 'La dirección es obligatoria.' }); return }
    if (esEmpresa && !f.contacto_nombre.trim()) { setMsg({ t: 'err', m: 'Indica el nombre del contacto de la empresa.' }); return }
    // v23/v25: MO $0 solo si es garantía o si se solicita anular la OT
    if (!esGarantia && (+f.mo || 0) <= 0 && !f.solicitar_anular) {
      setMsg({ t: 'err', m: 'La mano de obra es obligatoria (salvo garantía). Si esta OT quedará nula, marca "Solicitar anular OT" al final del formulario: se guardará con montos en cero y se notificará a administración.' })
      return
    }
    if (f.solicitar_anular && !f.motivo_anulacion.trim()) {
      setMsg({ t: 'err', m: 'Escribe el motivo de la anulación para poder solicitar anular la OT.' })
      return
    }
    // v37: validación de duplicados — solo bloquea si la OT YA tiene datos
    // reales (patente, monto o cliente). Una fila "vacía" (el típico caso
    // de una OT marcada como faltante en Control de OT: el número quedó
    // registrado sin datos) NO bloquea — se completa con el upsert de más
    // abajo en vez de tratarse como duplicado.
    if (f.ot_numero?.trim()) {
      const { data: dup } = await supabase.from('servicios')
        .select('id,fecha,patente,monto,cliente_id')
        .eq('empresa_id', perfil.empresa_id).eq('ot_numero', f.ot_numero.trim()).limit(1)
      const existente = dup?.[0]
      const tieneD = existente && (existente.patente || existente.monto > 0 || existente.cliente_id)
      if (tieneD) {
        setMsg({ t: 'err', m: `⚠ La OT ${f.ot_numero.trim()} YA está cargada con datos (${existente.patente || 's/patente'} · ${existente.fecha || 's/fecha'} · $${existente.monto || 0}). Verifica el número antes de guardar; si corresponde corregirla, hazlo en la ficha del cliente.` })
        return
      }
      // si existe pero está vacía (placeholder de una OT antes "faltante"),
      // se deja continuar: el upsert de abajo la completa con los datos reales.
    }
    setGuardando(true); setMsg(null)

    const patFmt = formatPatente(f.patente)
    const kmNum = parseInt(f.km, 10) || null

    // v36: si la patente no existe en el CRM, el cliente y el vehículo se
    // crean AQUÍ MISMO, de inmediato, asignados al asesor que ingresa la
    // OT — no se espera a la sincronización con la planilla (que además
    // nunca asignaba dueño). Así, todo ingreso nuevo queda con su asesor
    // y dispara el seguimiento de fidelización de más abajo.
    let vehActivo = veh
    if (!vehActivo) {
      const { data: nuevoCli, error: eCli } = await supabase.from('clientes').insert({
        empresa_id: perfil.empresa_id,
        nombre: f.propietario.trim(), apellidos: esEmpresa ? '' : f.apellidos.trim(),
        rut: f.rut.trim(), telefono: f.telefono.trim() || null,
        email: f.sin_correo ? null : f.email.trim(),
        direccion: f.direccion.trim() || null, ciudad: f.comuna?.trim() || null,
        tipo: esEmpresa ? 'EMPRESA' : 'PERSONA',
        contacto_nombre: esEmpresa ? f.contacto_nombre.trim() : null,
        segmento: 'nuevo', vendedor_id: perfil.id,
        notas: 'Ingresado desde Nueva OT.'
      }).select('id').single()
      if (eCli) { setGuardando(false); setMsg({ t: 'err', m: 'No se pudo crear el cliente: ' + eCli.message }); return }
      const { data: nuevoVeh, error: eVeh } = await supabase.from('vehiculos').insert({
        empresa_id: perfil.empresa_id, cliente_id: nuevoCli.id, patente: patFmt,
        marca: marcaFinal()?.trim() || null, modelo: f.modelo?.trim() || null,
        anio: parseInt(f.anio, 10) || null, tipo_vehiculo: f.tipo_vehiculo || null,
        km_ultimo: kmNum, km_actual_estimado: kmNum
      }).select('id,cliente_id').single()
      if (eVeh) { setGuardando(false); setMsg({ t: 'err', m: 'No se pudo crear el vehículo: ' + eVeh.message }); return }
      vehActivo = nuevoVeh
      setVeh(nuevoVeh)
    }

    const fila = {
      empresa_id: perfil.empresa_id,
      vehiculo_id: vehActivo?.id || null, cliente_id: vehActivo?.cliente_id || null,
      ot_numero: f.ot_numero.trim() || null, fecha: f.fecha || null,
      patente: patFmt, marca: marcaFinal(), modelo: f.modelo.trim(),
      cilindrada: f.cilindrada.trim(), anio: f.anio.trim(), km: kmNum,
      tipo_cliente: f.tipo_cliente, propietario: [f.propietario.trim(), esEmpresa ? '' : f.apellidos.trim()].filter(Boolean).join(' '),
      rut: f.rut.trim() ? formatRut(f.rut) : null, contacto_nombre: f.contacto_nombre.trim() || null,
      anulacion_solicitada: !!f.solicitar_anular, motivo_anulacion: f.solicitar_anular ? f.motivo_anulacion.trim() : null,
      telefono: f.telefono.trim(), email: f.email.trim(), ciudad: ciudadFinal(),
      asesor: perfil?.nombre || '', tipo_ingreso: f.tipo_ingreso,
      tecnico_principal: tecPrincipalFinal(), tecnicos_secundarios: tecSecFinal(),
      monto_repuestos: +f.repuestos || 0, monto_lubricantes: +f.lubricantes || 0,
      monto_mano_obra: +f.mo || 0, monto_servicio_externo: +f.servicioExterno || 0,
      desc_servicio_externo: f.descSE.trim(), descuento: +f.descuento || 0, total_reparacion: total,
      tipo_servicio_1: f.tipo_servicio_1, tipo_servicio_2: f.tipo_servicio_2 || null,
      unidades_negocio: unidades.join('; '),
      estado_vehiculo: f.estado_vehiculo, fecha_entrega: f.fecha_entrega || null,
      tipo_documento: f.tipo_documento, nro_documento: f.nro_documento.trim(),
      sucursal: f.sucursal, email_asesor: perfil?.email || '',
      encuesta_aplica: f.encuesta_aplica,
      enc_p1: f.enc_p1, enc_p2: f.enc_p2, enc_p3: f.enc_p3, enc_p4: f.enc_p4, enc_conocio: conocioFinal(),
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
      tipo_documento: f.tipo_documento || null, nro_documento: f.nro_documento.trim() || null,
      vehiculo_id: vehActivo?.id || null, cliente_id: vehActivo?.cliente_id || null
    }, { onConflict: 'empresa_id,ot_numero' })
    if (vehActivo?.id && kmNum) await supabase.from('vehiculos').update({ km_ultimo: kmNum }).eq('id', vehActivo.id)

    // Presupuestos de taller: marca aprobado (completo) o parcial según selección
    for (const p of presups) {
      const n = (p.items || []).length
      if (!n) continue
      const marcados = (p.items || []).filter((_, i) => selItems[p.id + ':' + i]).length
      if (!marcados) continue
      await supabase.from('presupuestos_taller').update({
        estado: marcados === n ? 'aprobado' : 'parcial',
        resuelto_en: new Date().toISOString()
      }).eq('id', p.id)
    }

    // v27: guarda el tipo de vehículo en la ficha (asociación con precios)
    if (vehActivo?.id && f.tipo_vehiculo && vehActivo.tipo_vehiculo !== f.tipo_vehiculo) {
      await supabase.from('vehiculos').update({ tipo_vehiculo: f.tipo_vehiculo }).eq('id', vehActivo.id)
    }

    // v23: solicitud de anulación → notifica a administración para registrarla como nula
    if (f.solicitar_anular) {
      await supabase.from('notificaciones').insert({
        empresa_id: perfil.empresa_id, rol: 'admin',
        titulo: `Solicitud de anulación · OT ${fila.ot_numero || 's/n'}`,
        cuerpo: `${f.propietario} · ${patFmt} · Motivo indicado por el asesor: ${f.motivo_anulacion.trim()}. Regístrala como "OT nula" en Control de OT.`,
        url: '/control-ot'
      })
    }

    // v36: Fidelización — seguimiento automático en el calendario del
    // asesor a cargo (día siguiente), para TODO ingreso nuevo o existente.
    if (vehActivo?.cliente_id) {
      const { data: cli } = await supabase.from('clientes')
        .select('vendedor_id').eq('id', vehActivo.cliente_id).maybeSingle()
      const manana = new Date(Date.now() + 864e5).toISOString().slice(0, 10)
      await supabase.from('actividades').insert({
        empresa_id: perfil.empresa_id, cliente_id: vehActivo.cliente_id,
        tipo: 'llamada', resultado: 'pendiente',
        fecha: hoy(), descripcion: `Seguimiento fidelización post-servicio · OT ${fila.ot_numero || ''}`.trim(),
        proxima_accion: 'Llamar al cliente por su experiencia de servicio',
        proxima_fecha: manana, agenda_tipo: 'llamada', recordatorio_min: 30,
        vendedor_id: cli?.vendedor_id || perfil.id
      })
    }

    // Envío a la planilla DIDIAL_Base_OT (mismo backend que la app de registro)
    let aviso = `OT guardada — Total $${fmtMiles(total)}`
    if (sheetUrl) {
      const payload = {
        nroOT: fila.ot_numero || '', fechaIngreso: f.fecha,
        asesor: perfil?.nombre || '', asesorEmail: perfil?.email || '', sucursal: f.sucursal,
        tipoIngreso: f.tipo_ingreso, tecnicoPrincipal: tecPrincipalFinal(),
        tecnicosSecundarios: tecSecFinal(),
        patente: patFmt, marca: marcaFinal(), modelo: f.modelo, cilindrada: f.cilindrada,
        anio: f.anio, km: f.km, tipoCliente: f.tipo_cliente, propietario: [f.propietario.trim(), esEmpresa ? '' : f.apellidos.trim()].filter(Boolean).join(' '),
        rut: f.rut, contactoNombre: f.contacto_nombre,
        telefono: f.telefono, email: f.email, ciudad: ciudadFinal(),
        direccion: f.direccion, direccionRef: f.direccion_ref,
        montoRepuestos: Math.round(+f.repuestos || 0), montoLubricantes: Math.round(+f.lubricantes || 0),
        montoMO: +f.mo || 0, montoServicioExterno: +f.servicioExterno || 0,
        descServicioExterno: f.descSE, descuento: +f.descuento || 0, totalReparacion: total,
        tipoServicio1: f.tipo_servicio_1, tipoServicio2: f.tipo_servicio_2 || '',
        unidadesNegocio: unidades.join('; '), estadoVehiculo: f.estado_vehiculo,
        fechaEntrega: f.fecha_entrega, tipoDocumento: f.tipo_documento, nroDocumento: f.nro_documento,
        presupSolicito: f.presup_solicito, presupNumero: f.presup_numero,
        presupAprueba: f.presup_aprueba, presupDetalle: f.presup_detalle,
        encuestaAplica: f.encuesta_aplica, encP1Tiempo: f.enc_p1, encP2Atencion: f.enc_p2,
        encP3Servicio: f.enc_p3, encP4Recomienda: f.enc_p4, encConocio: conocioFinal(),
        otInicio: new Date().toISOString()
      }
      await enviarASheet(sheetUrl, payload)
      aviso += ' ✓ enviada correctamente a la planilla DIDIAL_Base_OT'
    } else {
      aviso += ' · (planilla no configurada)'
    }

    // v42: si esta OT figuraba pendiente en Control de OT (faltante), se
    // marca automáticamente como "Registrada" — así deja de aparecer como
    // pendiente de revisión sin que el admin tenga que clasificarla a mano.
    if (f.ot_numero?.trim()) {
      await supabase.from('control_ot_revision').upsert({
        empresa_id: perfil.empresa_id, ot_numero: f.ot_numero.trim(), motivo: 'registrada',
        nota: `Registrada automáticamente por ${perfil?.nombre || 'un asesor'} vía Nueva OT.`,
        revisado_por: perfil.id, actualizado_en: new Date().toISOString()
      }, { onConflict: 'empresa_id,ot_numero' })
    }

    setGuardando(false)
    setMsg({ t: 'ok', m: aviso })
    setF({ ...VACIA, fecha: hoy(), fecha_entrega: hoy() }); setVeh(null)
    setSecSel([]); setSecOtro('')
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
        <Campo label="Sucursal" hint={sucursalFija ? 'Definida por tu perfil de asesor' : ''}>
          <select className="input" value={f.sucursal} disabled={!!sucursalFija}
                  onChange={(e) => set('sucursal', e.target.value)}>
            <option>Toyota</option><option>Multimarca</option>
          </select>
        </Campo>
        <Campo label="Técnico Principal">
          <select className="input" value={f.tecnico_principal} onChange={(e) => set('tecnico_principal', e.target.value)}>
            <option value="">Seleccionar…</option>
            {LISTA_TECNICOS.map((t) => <option key={t}>{t}</option>)}
            <option>Otro</option>
          </select>
          {f.tecnico_principal === 'Otro' && (
            <input className="input mt-2" value={f.tecPrincipalOtro} onChange={(e) => set('tecPrincipalOtro', e.target.value)} placeholder="Nombre del técnico…" autoFocus />
          )}
        </Campo>
        <div className="sm:col-span-2">
          <label className="label">Técnicos Secundarios <span className="text-slate-400 font-normal">(uno o más)</span></label>
          <div className="flex flex-wrap gap-2">
            {LISTA_TECNICOS.map((t) => <Chip key={t} activo={secSel.includes(t)} onClick={() => toggleSec(t)}>{t}</Chip>)}
            <Chip activo={secSel.includes('Otro')} onClick={() => toggleSec('Otro')}>Otro</Chip>
          </div>
          {secSel.includes('Otro') && (
            <input className="input mt-2" value={secOtro} onChange={(e) => setSecOtro(e.target.value)} placeholder="Nombre del técnico…" autoFocus />
          )}
        </div>
      </Seccion>

      <Seccion n={2} titulo="Datos del Vehículo">
        <Campo label="Patente" req>
          <input className="input" value={f.patente} maxLength={9}
                 onChange={(e) => { set('patente', formatPatente(e.target.value)); buscarVehiculo(e.target.value) }}
                 placeholder="XX XX XX" />
          {veh && <p className="text-xs text-green-600 mt-1">Vehículo encontrado: {[veh.clientes?.nombre, veh.clientes?.apellidos].filter(Boolean).join(' ') || 'cliente'}</p>}
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
        <Campo label="Tipo de Vehículo" hint="Asocia el vehículo a la lista de precios (MO por tipo)">
          <select className="input" value={f.tipo_vehiculo} onChange={(e) => set('tipo_vehiculo', e.target.value)}>
            <option value="">Seleccionar…</option>
            {TIPOS_VEHICULO.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Campo>
      </Seccion>

      <Seccion n={3} titulo="Datos del Cliente">
        <Campo label="Tipo de Cliente" req>
          <select className="input" value={f.tipo_cliente} onChange={(e) => set('tipo_cliente', e.target.value)}>
            {OT_TIPO_CLIENTE.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Campo>
        <Campo label={esEmpresa ? 'Razón Social' : 'Nombre(s)'} req>
          <input className="input" value={f.propietario} onChange={(e) => set('propietario', e.target.value)}
                 placeholder={esEmpresa ? 'Ej: Transportes del Norte SpA' : 'Ej: Juan Pablo'} />
        </Campo>
        {!esEmpresa && (
          <Campo label="Apellido(s)" req>
            <input className="input" value={f.apellidos} onChange={(e) => set('apellidos', e.target.value)}
                   placeholder="Ej: Pérez Soto" />
          </Campo>
        )}
        <Campo label="RUT" req>
          <input className="input" value={f.rut} onChange={(e) => set('rut', e.target.value)}
                 onBlur={(e) => set('rut', e.target.value ? formatRut(e.target.value) : '')}
                 placeholder={esEmpresa ? 'RUT empresa: 76.123.456-7' : '12.345.678-9'} />
        </Campo>
        {esEmpresa && (
          <Campo label="Nombre del contacto" req>
            <input className="input" value={f.contacto_nombre} onChange={(e) => set('contacto_nombre', e.target.value)} placeholder="Persona de contacto en la empresa" />
          </Campo>
        )}
        <Campo label={esEmpresa ? 'Teléfono del contacto' : 'Teléfono'} req>
          <input className="input" value={f.telefono} onChange={(e) => set('telefono', e.target.value)}
                 onBlur={(e) => set('telefono', fmtFonoOT(e.target.value))} placeholder="+56 9 XXXX XXXX" />
        </Campo>
        <Campo label={esEmpresa ? 'Correo del contacto' : 'Correo Electrónico'} req={!f.sin_correo}>
          <input className="input" type="email" value={f.email} disabled={f.sin_correo}
                 onChange={(e) => set('email', e.target.value)} placeholder={f.sin_correo ? 'Sin correo' : 'cliente@ejemplo.com'} />
          <label className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 cursor-pointer">
            <input type="checkbox" checked={f.sin_correo}
                   onChange={(e) => { set('sin_correo', e.target.checked); if (e.target.checked) set('email', '') }} />
            El cliente no aporta correo
          </label>
        </Campo>
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
        <Campo label="Dirección (calle y número)" req><input className="input" value={f.direccion} onChange={(e) => set('direccion', e.target.value)} placeholder="Ej: Av. Balmaceda 1234" /></Campo>
        <Campo label="Depto / Casa / Referencia" full><input className="input" value={f.direccion_ref} onChange={(e) => set('direccion_ref', e.target.value)} placeholder="Ej: Depto 502, Torre B" /></Campo>
      </Seccion>

      {presups.length > 0 && (
        <div className="card p-5 border-l-4 border-didial-amber">
          <h2 className="font-semibold text-ink mb-1">Presupuesto del taller pendiente</h2>
          <p className="text-xs text-slate-500 mb-3">Selecciona el presupuesto completo o punto a punto (parcial). Los montos se cargan automáticamente a la OT.</p>
          <div className="space-y-3">
            {presups.map((p) => {
              const n = (p.items || []).length
              const marcados = (p.items || []).filter((_, i) => selItems[p.id + ':' + i]).length
              return (
                <div key={p.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-sm font-semibold text-ink">Presupuesto {new Date(p.creado_en).toLocaleDateString('es-CL')}</span>
                    <span className="text-xs text-slate-400">{marcados}/{n} ítems seleccionados</span>
                    <div className="ml-auto flex gap-2">
                      <button type="button" className="btn-soft text-xs" onClick={() => toggleTodo(p, true)}>Completo</button>
                      <button type="button" className="btn-soft text-xs" onClick={() => toggleTodo(p, false)}>Ninguno</button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {(p.items || []).map((x, i) => (
                      <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={!!selItems[p.id + ':' + i]} onChange={() => toggleItem(p, i)} />
                        {x.codigo && <span className="font-mono text-xs text-slate-400">{x.codigo}</span>}
                        <span className="flex-1 text-ink">{x.detalle || x.tipo}</span>
                        <span className="text-xs text-slate-400">x{x.cant}</span>
                        <span className="text-xs font-semibold text-ink w-24 text-right">{x.en_stock ? 'Bodega' : '$' + fmtMiles((+x.precio || 0) * (+x.cant || 1))}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Seccion n={4} titulo="Información de la Reparación">
        <Campo label="Repuestos"><Monto value={f.repuestos} onChange={(e) => set('repuestos', e.target.value)} /></Campo>
        <Campo label="Lubricantes e Insumos"><Monto value={f.lubricantes} onChange={(e) => set('lubricantes', e.target.value)} /></Campo>
        <Campo label="Mano de Obra" req={!esGarantia} hint={esGarantia ? '✓ Garantía: puede ser $0' : ''}>
          <Monto value={f.mo} onChange={(e) => set('mo', e.target.value)} />
        </Campo>
        <Campo label="Servicio Externo"><Monto value={f.servicioExterno} onChange={(e) => set('servicioExterno', e.target.value)} /></Campo>
        {(+f.servicioExterno || 0) > 0 && (
          <Campo label="Detalle del Servicio Externo" req full>
            <input className="input" value={f.descSE} onChange={(e) => set('descSE', e.target.value)} placeholder="Proveedor y concepto…" />
          </Campo>
        )}
        <Campo label="Descuento"><Monto value={f.descuento} onChange={(e) => set('descuento', e.target.value)} /></Campo>
        <Campo label="Total Reparación">
          <div className="input bg-mist font-bold text-deep">$ {fmtMiles(total)}</div>
        </Campo>
      </Seccion>

      <Seccion n={5} titulo="Clasificación del Servicio">
        <Campo label="Tipo de Servicio 1" req>
          <select className="input" value={f.tipo_servicio_1} onChange={(e) => set('tipo_servicio_1', e.target.value)}>
            <option value="">Seleccionar…</option>
            {GRUPOS_SVC.map((g) => (
              <optgroup key={g.bu} label={g.bu}>{g.items.map((s) => <option key={s}>{s}</option>)}</optgroup>
            ))}
          </select>
        </Campo>
        <Campo label="Tipo de Servicio 2 (opcional)">
          <select className="input" value={f.tipo_servicio_2} onChange={(e) => set('tipo_servicio_2', e.target.value)}>
            <option value="">Ninguno</option>
            {GRUPOS_SVC.map((g) => (
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
          {OT_ENCUESTA.map((q) => (
            <div key={q.k} className="sm:col-span-2">
              <div className="text-sm font-medium text-ink mb-1.5">
                <span className="text-deep font-bold mr-1">{q.n}.</span>{q.titulo}
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button type="button" key={n} onClick={() => set(q.k, String(n))}
                    className={`w-9 h-9 rounded-lg border text-sm font-semibold transition ${String(n) === f[q.k]
                      ? 'bg-deep text-white border-deep' : 'bg-white text-slate-500 border-slate-200 hover:border-deep'}`}>{n}</button>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>1 — {q.izq}</span><span>7 — {q.der}</span>
              </div>
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="label">5. ¿Cómo conoció DIDIAL? <span className="text-slate-400 font-normal">(mide nuestras estrategias de marketing)</span></label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {OT_CONOCIO.map((c) => (
                <button type="button" key={c.v} onClick={() => set('enc_conocio', c.v)}
                  className={`px-3 py-2 rounded-lg border text-sm transition text-center ${f.enc_conocio === c.v
                    ? 'bg-deep text-white border-deep font-semibold' : 'bg-white text-slate-600 border-slate-200 hover:border-deep'}`}>
                  {c.e} {c.v}
                </button>
              ))}
            </div>
            {f.enc_conocio === 'Otro' && (
              <input className="input mt-2" value={f.conocioOtro} onChange={(e) => set('conocioOtro', e.target.value)} placeholder="Especifica cómo nos conoció…" autoFocus />
            )}
          </div>
        </>}
      </Seccion>

      {msg && (
        <div className={`rounded-lg px-4 py-2.5 text-sm ${msg.t === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{msg.m}</div>
      )}
      {/* v25: solicitud de anulación al FINAL del formulario. Solo aparece si
          los montos de reparación quedaron en $0 (y no es garantía). */}
      {!esGarantia && total <= 0 && (
        <div className="rounded-lg border border-didial-amber bg-amber-50 p-3 space-y-2">
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={f.solicitar_anular}
                   onChange={(e) => set('solicitar_anular', e.target.checked)} />
            <span className="text-xs text-slate-700">
              <b>Solicitar anular OT.</b> La OT se guardará con los datos del cliente y montos en $0,
              y se notificará a administración para registrarla como nula (requiere su autorización).
            </span>
          </label>
          {f.solicitar_anular && (
            <textarea className="input text-xs" rows="2" required value={f.motivo_anulacion}
                      onChange={(e) => set('motivo_anulacion', e.target.value)}
                      placeholder="Motivo de la anulación (obligatorio): ej. cliente desistió, OT emitida por error, doble registro…" />
          )}
        </div>
      )}
      <div className="flex justify-end items-center gap-3 sticky bottom-0 bg-paper/80 backdrop-blur py-3">
        <button type="submit" disabled={guardando} className="btn-primary px-6">
          {guardando ? 'Guardando…' : 'Guardar OT'}
        </button>
      </div>
    </form>
  )
}
