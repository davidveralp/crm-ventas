import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatPatente, patenteLimpia, fmtFonoOT, SERVICIOS_ORDENADOS } from '../lib/helpers'

/* ============================================================================
   Recepción · agenda de taller con capacidad por isla
   ----------------------------------------------------------------------------
   Responde la pregunta que hoy no tiene respuesta: "¿queda cupo mañana?".

   El taller tiene 4 islas y una jornada de 9 horas, así que la capacidad diaria
   son 2.160 minutos. Cada cita ocupa los minutos que dura su servicio, y la
   barra muestra cuánto queda antes de comprometerle una hora al cliente.

   La pestaña de WhatsApp queda preparada pero inactiva: requiere la API de
   WhatsApp Business aprobada por Meta. Mientras tanto, las citas se registran
   con el canal por el que llegaron.
   ========================================================================== */

const HORAS = Array.from({ length: 10 }, (_, i) => 8 + i)   // 08:00 a 17:00
const JORNADA_MIN = 540

const ESTADO_CITA = {
  agendada:   { label: 'Agendada',   color: '#2f6fb0' },
  confirmada: { label: 'Confirmada', color: '#1f9d57' },
  llego:      { label: 'Llegó',      color: '#111922' },
  no_llego:   { label: 'No llegó',   color: '#e0382b' },
  cancelada:  { label: 'Cancelada',  color: '#94a3b8' },
  convertida: { label: 'Ingresó',    color: '#1f9d57' }
}

const iso = (d) => d.toISOString().slice(0, 10)
const hhmm = (t) => new Date(t).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })

