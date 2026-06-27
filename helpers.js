import { useState, useEffect } from 'react'
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
