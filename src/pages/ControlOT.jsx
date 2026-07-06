import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, fetchAllRows } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Pill, Modal } from '../components/UI'
import { formatPatente, formatRut, formatTelefono, fmtCLP, fmtFecha, TIPOS_CLIENTE, TIPOS_VEHICULO } from '../lib/helpers'

const MOTIVOS = {
  en_taller: { label: 'Vehículo en taller', color: '#2f6fb0' },
  pendiente_ingreso: { label: 'OT nula', color: '#C98A1B' },   // v23: reemplaza "Pendiente de ingreso"
  otro: { label: 'Otro motivo', color: '#7A5C8E' }
}

/* Carga gviz por JSONP (hoja pública) */
function loadSheet(sheetId, gid) {
  return new Promise((resolve, reject) => {
    const cb = 'gviz_ctl_' + Math.floor(Math.random() * 1e9)
    let done = false, s
    const clean = () => { try { delete window[cb] } catch { } if (s?.parentNode) s.parentNode.removeChild(s) }
    const timer = setTimeout(() => { if (!done) { done = true; clean(); reject(new Error('timeout')) } }, 15000)
    window[cb] = (resp) => {
      if (done) return; done = true; clearTimeout(timer)
      try {
        const cols = resp.table.cols.map((c) => c.label || '')
        const rows = resp.table.rows.map((r) => { const o = {}; cols.forEach((l, i) => { if (l) o[l] = r.c[i] ? r.c[i].v : null }); return o })
        clean(); resolve({ cols: cols.filter(Boolean), rows })
      } catch (e) { clean(); reject(e) }
    }
    s = document.createElement('script')
    s.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?gid=${gid}&headers=1&tqx=out:json;responseHandler:${cb}`
    s.onerror = () => { if (!done) { done = true; clearTimeout(timer); clean(); reject(new Error('No se pudo cargar la hoja.')) } }
    document.body.appendChild(s)
  })
}

export default function ControlOT() {
  const [tab, setTab] = useState('huerfanas') // huerfanas | faltantes
  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Control de OT</h1>
          <p className="text-sm text-slate-500">Revisión de consistencia entre la base de OT y el CRM</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          <button onClick={() => setTab('huerfanas')} className={`px-3 py-1.5 ${tab === 'huerfanas' ? 'bg-deep text-white' : 'text-slate-500'}`}>OT sin cliente</button>
          <button onClick={() => setTab('faltantes')} className={`px-3 py-1.5 ${tab === 'faltantes' ? 'bg-deep text-white' : 'text-slate-500'}`}>OT faltantes en la base</button>
        </div>
      </div>
      {tab === 'huerfanas' ? <Huerfanas /> : <Faltantes />}
    </div>
  )
}

/* =====================================================================
   v21.2 · OT SIN CLIENTE: OT sincronizadas del historial cuya patente no
   existe (o no está vinculada) en el CRM. Se agrupan por patente para
   crear la ficha del cliente con sus datos, o vincularla a un cliente
   existente. Al guardar se enlazan todas las OT de esa patente y se
   recalculan los indicadores del cliente.
   ===================================================================== */
function Huerfanas() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [filas, setFilas] = useState(null)
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(null)   // grupo en edición
  const [ok, setOk] = useState('')

  useEffect(() => { cargar() }, [perfil?.empresa_id])
  async function cargar() {
    const data = await fetchAllRows('servicios', 'id,ot_numero,patente,fecha,monto,tipo_servicio,km',
      (q) => q.is('cliente_id', null).order('fecha', { ascending: false }))
    setFilas(data || [])
  }

  const grupos = useMemo(() => {
    if (!filas) return []
    const m = {}
    filas.forEach((s) => {
      const k = (s.patente || 'SIN PATENTE').toUpperCase()
      const g = m[k] || (m[k] = { patente: s.patente || null, key: k, ots: [], total: 0, desde: null, hasta: null })
      g.ots.push(s)
      g.total += +s.monto || 0
      if (s.fecha) {
        if (!g.desde || s.fecha < g.desde) g.desde = s.fecha
        if (!g.hasta || s.fecha > g.hasta) g.hasta = s.fecha
      }
    })
    let lista = Object.values(m).sort((a, b) => b.ots.length - a.ots.length)
    const q = busca.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (q) {
      lista = lista.filter((g) =>
        g.key.replace(/[^A-Z0-9]/g, '').includes(q) ||
        g.ots.some((s) => String(s.ot_numero || '').includes(busca.trim())))
    }
    return lista
  }, [filas, busca])

  if (filas === null) return <div className="text-slate-400 text-sm py-10 text-center">Buscando OT sin cliente…</div>

  return (
    <div className="space-y-3">
      <div className="card p-3 flex items-center gap-3 flex-wrap">
        <input className="input flex-1 min-w-56" value={busca} onChange={(e) => setBusca(e.target.value)}
               placeholder="🔎 Buscar por patente o N° de OT…" />
        <span className="text-xs text-slate-500">{filas.length} OT sin cliente · {grupos.length} patentes</span>
      </div>
      {ok && <div className="card p-3 text-sm text-green-700 bg-green-50 border-green-200">{ok}</div>}
      <p className="text-[11px] text-slate-400">
        Estas OT vienen del historial sincronizado pero su cliente no existe (o no está vinculado) en el CRM.
        Al ejecutar la sincronización v2, las que traen nombre de propietario en la planilla se crean solas;
        aquí resuelves manualmente el resto: crea la ficha con los datos del cliente o vincúlala a uno existente.
      </p>
      <div className="space-y-2">
        {grupos.slice(0, 100).map((g) => (
          <div key={g.key} className="card p-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono font-bold text-ink">{g.patente ? formatPatente(g.patente) : '— sin patente —'}</span>
              <span className="text-xs text-slate-500">{g.ots.length} OT · {fmtCLP(g.total)}</span>
              {g.desde && <span className="text-xs text-slate-400">{fmtFecha(g.desde)} → {fmtFecha(g.hasta)}</span>}
              <div className="ml-auto flex gap-2">
                {g.patente ? (<>
                  <button className="btn-primary text-xs" onClick={() => setModal({ g, modo: 'crear' })}>+ Crear ficha de cliente</button>
                  <button className="btn-soft text-xs" onClick={() => setModal({ g, modo: 'vincular' })}>Vincular a cliente existente</button>
                </>) : (
                  <span className="text-[11px] text-didial-amber max-w-72 text-right">
                    ⚠ Sin patente: no se vinculan a clientes. Primero completa estas OT en la planilla base
                    (varias aparecen también en "OT faltantes en la base") y el sync las tomará con su patente.
                  </span>
                )}
              </div>
            </div>
            <div className="mt-1.5 text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
              {g.ots.slice(0, 12).map((s) => (
                <span key={s.id}><b className="text-deep">OT {s.ot_numero}</b>{s.tipo_servicio ? ` · ${s.tipo_servicio}` : ''}{s.monto ? ` · ${fmtCLP(s.monto)}` : ''}</span>
              ))}
              {g.ots.length > 12 && <span className="text-slate-400">… y {g.ots.length - 12} más</span>}
            </div>
          </div>
        ))}
        {grupos.length > 100 && <p className="text-xs text-slate-400 text-center">Mostrando las primeras 100 patentes (usa el buscador para acotar).</p>}
        {!grupos.length && <div className="card p-8 text-center text-sm text-slate-400">{busca ? 'Sin resultados para esa búsqueda.' : '¡No quedan OT sin cliente! 🎉'}</div>}
      </div>
      {modal && (
        <ModalResolver grupo={modal.g} modo={modal.modo} perfil={perfil}
                       onClose={() => setModal(null)}
                       onListo={(msg, clienteId) => {
                         setModal(null); setOk(msg); cargar()
                         if (clienteId) setTimeout(() => navigate(`/clientes/${clienteId}`), 900)
                       }} />
      )}
    </div>
  )
}

/* Crear ficha nueva o vincular a cliente existente, y enlazar sus OT */
function ModalResolver({ grupo, modo, perfil, onClose, onListo }) {
  const [f, setF] = useState({
    nombre: '', apellidos: '', rut: '', telefono: '', email: '',
    direccion: '', comuna: '', ciudad: 'La Serena', tipo: 'PERSONA',
    marca: '', modelo: '', anio: '', tipo_vehiculo: ''
  })
  const [q, setQ] = useState('')
  const [res, setRes] = useState([])
  const [sel, setSel] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function buscarClientes(texto) {
    setQ(texto); setSel(null)
    if (texto.trim().length < 2) { setRes([]); return }
    const t = texto.trim()
    const { data } = await supabase.from('clientes')
      .select('id,nombre,apellidos,rut,telefono')
      .or(`nombre.ilike.%${t}%,apellidos.ilike.%${t}%,rut.ilike.%${t}%,telefono.ilike.%${t}%`)
      .limit(10)
    setRes(data || [])
  }

  // Enlaza las OT del grupo al cliente (y vehículo si hay patente) y
  // recalcula facturación / N° OT / última visita del cliente.
  async function enlazar(clienteId, vehiculoId) {
    let upd = supabase.from('servicios')
      .update({ cliente_id: clienteId, vehiculo_id: vehiculoId || null })
      .is('cliente_id', null)
    upd = grupo.patente ? upd.eq('patente', grupo.patente)
                        : upd.in('id', grupo.ots.map((s) => s.id))
    await upd
    const { data: srv } = await supabase.from('servicios')
      .select('monto,fecha').eq('cliente_id', clienteId)
    const total = (srv || []).reduce((s, x) => s + (+x.monto || 0), 0)
    const ult = (srv || []).map((x) => x.fecha).filter(Boolean).sort().pop() || null
    await supabase.from('clientes').update({
      facturacion_total: total, num_ot: (srv || []).length, ultima_visita: ult,
      ticket_promedio: srv?.length ? Math.round(total / srv.length) : 0
    }).eq('id', clienteId)
  }

  async function crear(e) {
    e.preventDefault()
    if (guardando) return
    setGuardando(true)
    try {
      const { data: cli, error } = await supabase.from('clientes').insert({
        empresa_id: perfil.empresa_id,
        nombre: f.nombre.trim(), apellidos: f.apellidos.trim() || null,
        rut: f.rut ? formatRut(f.rut) : null,
        telefono: f.telefono ? formatTelefono(f.telefono) : null,
        email: f.email.trim() || null, direccion: f.direccion.trim() || null,
        comuna: f.comuna.trim() || null, ciudad: f.ciudad.trim() || null,
        tipo: f.tipo, segmento: 'nuevo',
        notas: 'Creado desde Control de OT (OT sin cliente)'
      }).select('id').single()
      if (error) throw error
      let vehId = null
      if (grupo.patente) {
        const kms = grupo.ots.map((s) => +s.km || 0)
        const { data: veh, error: e2 } = await supabase.from('vehiculos').insert({
          empresa_id: perfil.empresa_id, cliente_id: cli.id,
          patente: formatPatente(grupo.patente),
          marca: f.marca.trim().toUpperCase() || null, modelo: f.modelo.trim().toUpperCase() || null,
          anio: Number(f.anio) || null, tipo_vehiculo: f.tipo_vehiculo || null,
          km_ultimo: Math.max(0, ...kms) || null, km_actual_estimado: Math.max(0, ...kms) || null
        }).select('id').single()
        if (e2) throw e2
        vehId = veh.id
      }
      await enlazar(cli.id, vehId)
      onListo(`Cliente creado y ${grupo.ots.length} OT vinculadas. Abriendo su ficha…`, cli.id)
    } catch (err) { alert('Error: ' + err.message); setGuardando(false) }
  }

  async function vincular() {
    if (!sel || guardando) return
    setGuardando(true)
    try {
      let vehId = null
      if (grupo.patente) {
        const kms = grupo.ots.map((s) => +s.km || 0)
        const { data: veh, error } = await supabase.from('vehiculos').insert({
          empresa_id: perfil.empresa_id, cliente_id: sel.id,
          patente: formatPatente(grupo.patente),
          marca: f.marca.trim().toUpperCase() || null, modelo: f.modelo.trim().toUpperCase() || null,
          anio: Number(f.anio) || null, tipo_vehiculo: f.tipo_vehiculo || null,
          km_ultimo: Math.max(0, ...kms) || null, km_actual_estimado: Math.max(0, ...kms) || null
        }).select('id').single()
        if (error) throw error
        vehId = veh.id
      }
      await enlazar(sel.id, vehId)
      onListo(`${grupo.ots.length} OT vinculadas a ${[sel.nombre, sel.apellidos].filter(Boolean).join(' ')}.`, sel.id)
    } catch (err) { alert('Error: ' + err.message); setGuardando(false) }
  }

  const camposVehiculo = () => grupo.patente ? (
    <>
      <div className="text-xs font-semibold text-slate-500 pt-1">Vehículo · patente {formatPatente(grupo.patente)}</div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Marca</label>
          <input className="input" value={f.marca} onChange={(e) => setF({ ...f, marca: e.target.value })} /></div>
        <div><label className="label">Modelo</label>
          <input className="input" value={f.modelo} onChange={(e) => setF({ ...f, modelo: e.target.value })} /></div>
        <div><label className="label">Año</label>
          <input className="input" type="number" value={f.anio} onChange={(e) => setF({ ...f, anio: e.target.value })} /></div>
        <div><label className="label">Tipo de vehículo</label>
          <select className="input" value={f.tipo_vehiculo} onChange={(e) => setF({ ...f, tipo_vehiculo: e.target.value })}>
            <option value="">—</option>
            {TIPOS_VEHICULO.map((t) => <option key={t} value={t}>{t}</option>)}
          </select></div>
      </div>
    </>
  ) : null

  return (
    <Modal abierto onClose={onClose} ancho="max-w-xl"
           titulo={modo === 'crear'
             ? `Crear ficha · ${grupo.patente ? formatPatente(grupo.patente) : 'sin patente'} (${grupo.ots.length} OT)`
             : `Vincular ${grupo.ots.length} OT a un cliente existente`}>
      {modo === 'crear' ? (
        <form onSubmit={crear} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Nombre(s) *</label>
              <input className="input" required autoFocus value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></div>
            <div><label className="label">Apellido(s)</label>
              <input className="input" value={f.apellidos} onChange={(e) => setF({ ...f, apellidos: e.target.value })} /></div>
            <div><label className="label">RUT</label>
              <input className="input" value={f.rut} onChange={(e) => setF({ ...f, rut: e.target.value })}
                     onBlur={(e) => setF({ ...f, rut: formatRut(e.target.value) })} placeholder="12.345.678-9" /></div>
            <div><label className="label">Tipo</label>
              <select className="input" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
                {Object.entries(TIPOS_CLIENTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label className="label">Teléfono</label>
              <input className="input" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} /></div>
            <div><label className="label">Correo</label>
              <input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div><label className="label">Dirección</label>
              <input className="input" value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} /></div>
            <div><label className="label">Comuna</label>
              <input className="input" value={f.comuna} onChange={(e) => setF({ ...f, comuna: e.target.value })} /></div>
            <div><label className="label">Ciudad</label>
              <input className="input" value={f.ciudad} onChange={(e) => setF({ ...f, ciudad: e.target.value })} /></div>
          </div>
          {camposVehiculo()}
          <p className="text-[11px] text-slate-400">Completa lo que tengas del cliente (aquí solo el nombre es obligatorio para poder recuperar la ficha; el resto se exige al editarla después). Al guardar se vinculan las {grupo.ots.length} OT y se recalcula su facturación.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-soft" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Crear y vincular OT'}</button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="label">Buscar cliente (nombre, RUT o teléfono)</label>
            <input className="input" autoFocus value={q} onChange={(e) => buscarClientes(e.target.value)} placeholder="Ej: Mauricio Díaz…" />
          </div>
          {!!res.length && (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {res.map((c) => (
                <button key={c.id} type="button" onClick={() => setSel(c)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-mist/60 ${sel?.id === c.id ? 'bg-mist' : ''}`}>
                  <b className="text-ink">{[c.nombre, c.apellidos].filter(Boolean).join(' ')}</b>
                  <span className="text-xs text-slate-400"> · {c.rut || 'sin RUT'} · {c.telefono || 'sin fono'}</span>
                </button>
              ))}
            </div>
          )}
          {sel && camposVehiculo()}
          {sel && grupo.patente && <p className="text-[11px] text-slate-400">Se creará el vehículo {formatPatente(grupo.patente)} bajo {[sel.nombre, sel.apellidos].filter(Boolean).join(' ')} y se vincularán sus {grupo.ots.length} OT.</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-soft" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" disabled={!sel || guardando} onClick={vincular}>{guardando ? 'Vinculando…' : 'Vincular OT'}</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* =====================================================================
   OT FALTANTES EN LA BASE (funcionalidad original: hoja Control_OTs)
   ===================================================================== */
function Faltantes() {
  const { perfil } = useAuth()
  const [estado, setEstado] = useState('cargando')
  const [msg, setMsg] = useState('')
  const [ots, setOts] = useState([])
  const [rev, setRev] = useState({})
  const [filtro, setFiltro] = useState('pendientes')

  useEffect(() => { cargar() }, [perfil?.empresa_id])

  async function cargar() {
    if (!perfil?.empresa_id) return
    try {
      const { data: cfg } = await supabase.from('empresa_config').select('valor')
        .eq('empresa_id', perfil.empresa_id).eq('clave', 'control_ots').maybeSingle()
      const c = cfg?.valor || {}
      if (!c.sheet_id || !c.gid || String(c.gid).includes('GID')) {
        setEstado('sin_config'); return
      }
      const [{ rows }, { data: revs }] = await Promise.all([
        loadSheet(c.sheet_id, c.gid),
        supabase.from('control_ot_revision').select('*').eq('empresa_id', perfil.empresa_id)
      ])
      const nums = []
      rows.forEach((r) => {
        const vals = Object.values(r).filter((v) => v !== null && v !== '')
        const n = vals.find((v) => /^\d{3,}$/.test(String(v).trim()))
        if (n) nums.push(String(n).trim())
      })
      setOts([...new Set(nums)])
      setRev(Object.fromEntries((revs || []).map((x) => [x.ot_numero, x])))
      setEstado('listo')
    } catch (e) { setMsg(e.message); setEstado('error') }
  }

  async function marcar(ot, motivo, nota) {
    await supabase.from('control_ot_revision').upsert({
      empresa_id: perfil.empresa_id, ot_numero: ot, motivo, nota: nota ?? rev[ot]?.nota ?? '',
      revisado_por: perfil.id, actualizado_en: new Date().toISOString()
    }, { onConflict: 'empresa_id,ot_numero' })
    cargar()
  }

  const vista = useMemo(() => {
    if (filtro === 'pendientes') return ots.filter((o) => !rev[o]?.motivo)
    if (filtro === 'revisadas') return ots.filter((o) => rev[o]?.motivo)
    return ots
  }, [ots, rev, filtro])

  const pendientes = ots.filter((o) => !rev[o]?.motivo).length

  if (estado === 'cargando') return <div className="text-slate-400 text-sm py-10 text-center">Cargando control de OT…</div>
  if (estado === 'sin_config') return (
    <div className="card p-6 max-w-lg">
      <p className="text-sm text-slate-600">Falta configurar la ubicación de la hoja <b>Control_OTs</b>. Ejecuta la migración v19 reemplazando <code>GID_CONTROL_OTS</code> por el gid real de la pestaña (visible en la URL del Sheet), compartida como "Cualquiera con el enlace · Lector".</p>
    </div>
  )
  if (estado === 'error') return (
    <div className="card p-6 max-w-lg">
      <p className="text-sm text-red-600">No se pudo cargar la hoja: {msg}</p>
      <button className="btn-primary mt-3" onClick={cargar}>Reintentar</button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-slate-500">OT faltantes en la base · {pendientes} por revisar de {ots.length}</p>
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          {[['pendientes', `Pendientes (${pendientes})`], ['revisadas', 'Revisadas'], ['todas', 'Todas']].map(([v, l]) => (
            <button key={v} onClick={() => setFiltro(v)} className={`px-3 py-1.5 ${filtro === v ? 'bg-deep text-white' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper text-slate-400 text-xs">
            <tr>
              <th className="text-left font-medium px-4 py-3 w-24">N° OT</th>
              <th className="text-left font-medium px-2 py-3">Motivo</th>
              <th className="text-left font-medium px-2 py-3">Nota</th>
              <th className="text-left font-medium px-4 py-3 hidden sm:table-cell w-32">Revisado</th>
            </tr>
          </thead>
          <tbody>
            {vista.map((ot) => {
              const r = rev[ot]
              return (
                <tr key={ot} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-mono font-semibold text-ink">{ot}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      {Object.entries(MOTIVOS).map(([k, v]) => (
                        <button key={k} onClick={() => {
                            // v23: "Otro motivo" exige detallar antes de continuar
                            if (k === 'otro' && r?.motivo !== 'otro' && !(r?.nota || '').trim()) {
                              const det = window.prompt('Detalla el motivo antes de continuar:')
                              if (!det || !det.trim()) return
                              marcar(ot, 'otro', det.trim()); return
                            }
                            marcar(ot, r?.motivo === k ? null : k)
                          }}
                          className={`px-2 py-1 rounded text-[11px] border transition ${r?.motivo === k ? 'text-white border-transparent' : 'text-slate-500 border-slate-200 hover:border-deep'}`}
                          style={r?.motivo === k ? { background: v.color } : {}}>{v.label}</button>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <input className="input text-xs" defaultValue={r?.nota || ''} placeholder="Detalle…"
                           onBlur={(e) => { if ((e.target.value || '') !== (r?.nota || '')) marcar(ot, r?.motivo || null, e.target.value) }} />
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell text-xs text-slate-400">
                    {r?.actualizado_en ? new Date(r.actualizado_en).toLocaleDateString('es-CL') : '—'}
                  </td>
                </tr>
              )
            })}
            {!vista.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-sm">{filtro === 'pendientes' ? '¡Todo revisado! No hay OT pendientes de clasificar.' : 'Sin registros.'}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400">La lista de OT faltantes viene en vivo de la hoja Control_OTs. Clasifica cada una: si el vehículo está en taller, pendiente de ingreso u otro motivo con su detalle.</p>
    </div>
  )
}
