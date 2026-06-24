import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtCLP } from '../lib/helpers'

export default function Pipeline() {
  const navigate = useNavigate()
  const [estados, setEstados] = useState([])
  const [clientes, setClientes] = useState([])
  const [arrastrado, setArrastrado] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: e }, { data: c }] = await Promise.all([
      supabase.from('pipeline_estados').select('*').order('orden'),
      supabase.from('clientes').select('id,nombre,facturacion_total,estado_id,segmento')
    ])
    setEstados(e || []); setClientes(c || [])
  }

  async function soltar(estado_id) {
    if (!arrastrado) return
    setClientes((prev) => prev.map((c) =>
      c.id === arrastrado ? { ...c, estado_id } : c))
    await supabase.from('clientes').update({ estado_id }).eq('id', arrastrado)
    setArrastrado(null)
  }

  const sinEstado = clientes.filter((c) => !c.estado_id)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink">Pipeline</h1>
        <p className="text-sm text-slate-500">Arrastra las tarjetas para cambiar de etapa</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {sinEstado.length > 0 && (
          <Columna titulo="Sin clasificar" color="#94a3b8"
                   clientes={sinEstado} onDragStart={setArrastrado}
                   onDrop={() => soltar(null)} navigate={navigate} />
        )}
        {estados.map((e) => (
          <Columna key={e.id} titulo={e.nombre} color={e.color}
                   clientes={clientes.filter((c) => c.estado_id === e.id)}
                   onDragStart={setArrastrado} onDrop={() => soltar(e.id)}
                   navigate={navigate} />
        ))}
      </div>
    </div>
  )
}

function Columna({ titulo, color, clientes, onDragStart, onDrop, navigate }) {
  const total = clientes.reduce((a, c) => a + Number(c.facturacion_total || 0), 0)
  return (
    <div className="w-72 shrink-0"
         onDragOver={(e) => e.preventDefault()}
         onDrop={onDrop}>
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          <span className="text-sm font-semibold text-ink">{titulo}</span>
          <span className="text-xs text-slate-400">{clientes.length}</span>
        </div>
      </div>
      <div className="text-[11px] text-slate-400 px-1 mb-2">{fmtCLP(total)}</div>
      <div className="space-y-2 min-h-[120px] bg-paper rounded-xl p-2">
        {clientes.map((c) => (
          <div key={c.id} draggable
               onDragStart={() => onDragStart(c.id)}
               onClick={() => navigate(`/clientes/${c.id}`)}
               className="card p-3 cursor-grab active:cursor-grabbing hover:border-sky">
            <div className="text-sm font-medium text-ink truncate">{c.nombre}</div>
            <div className="text-xs text-slate-400 mt-0.5">{fmtCLP(c.facturacion_total)}</div>
          </div>
        ))}
        {clientes.length === 0 && (
          <div className="text-center text-xs text-slate-300 py-6">Vacío</div>
        )}
      </div>
    </div>
  )
}