export default function Recepcion() {
  const { perfil } = useAuth()
  const nav = useNavigate()
  const [tab, setTab] = useState('agenda')
  const [dia, setDia] = useState(iso(new Date()))
  const [citas, setCitas] = useState([])
  const [islas, setIslas] = useState([])
  const [duraciones, setDuraciones] = useState({})
  const [estado, setEstado] = useState('cargando')
  const [errMsg, setErrMsg] = useState('')
  const [nueva, setNueva] = useState(null)

  useEffect(() => { cargar() }, [dia]) // eslint-disable-line

  async function cargar() {
    setEstado('cargando')
    const desde = new Date(dia + 'T00:00:00').toISOString()
    const hasta = new Date(dia + 'T23:59:59').toISOString()
    const [c, i, sd] = await Promise.all([
      supabase.from('citas')
        .select('*, clientes(nombre, apellidos), vehiculos(patente, marca, modelo)')
        .gte('inicia', desde).lte('inicia', hasta).order('inicia'),
      supabase.from('islas').select('*').eq('activa', true).order('orden'),
      supabase.from('servicio_duracion').select('*')
    ])
    if (c.error) { setErrMsg(c.error.message); setEstado('error'); return }
    setCitas(c.data || []); setIslas(i.data || [])
    const m = {}; (sd.data || []).forEach((x) => { m[x.servicio] = x.minutos })
    setDuraciones(m); setEstado('listo')
  }

  const activas = useMemo(
    () => citas.filter((c) => !['cancelada', 'no_llego'].includes(c.estado)), [citas])

  const cap = useMemo(() => {
    const porIsla = islas.map((i) => {
      const cs = activas.filter((c) => c.isla_id === i.id)
      const ocupado = cs.reduce((a, c) => a + (c.minutos || 120), 0)
      return { ...i, cs, ocupado, libre: Math.max(0, JORNADA_MIN - ocupado), pct: Math.min(100, ocupado / JORNADA_MIN * 100) }
    })
    const sinIsla = activas.filter((c) => !c.isla_id)
    const totalOcup = activas.reduce((a, c) => a + (c.minutos || 120), 0)
    const totalCap = islas.length * JORNADA_MIN
    return {
      porIsla, sinIsla, totalOcup, totalCap,
      pct: totalCap ? Math.min(100, totalOcup / totalCap * 100) : 0,
      libreHoras: Math.max(0, (totalCap - totalOcup) / 60)
    }
  }, [activas, islas])

  async function cambiarEstado(c, nuevo) {
    await supabase.from('citas').update({ estado: nuevo }).eq('id', c.id)
    cargar()
  }

  if (estado === 'cargando') return <div className="text-slate-400 text-sm">Cargando recepción…</div>
  if (estado === 'error') return (
    <div className="card p-4">
      <p className="text-sm text-slate-600">No se pudo cargar la agenda.</p>
      <p className="text-xs text-slate-400 mt-1">{errMsg}</p>
      <p className="text-[11px] text-slate-400 mt-2">Si menciona <code>citas</code> o <code>islas</code>, falta la migración 69.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-ink">Recepción</h1>
        <p className="text-sm text-slate-500">Agenda del taller y capacidad por isla</p>
      </div>

      <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm">
        {[['agenda', 'Agenda'], ['capacidad', 'Capacidad'], ['whatsapp', 'WhatsApp']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-2 ${tab === k ? 'bg-deep text-white' : 'text-slate-500'}`}>{l}</button>
        ))}
      </div>

      {tab !== 'whatsapp' && (
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn-soft text-sm"
                  onClick={() => { const d = new Date(dia); d.setDate(d.getDate() - 1); setDia(iso(d)) }}>←</button>
          <input className="input w-44" type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
          <button className="btn-soft text-sm"
                  onClick={() => { const d = new Date(dia); d.setDate(d.getDate() + 1); setDia(iso(d)) }}>→</button>
          <button className="btn-soft text-sm" onClick={() => setDia(iso(new Date()))}>Hoy</button>
          <button className="btn-primary text-sm ml-auto" onClick={() => setNueva({})}>+ Agendar</button>
        </div>
      )}

      {/* ---- Capacidad del día, siempre visible ---- */}
      {tab !== 'whatsapp' && (
        <div className="card p-3">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="text-sm font-medium text-ink">Ocupación del día</span>
            <span className="text-sm">
              <strong style={{ color: cap.pct > 85 ? '#e0382b' : cap.pct > 60 ? '#e0a020' : '#1f9d57' }}>
                {cap.pct.toFixed(0)}%
              </strong>
              <span className="text-slate-400"> · quedan {cap.libreHoras.toFixed(1)} h libres</span>
            </span>
          </div>
          <div className="h-2.5 rounded bg-slate-100 overflow-hidden">
            <div className="h-full rounded transition-all"
                 style={{ width: cap.pct + '%',
                          background: cap.pct > 85 ? '#e0382b' : cap.pct > 60 ? '#e0a020' : '#1f9d57' }} />
          </div>
          {cap.sinIsla.length > 0 && (
            <p className="text-[11px] mt-1.5" style={{ color: '#b8860b' }}>
              {cap.sinIsla.length} cita(s) sin isla asignada — el jefe de taller decide cuál.
            </p>
          )}
        </div>
      )}

      {tab === 'capacidad' && (
        <div className="grid sm:grid-cols-2 gap-3">
          {cap.porIsla.map((i) => (
            <div key={i.id} className="card p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-ink">{i.nombre}</span>
                <span className="text-xs text-slate-500">
                  {(i.ocupado / 60).toFixed(1)} h de 9 · {i.cs.length} cita(s)
                </span>
              </div>
              <div className="h-2 rounded bg-slate-100 overflow-hidden">
                <div className="h-full rounded"
                     style={{ width: i.pct + '%',
                              background: i.pct > 85 ? '#e0382b' : i.pct > 60 ? '#e0a020' : '#1f9d57' }} />
              </div>
              <div className="mt-2 space-y-1">
                {i.cs.map((c) => (
                  <div key={c.id} className="text-xs text-slate-600 flex justify-between gap-2">
                    <span className="truncate">{hhmm(c.inicia)} · {c.servicio || 'Sin servicio'}</span>
                    <span className="text-slate-400 shrink-0">{c.minutos} min</span>
                  </div>
                ))}
                {!i.cs.length && <p className="text-xs text-slate-300">Sin citas</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'agenda' && (
        <div className="card overflow-hidden">
          {HORAS.map((h) => {
            const cs = activas.filter((c) => new Date(c.inicia).getHours() === h)
            return (
              <div key={h} className="flex border-b border-slate-100 last:border-0">
                <div className="w-14 shrink-0 p-2 text-xs text-slate-400 border-r border-slate-100">
                  {String(h).padStart(2, '0')}:00
                </div>
                <div className="flex-1 p-1.5 space-y-1.5">
                  {cs.map((c) => {
                    const e = ESTADO_CITA[c.estado] || ESTADO_CITA.agendada
                    return (
                      <div key={c.id} className="rounded-lg border-l-4 bg-paper p-2"
                           style={{ borderLeftColor: e.color }}>
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-ink">
                              {hhmm(c.inicia)} · {c.vehiculos?.patente ? formatPatente(c.vehiculos.patente) : (c.patente || 'Sin patente')}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {c.servicio || 'Sin servicio'} · {c.minutos} min
                              {c.isla_id && islas.find((i) => i.id === c.isla_id)
                                && ` · ${islas.find((i) => i.id === c.isla_id).nombre}`}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {c.clientes ? `${c.clientes.nombre || ''} ${c.clientes.apellidos || ''}`.trim() : (c.nombre_contacto || '—')}
                              {c.telefono && ` · ${c.telefono}`}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                  style={{ background: e.color + '20', color: e.color }}>{e.label}</span>
                            <div className="flex gap-1">
                              {c.estado === 'agendada' && (
                                <button className="text-[11px] text-blue-700" onClick={() => cambiarEstado(c, 'confirmada')}>Confirmar</button>
                              )}
                              {['agendada', 'confirmada'].includes(c.estado) && (
                                <>
                                  <button className="text-[11px] text-green-700"
                                          onClick={() => nav('/nuevo-cliente')}>Ingresar</button>
                                  <button className="text-[11px] text-slate-400" onClick={() => cambiarEstado(c, 'no_llego')}>No llegó</button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {!activas.length && (
            <p className="p-6 text-center text-sm text-slate-400">Sin citas para este día.</p>
          )}
        </div>
      )}

      {tab === 'whatsapp' && <PanelWhatsApp />}

      {nueva && <ModalCita perfil={perfil} islas={islas} duraciones={duraciones} dia={dia}
                           onCerrar={() => setNueva(null)}
                           onGuardado={() => { setNueva(null); cargar() }} />}
    </div>
  )
}

/* ------------------------------- Nueva cita ------------------------------- */

function ModalCita({ perfil, islas, duraciones, dia, onCerrar, onGuardado }) {
  const [f, setF] = useState({
    patente: '', nombre_contacto: '', telefono: '', servicio: '',
    hora: '09:00', minutos: 120, isla_id: '', canal: 'telefono', notas: ''
  })
  const [veh, setVeh] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [err, setErr] = useState('')

  async function buscar(p) {
    const q = formatPatente(p)
    setF((x) => ({ ...x, patente: q }))
    if (patenteLimpia(q).length < 5) { setVeh(null); return }
    const { data } = await supabase.from('vehiculos')
      .select('id, patente, marca, modelo, cliente_id, clientes(nombre, apellidos, telefono)')
      .ilike('patente_norm', `%${patenteLimpia(q)}%`).limit(1)
    const v = data?.[0] || null
    setVeh(v)
    if (v) setF((x) => ({
      ...x,
      nombre_contacto: x.nombre_contacto || [v.clientes?.nombre, v.clientes?.apellidos].filter(Boolean).join(' '),
      telefono: x.telefono || v.clientes?.telefono || ''
    }))
  }

  async function guardar() {
    if (!f.servicio) { setErr('Elige el servicio: define cuánto ocupa la isla.'); return }
    if (!f.patente.trim() && !f.telefono.trim()) { setErr('Ingresa al menos la patente o el teléfono.'); return }
    setGuardando(true); setErr('')
    const { error } = await supabase.from('citas').insert({
      empresa_id: perfil.empresa_id,
      cliente_id: veh?.cliente_id || null, vehiculo_id: veh?.id || null,
      isla_id: f.isla_id || null,
      nombre_contacto: f.nombre_contacto.trim() || null,
      telefono: f.telefono.trim() ? fmtFonoOT(f.telefono) : null,
      patente: f.patente.trim() || null,
      servicio: f.servicio, minutos: Number(f.minutos) || 120,
      inicia: new Date(`${dia}T${f.hora}:00`).toISOString(),
      canal: f.canal, notas: f.notas.trim() || null,
      creada_por: perfil.id
    })
    setGuardando(false)
    if (error) { setErr('No se pudo agendar: ' + error.message); return }
    onGuardado()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white sm:rounded-xl w-full max-w-lg max-h-[100dvh] sm:max-h-[92vh] overflow-y-auto">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="font-semibold text-ink">Agendar hora</h3>
          <button onClick={onCerrar} className="text-slate-400 text-xl leading-none">×</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="label">Patente</label>
            <input className="input uppercase" value={f.patente} maxLength={10}
                   onChange={(e) => buscar(e.target.value)} placeholder="Ej: GH TY 34" />
            {veh && <p className="text-xs text-green-600 mt-1">✓ {veh.marca} {veh.modelo}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Contacto</label>
              <input className="input" value={f.nombre_contacto}
                     onChange={(e) => setF({ ...f, nombre_contacto: e.target.value })} /></div>
            <div><label className="label">Teléfono</label>
              <input className="input" inputMode="tel" value={f.telefono}
                     onChange={(e) => setF({ ...f, telefono: e.target.value })} /></div>
          </div>
          <div>
            <label className="label">Servicio</label>
            {/* El servicio define los minutos: sin eso no se puede calcular capacidad. */}
            <select className="input" value={f.servicio}
                    onChange={(e) => setF({ ...f, servicio: e.target.value, minutos: duraciones[e.target.value] || 120 })}>
              <option value="">Seleccionar…</option>
              {SERVICIOS_ORDENADOS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Hora</label>
              <input className="input" type="time" value={f.hora}
                     onChange={(e) => setF({ ...f, hora: e.target.value })} /></div>
            <div><label className="label">Minutos</label>
              <input className="input" type="number" step="15" value={f.minutos}
                     onChange={(e) => setF({ ...f, minutos: e.target.value })} /></div>
            <div><label className="label">Isla</label>
              <select className="input" value={f.isla_id}
                      onChange={(e) => setF({ ...f, isla_id: e.target.value })}>
                <option value="">Sin asignar</option>
                {islas.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
              </select></div>
          </div>
          <div>
            <label className="label">Cómo llegó</label>
            <select className="input" value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value })}>
              <option value="telefono">Teléfono</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="presencial">Presencial</option>
              <option value="web">Web / redes</option>
            </select>
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={f.notas}
                      onChange={(e) => setF({ ...f, notas: e.target.value })} />
          </div>
          {err && <p className="text-xs px-2 py-1.5 rounded" style={{ background: '#fdecea', color: '#8a1f18' }}>{err}</p>}
        </div>
        <div className="p-4 border-t border-slate-100 flex gap-2 justify-end sticky bottom-0 bg-white">
          <button className="btn-soft text-sm" onClick={onCerrar}>Cancelar</button>
          <button className="btn-primary text-sm" disabled={guardando} onClick={guardar}>
            {guardando ? 'Agendando…' : 'Agendar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- WhatsApp --------------------------------- */

function PanelWhatsApp() {
  return (
    <div className="card p-5 max-w-2xl">
      <h3 className="font-semibold text-ink mb-1">Bandeja de WhatsApp</h3>
      <p className="text-sm text-slate-500 mb-3">
        Requiere una cuenta de WhatsApp Business API aprobada por Meta. La estructura está
        lista; falta la conexión.
      </p>
      <div className="rounded-lg p-3 text-sm" style={{ background: '#f1f5f9' }}>
        <p className="font-medium text-ink mb-1.5">Qué falta gestionar</p>
        <ol className="text-slate-600 space-y-1 list-decimal ml-4">
          <li>Verificar la empresa en Meta Business (1 a 3 semanas)</li>
          <li>Elegir proveedor: Meta Cloud API, Twilio o 360dialog</li>
          <li>Registrar un número que <strong>no esté en uso</strong> en la app normal de WhatsApp</li>
          <li>Aprobar las plantillas de mensajes salientes</li>
        </ol>
      </div>
      <p className="text-[11px] text-slate-400 mt-3">
        Mientras tanto, las citas que llegan por WhatsApp se registran con ese canal
        desde <strong>+ Agendar</strong>, para medir cuánto aporta ese medio.
      </p>
    </div>
  )
}
