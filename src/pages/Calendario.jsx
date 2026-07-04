import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { RESULTADOS, fmtFecha, fmtHora, colorAgenda, TIPOS_AGENDA, agendaLabel } from '../lib/helpers'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const ABIERTOS = ['pendiente', 'no_contesta', 'reagendar', 'compromiso']
const HORAS = Array.from({ length: 13 }, (_, i) => i + 8) // 08:00 a 20:00
const iso = (d) => d.toISOString().slice(0, 10)
const lunesDe = (d) => { const x = new Date(d); const off = (x.getDay() + 6) % 7; x.setDate(x.getDate() - off); x.setHours(0,0,0,0); return x }

export default function Calendario() {
  const navigate = useNavigate()
  const [citas, setCitas] = useState([])
  const [vista, setVista] = useState('mes')
  const [ref, setRef] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [semana, setSemana] = useState(() => lunesDe(new Date()))
  const [diaSel, setDiaSel] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data } = await supabase.from('actividades')
      .select('id,tipo,agenda_tipo,resultado,proxima_fecha,proxima_hora,cliente_id,clientes(nombre,apellidos,telefono)')
      .not('proxima_fecha', 'is', null)
      .order('proxima_fecha').order('proxima_hora').limit(2000)
    setCitas(data || [])
  }

  const hoy = iso(new Date())

  const porFecha = useMemo(() => {
    const g = {}
    citas.forEach((c) => { (g[c.proxima_fecha] ||= []).push(c) })
    return g
  }, [citas])

  const alertas = useMemo(() => {
    // Solo alertamos vencidas recientes (14 días): las más antiguas son
    // registros históricos importados, no seguimientos operativos vigentes.
    const lim = iso(new Date(Date.now() - 14 * 864e5))
    const v = [], h = []
    citas.forEach((c) => {
      if (!ABIERTOS.includes(c.resultado)) return
      if (c.proxima_fecha < hoy && c.proxima_fecha >= lim) v.push(c)
      else if (c.proxima_fecha === hoy) h.push(c)
    })
    return { vencidas: v, hoy: h }
  }, [citas, hoy])

  // ---- Mes ----------------------------------------------------------
  const grilla = useMemo(() => {
    const y = ref.getFullYear(), mo = ref.getMonth()
    const inicio = lunesDe(new Date(y, mo, 1))
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(inicio); d.setDate(inicio.getDate() + i); return d })
  }, [ref])

  const moverMes = (n) => setRef(new Date(ref.getFullYear(), ref.getMonth() + n, 1))
  const moverSemana = (n) => { const d = new Date(semana); d.setDate(d.getDate() + n * 7); setSemana(lunesDe(d)) }

  const diasSemana = useMemo(
    () => Array.from({ length: 7 }, (_, i) => { const d = new Date(semana); d.setDate(semana.getDate() + i); return d }),
    [semana]
  )

  const Leyenda = () => (
    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
      {Object.entries(TIPOS_AGENDA).map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: v.color }} />
          {v.label}
        </span>
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-ink">Calendario</h1>
          <p className="text-sm text-slate-500">Agendamientos, seguimientos y alertas</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          <button onClick={() => setVista('mes')}
                  className={`px-3 py-1.5 ${vista === 'mes' ? 'bg-deep text-white' : 'text-slate-500'}`}>Mes</button>
          <button onClick={() => setVista('semana')}
                  className={`px-3 py-1.5 ${vista === 'semana' ? 'bg-deep text-white' : 'text-slate-500'}`}>Semana</button>
        </div>
      </div>

      {/* Alertas */}
      {(alertas.vencidas.length > 0 || alertas.hoy.length > 0) && (
        <div className="grid md:grid-cols-2 gap-3">
          {alertas.vencidas.length > 0 && (
            <div className="card p-4 border-l-4 border-red-400">
              <div className="text-sm font-semibold text-red-600 mb-2">Vencidas ({alertas.vencidas.length})</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {alertas.vencidas.map((c) => (
                  <button key={c.id} onClick={() => navigate(`/clientes/${c.cliente_id}`)}
                          className="w-full flex items-center justify-between text-sm hover:bg-paper rounded px-2 py-1">
                    <span className="text-ink">{[c.clientes?.nombre, c.clientes?.apellidos].filter(Boolean).join(' ')}</span>
                    <span className="text-xs text-slate-400">{fmtFecha(c.proxima_fecha)}{c.proxima_hora ? ' ' + fmtHora(c.proxima_hora) : ''}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {alertas.hoy.length > 0 && (
            <div className="card p-4 border-l-4 border-amber-400">
              <div className="text-sm font-semibold text-amber-600 mb-2">Para hoy ({alertas.hoy.length})</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {alertas.hoy.map((c) => (
                  <button key={c.id} onClick={() => navigate(`/clientes/${c.cliente_id}`)}
                          className="w-full flex items-center justify-between text-sm hover:bg-paper rounded px-2 py-1">
                    <span className="text-ink">{[c.clientes?.nombre, c.clientes?.apellidos].filter(Boolean).join(' ')}</span>
                    <span className="text-xs text-slate-400">{c.proxima_hora ? fmtHora(c.proxima_hora) : agendaLabel(c.agenda_tipo)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- VISTA MES ---- */}
      {vista === 'mes' && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <button className="btn-soft text-sm py-1" onClick={() => moverMes(-1)}>←</button>
            <div className="font-semibold text-ink">{MESES[ref.getMonth()]} {ref.getFullYear()}</div>
            <button className="btn-soft text-sm py-1" onClick={() => moverMes(1)}>→</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-400">
            {DIAS.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grilla.map((d, i) => {
              const k = iso(d)
              const items = porFecha[k] || []
              const otroMes = d.getMonth() !== ref.getMonth()
              const esHoy = k === hoy
              return (
                <button key={i} onClick={() => setDiaSel(diaSel === k ? null : k)}
                        className={`min-h-[64px] rounded-lg border p-1 text-left align-top transition
                          ${otroMes ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200 hover:border-sky'}
                          ${esHoy ? 'ring-1 ring-deep' : ''} ${diaSel === k ? 'border-deep' : ''}`}>
                  <div className={`text-[11px] ${otroMes ? 'text-slate-300' : esHoy ? 'text-deep font-bold' : 'text-slate-500'}`}>
                    {d.getDate()}
                  </div>
                  {items.slice(0, 3).map((c) => (
                    <div key={c.id} className="mt-0.5 truncate rounded text-white text-[10px] px-1 py-0.5"
                         style={{ background: colorAgenda(c.agenda_tipo) }}>
                      {c.proxima_hora ? fmtHora(c.proxima_hora) + ' ' : ''}{[c.clientes?.nombre, c.clientes?.apellidos].filter(Boolean).join(' ')}
                    </div>
                  ))}
                  {items.length > 3 && <div className="text-[10px] text-slate-400 mt-0.5">+{items.length - 3} más</div>}
                </button>
              )
            })}
          </div>
          <Leyenda />
        </div>
      )}

      {/* ---- VISTA SEMANA ---- */}
      {vista === 'semana' && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <button className="btn-soft text-sm py-1" onClick={() => moverSemana(-1)}>←</button>
            <div className="font-semibold text-ink">
              {diasSemana[0].getDate()} {MESES[diasSemana[0].getMonth()].slice(0,3)} – {diasSemana[6].getDate()} {MESES[diasSemana[6].getMonth()].slice(0,3)} {diasSemana[6].getFullYear()}
            </div>
            <button className="btn-soft text-sm py-1" onClick={() => moverSemana(1)}>→</button>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              {/* Cabecera de días */}
              <div className="grid" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
                <div />
                {diasSemana.map((d, i) => {
                  const esHoy = iso(d) === hoy
                  return (
                    <div key={i} className={`text-center text-xs py-1 ${esHoy ? 'text-deep font-bold' : 'text-slate-500'}`}>
                      {DIAS[i]} {d.getDate()}
                    </div>
                  )
                })}
              </div>

              {/* Banda "sin hora" */}
              <div className="grid border-t border-slate-100" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
                <div className="text-[10px] text-slate-400 py-1 pr-1 text-right">Sin hora</div>
                {diasSemana.map((d, i) => {
                  const items = (porFecha[iso(d)] || []).filter((c) => !c.proxima_hora)
                  return (
                    <div key={i} className="border-l border-slate-100 p-0.5 space-y-0.5 min-h-[28px]">
                      {items.map((c) => <Evento key={c.id} c={c} navigate={navigate} />)}
                    </div>
                  )
                })}
              </div>

              {/* Filas por hora */}
              {HORAS.map((h) => (
                <div key={h} className="grid border-t border-slate-100" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
                  <div className="text-[10px] text-slate-400 py-1 pr-1 text-right">{('0'+h).slice(-2)}:00</div>
                  {diasSemana.map((d, i) => {
                    const items = (porFecha[iso(d)] || []).filter((c) => c.proxima_hora && parseInt(c.proxima_hora.slice(0,2), 10) === h)
                    return (
                      <div key={i} className="border-l border-slate-100 p-0.5 space-y-0.5 min-h-[34px]">
                        {items.map((c) => <Evento key={c.id} c={c} navigate={navigate} />)}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          <Leyenda />
        </div>
      )}

      {/* Detalle del día (vista mes) */}
      {vista === 'mes' && diaSel && (
        <div className="card p-4">
          <div className="text-sm font-semibold text-deep mb-2 capitalize">{fmtFecha(diaSel)}</div>
          {(porFecha[diaSel] || []).length ? (
            <div className="divide-y divide-slate-100">
              {(porFecha[diaSel] || []).map((c) => (
                <div key={c.id} className="flex items-center justify-between px-1 py-2 hover:bg-paper cursor-pointer"
                     onClick={() => navigate(`/clientes/${c.cliente_id}`)}>
                  <div className="flex items-center gap-3">
                    <span className="w-1.5 h-8 rounded" style={{ background: colorAgenda(c.agenda_tipo) }} />
                    <span className="text-sm font-mono text-slate-400 w-12">{c.proxima_hora ? fmtHora(c.proxima_hora) : '—'}</span>
                    <div>
                      <div className="text-sm font-medium text-ink">{[c.clientes?.nombre, c.clientes?.apellidos].filter(Boolean).join(' ')}</div>
                      <div className="text-xs text-slate-400">{agendaLabel(c.agenda_tipo)} · {RESULTADOS[c.resultado]}</div>
                    </div>
                  </div>
                  {c.clientes?.telefono && <span className="text-xs text-slate-400">{c.clientes.telefono}</span>}
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400">Sin actividades este día.</p>}
        </div>
      )}
    </div>
  )
}

function Evento({ c, navigate }) {
  return (
    <button onClick={() => navigate(`/clientes/${c.cliente_id}`)}
            className="w-full text-left truncate rounded text-white text-[10px] px-1 py-0.5"
            style={{ background: colorAgenda(c.agenda_tipo) }}
            title={`${[c.clientes?.nombre, c.clientes?.apellidos].filter(Boolean).join(' ')} · ${agendaLabel(c.agenda_tipo)}`}>
      {c.proxima_hora ? fmtHora(c.proxima_hora) + ' ' : ''}{[c.clientes?.nombre, c.clientes?.apellidos].filter(Boolean).join(' ')}
    </button>
  )
}
