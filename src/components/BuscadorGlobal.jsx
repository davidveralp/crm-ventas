import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatPatente, patenteLimpia } from '../lib/helpers'

/* ============================================================================
   Buscador global · vehículos y clientes
   ----------------------------------------------------------------------------
   Pensado para el celular: es la acción que más se repite cuando alguien llama
   preguntando por su auto y hay que encontrarlo rápido.

   Busca en las dos entidades a la vez porque en el mostrador nadie piensa "voy
   a la sección clientes": piensa "PPU GRWW76" o "Hans Duarte", y espera que
   aparezca lo que sea que coincida.
   ========================================================================== */

export default function BuscadorGlobal({ abierto, onCerrar }) {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [vehiculos, setVehiculos] = useState([])
  const [clientes, setClientes] = useState([])
  const [buscando, setBuscando] = useState(false)
  const inputRef = useRef(null)
  const tRef = useRef(null)

  useEffect(() => {
    if (abierto) setTimeout(() => inputRef.current?.focus(), 80)
    else { setQ(''); setVehiculos([]); setClientes([]) }
  }, [abierto])

  // Cerrar con Escape, útil cuando se usa con teclado en escritorio
  useEffect(() => {
    if (!abierto) return
    const h = (e) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [abierto, onCerrar])

  useEffect(() => {
    clearTimeout(tRef.current)
    const t = q.trim()
    if (t.length < 2) { setVehiculos([]); setClientes([]); return }
    // Espera breve: evita una consulta por cada tecla
    tRef.current = setTimeout(() => buscar(t), 280)
    return () => clearTimeout(tRef.current)
  }, [q])

  async function buscar(t) {
    setBuscando(true)
    const pn = patenteLimpia(t)
    const like = `%${t}%`
    const [v, c] = await Promise.all([
      supabase.from('vehiculos')
        .select('id,patente,marca,modelo,anio,cliente_id,clientes(nombre,apellidos)')
        .or(`patente_norm.ilike.%${pn}%,marca.ilike.${like},modelo.ilike.${like}`)
        .limit(8),
      supabase.from('clientes')
        .select('id,nombre,apellidos,telefono,rut')
        .or(`nombre.ilike.${like},apellidos.ilike.${like},telefono.ilike.${like},rut.ilike.${like}`)
        .limit(8)
    ])
    setVehiculos(v.data || []); setClientes(c.data || [])
    setBuscando(false)
  }

  function ir(ruta) { onCerrar(); nav(ruta) }

  if (!abierto) return null

  const sinResultados = q.trim().length >= 2 && !buscando && !vehiculos.length && !clientes.length

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200">
        <input
          ref={inputRef} className="input flex-1" value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Patente, marca, cliente, teléfono o RUT…"
          autoComplete="off" />
        <button type="button" onClick={onCerrar} className="btn-soft text-sm shrink-0">Cerrar</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {q.trim().length < 2 && (
          <p className="text-sm text-slate-400 text-center pt-8">
            Escribe al menos dos caracteres.<br />
            <span className="text-xs">Busca en vehículos y clientes al mismo tiempo.</span>
          </p>
        )}

        {buscando && <p className="text-sm text-slate-400">Buscando…</p>}

        {sinResultados && (
          <div className="text-center pt-8">
            <p className="text-sm text-slate-500">Sin coincidencias para «{q.trim()}».</p>
            <button className="btn-soft text-sm mt-3" onClick={() => ir('/nuevo-cliente')}>
              Registrar como cliente nuevo
            </button>
          </div>
        )}

        {vehiculos.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase mb-1.5">
              Vehículos ({vehiculos.length})
            </p>
            <div className="space-y-1.5">
              {vehiculos.map((v) => (
                <button key={v.id} onClick={() => ir(`/vehiculos/${v.id}`)}
                  className="card p-3 w-full text-left active:bg-slate-50">
                  <div className="font-semibold text-ink">
                    {v.patente ? formatPatente(v.patente) : 'Sin patente'}
                  </div>
                  <div className="text-sm text-slate-600 truncate">
                    {[v.marca, v.modelo, v.anio].filter(Boolean).join(' ') || '—'}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {v.clientes ? `${v.clientes.nombre || ''} ${v.clientes.apellidos || ''}`.trim() : 'Sin cliente'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {clientes.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase mb-1.5">
              Clientes ({clientes.length})
            </p>
            <div className="space-y-1.5">
              {clientes.map((c) => (
                <button key={c.id} onClick={() => ir(`/clientes/${c.id}`)}
                  className="card p-3 w-full text-left active:bg-slate-50">
                  <div className="font-semibold text-ink truncate">
                    {`${c.nombre || ''} ${c.apellidos || ''}`.trim() || '(sin nombre)'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {[c.telefono, c.rut].filter(Boolean).join(' · ') || 'Sin contacto'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
