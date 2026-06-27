import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { TIPOS_ACTIVIDAD, RESULTADOS, fmtFecha } from '../lib/helpers'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const ABIERTOS = ['pendiente', 'no_contesta', 'reagendar', 'compromiso']
const iso = (d) => d.toISOString().slice(0, 10)

export default function Calendario() {
  const navigate = useNavigate()
  const [citas, setCitas] = useState([])
  const [ref, setRef] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [diaSel, setDiaSel] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data } = await supabase.from('actividades')
      .select('id,tipo,resultado,proxima_fecha,hora,cliente_id,clientes(nombre,telefono)')
      .not('proxima_fecha', 'is', null)
      .order('proxima_fecha').order('hora').limit(2000)
    setCitas(data || [])
  }

  const hoy = iso(new Date())

  // Agrupa por fecha
  const porFecha = useMemo(() => {
    const g = {}
    citas.forEach((c) => { (g[c.proxima_fecha] ||= []).push(c) })
    return g
  }, [citas])

  // Alertas: vencidas (antes de hoy) y de hoy, aún abiertas
  const alertas = useMemo(() => {
    const v = [], h = []
    citas.forEach((c) => {
      if (!ABIERTOS.includes(c.resultado)) return
      if (c.proxima_fecha < hoy) v.push(c)
      else if (c.proxima_fecha === hoy) h.push(c)
    })
    return { vencidas: v, hoy: h }
  }, [citas, hoy])

  // Construye la grilla del mes (lunes primero)
  const grilla = useMemo(() => {
    const y = ref.getFullYear(), mo = ref.getMonth()
    const primero = new Date(y, mo, 1)
    const offset = (primero.getDay() + 6) % 7 // lunes=0
    const inicio = new Date(y, mo, 1 - offset)
    const celdas = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio); d.setDate(inicio.getDate() + i)
      celdas.push(d)
    }
    return celdas
  }, [ref])

  const mover = (n) => setRef(new Date(ref.getFullYear(), ref.getMonth() + n, 1))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-ink">Calendario</h1>
          <p className="text-sm text-slate-500">Agendamientos, seguimientos y alertas</p>
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
                    <span className="text-ink">{c.clientes?.nombre}</span>
                    <span className="text-xs text-slate-400">{fmtFecha(c.proxima_fecha)}</span>
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
                    <span className="text-ink">{c.clientes?.nombre}</span>
                    <span className="text-xs text-slate-400">{c.hora ? c.hora.slice(0,5) : TIPOS_ACTIVIDAD[c.tipo]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Calendario mensual */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <button className="btn-soft text-sm py-1" onClick={() => mover(-1)}>←</button>
          <div className="font-semibold text-ink">{MESES[ref.getMonth()]} {ref.getFullYear()}</div>
          <button className="btn-soft text-sm py-1" onClick={() => mover(1)}>→</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-400 mb-1">
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
                {items.slice(0, 2).map((c) => (
                  <div key={c.id} className="mt-0.5 truncate rounded bg-sky/15 text-deep text-[10px] px-1 py-0.5">
                    {c.hora ? c.hora.slice(0,5) + ' ' : ''}{c.clientes?.nombre}
                  </div>
                ))}
                {items.length > 2 && <div className="text-[10px] text-slate-400 mt-0.5">+{items.length - 2} más</div>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Detalle del día seleccionado */}
      {diaSel && (
        <div className="card p-4">
          <div className="text-sm font-semibold text-deep mb-2 capitalize">{fmtFecha(diaSel)}</div>
          {(porFecha[diaSel] || []).length ? (
            <div className="divide-y divide-slate-100">
              {(porFecha[diaSel] || []).map((c) => (
                <div key={c.id} className="flex items-center justify-between px-1 py-2 hover:bg-paper cursor-pointer"
                     onClick={() => navigate(`/clientes/${c.cliente_id}`)}>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-slate-400 w-12">{c.hora ? c.hora.slice(0,5) : '—'}</span>
                    <div>
                      <div className="text-sm font-medium text-ink">{c.clientes?.nombre}</div>
                      <div className="text-xs text-slate-400">{TIPOS_ACTIVIDAD[c.tipo]} · {RESULTADOS[c.resultado]}</div>
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
