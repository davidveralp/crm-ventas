import { useState, useEffect, useRef } from 'react'
import { MARCAS_VEHICULO } from '../lib/helpers'

export function Pill({ children, color }) {
  return (
    <span className="pill" style={{ background: `${color}1A`, color }}>
      {children}
    </span>
  )
}

export function StatCard({ titulo, valor, sub }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-slate-500">{titulo}</div>
      <div className="text-2xl font-bold text-ink mt-1">{valor}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export function EmptyState({ titulo, mensaje, accion }) {
  return (
    <div className="card p-10 text-center">
      <p className="text-slate-700 font-medium">{titulo}</p>
      {mensaje && <p className="text-slate-500 text-sm mt-1">{mensaje}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  )
}

export function Modal({ abierto, onClose, titulo, children, ancho = 'max-w-lg' }) {
  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
         onClick={onClose}>
      <div className={`card w-full ${ancho} max-h-[90vh] overflow-y-auto`}
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-ink">{titulo}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// Selector de marca con catálogo + opción "Otra…" (texto libre)
export function SelectMarca({ value, onChange }) {
  const enLista = (v) => MARCAS_VEHICULO.includes(v)
  const [otra, setOtra] = useState(false)
  useEffect(() => { if (value && !enLista(value)) setOtra(true) }, [value])
  const selVal = otra ? '__OTRA__' : (enLista(value) ? value : '')
  return (
    <>
      <select className="input" value={selVal}
              onChange={(e) => {
                if (e.target.value === '__OTRA__') { setOtra(true); onChange('') }
                else { setOtra(false); onChange(e.target.value) }
              }}>
        <option value="">— Selecciona —</option>
        {MARCAS_VEHICULO.map((m) => <option key={m} value={m}>{m}</option>)}
        <option value="__OTRA__">Otra…</option>
      </select>
      {otra && (
        <input className="input mt-2" placeholder="Escribe la marca"
               value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} />
      )}
    </>
  )
}

// Selector de hora moderno: escribible + lista de intervalos de 15 min
const SLOTS = (() => {
  const out = []
  for (let h = 6; h <= 21; h++) for (const m of [0, 15, 30, 45]) {
    out.push(`${('0'+h).slice(-2)}:${('0'+m).slice(-2)}`)
  }
  return out
})()

export function TimePicker({ value, onChange, placeholder = 'HH:mm' }) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState(value || '')
  const cont = useRef(null)
  const listaRef = useRef(null)

  useEffect(() => { setTexto(value || '') }, [value])
  useEffect(() => {
    const fuera = (e) => { if (cont.current && !cont.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [])

  const valido = (s) => /^([01]?\d|2[0-3]):([0-5]\d)$/.test(s)
  const commit = (s) => {
    let v = s.trim()
    const m = v.match(/^(\d{1,2}):(\d{1,2})$/)
    if (m) v = `${('0'+m[1]).slice(-2)}:${('0'+m[2]).slice(-2)}`
    if (valido(v)) { onChange(v); setTexto(v) } else if (v === '') { onChange('') }
  }

  const visibles = texto && !valido(texto)
    ? SLOTS.filter((s) => s.startsWith(texto.replace(/[^0-9:]/g, '')))
    : SLOTS

  return (
    <div className="relative" ref={cont}>
      <div className="relative">
        <input
          className="input pr-8"
          value={texto}
          placeholder={placeholder}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => setAbierto(true)}
          onBlur={() => commit(texto)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(texto); setAbierto(false) } }}
        />
        <button type="button" tabIndex={-1}
                onClick={() => setAbierto((a) => !a)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-deep">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {abierto && (
        <div ref={listaRef}
             className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {visibles.length ? visibles.map((s) => (
            <button key={s} type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { onChange(s); setTexto(s); setAbierto(false) }}
                    className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-paper ${s === value ? 'bg-deep text-white hover:bg-deep' : 'text-ink'}`}>
              {s}
            </button>
          )) : <div className="px-3 py-2 text-xs text-slate-400">Escribe una hora válida (HH:mm)</div>}
        </div>
      )}
    </div>
  )
}
