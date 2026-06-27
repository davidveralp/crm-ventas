import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Pill, StatCard, EmptyState } from '../components/UI'
import { fmtCLP, fmtFecha, ESTADOS_PRESUPUESTO } from '../lib/helpers'

export default function Presupuestos() {
  const navigate = useNavigate()
  const [lista, setLista] = useState([])
  const [filtro, setFiltro] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data } = await supabase.from('presupuestos')
      .select('*, clientes(nombre)')
      .order('proxima_gestion', { ascending: true, nullsFirst: false })
    setLista(data || [])
  }

  const filtrada = useMemo(() =>
    lista.filter((p) => !filtro || p.estado === filtro), [lista, filtro])

  const m = useMemo(() => {
    const abiertos = lista.filter((p) => ['enviado', 'en_seguimiento'].includes(p.estado))
    const aprobados = lista.filter((p) => p.estado === 'aprobado')
    return {
      enJuego: abiertos.reduce((a, p) => a + Number(p.monto || 0), 0),
      ganado: aprobados.reduce((a, p) => a + Number(p.monto || 0), 0),
      abiertos: abiertos.length
    }
  }, [lista])

  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink">Presupuestos</h1>
        <p className="text-sm text-slate-500">Seguimiento de cotizaciones · ordenados por próxima gestión</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard titulo="En juego (abiertos)" valor={fmtCLP(m.enJuego)} sub={`${m.abiertos} presupuestos`} />
        <StatCard titulo="Aprobado" valor={fmtCLP(m.ganado)} />
        <StatCard titulo="Total" valor={lista.length} />
      </div>

      <div className="flex gap-2 flex-wrap">
        <button className={`pill border ${!filtro ? 'bg-deep text-white' : 'text-slate-600'}`}
                style={{ borderColor: '#e2e8f0' }} onClick={() => setFiltro('')}>Todos</button>
        {Object.entries(ESTADOS_PRESUPUESTO).map(([k, v]) => (
          <button key={k} className="pill border" onClick={() => setFiltro(k)}
                  style={filtro === k
                    ? { background: v.color, borderColor: v.color, color: '#fff' }
                    : { borderColor: '#e2e8f0', color: '#475569' }}>
            {v.label}
          </button>
        ))}
      </div>

      {filtrada.length === 0 ? (
        <EmptyState titulo="Sin presupuestos"
                    mensaje="Crea presupuestos desde la ficha de cada cliente para darles seguimiento aquí." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left font-medium px-4 py-3">Cliente</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Descripción</th>
                <th className="text-right font-medium px-4 py-3">Monto</th>
                <th className="text-left font-medium px-4 py-3">Estado</th>
                <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Próx. gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrada.map((p) => {
                const vencido = p.proxima_gestion && p.proxima_gestion < hoy &&
                                ['enviado', 'en_seguimiento'].includes(p.estado)
                return (
                  <tr key={p.id} className="hover:bg-paper cursor-pointer"
                      onClick={() => navigate(`/clientes/${p.cliente_id}`)}>
                    <td className="px-4 py-3 font-medium text-ink">{p.clientes?.nombre}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-500 max-w-xs truncate">
                      {p.descripcion || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{fmtCLP(p.monto)}</td>
                    <td className="px-4 py-3">
                      <Pill color={ESTADOS_PRESUPUESTO[p.estado]?.color}>
                        {ESTADOS_PRESUPUESTO[p.estado]?.label}
                      </Pill>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={vencido ? 'text-red-600 font-medium' : 'text-slate-500'}>
                        {fmtFecha(p.proxima_gestion)}{vencido ? ' ⚠' : ''}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
