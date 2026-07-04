import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Pill, StatCard, EmptyState } from '../components/UI'
import { fmtCLP, fmtFecha, ESTADOS_PRESUPUESTO, ESTADOS_PRESUP_TALLER, SECCIONES_PRESUP, seccionDe } from '../lib/helpers'

export default function Presupuestos() {
  const navigate = useNavigate()
  const [lista, setLista] = useState([])
  const [filtro, setFiltro] = useState('')
  const [vista, setVista] = useState('comercial') // comercial | taller
  const [pTaller, setPTaller] = useState([])
  const [detalle, setDetalle] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data }, { data: pt }] = await Promise.all([
      supabase.from('presupuestos')
        .select('*, clientes(nombre,apellidos)')
        .order('proxima_gestion', { ascending: true, nullsFirst: false }),
      supabase.from('presupuestos_taller')
        .select('*, trabajos_taller(titulo, servicio_solicitado, clientes(nombre,apellidos))')
        .order('creado_en', { ascending: false })
    ])
    setLista(data || []); setPTaller(pt || [])
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
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Presupuestos</h1>
          <p className="text-sm text-slate-500">{vista === 'taller' ? 'Solicitados desde el taller · repuestos y consumibles' : 'Seguimiento de cotizaciones · ordenados por próxima gestión'}</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          <button onClick={() => setVista('comercial')} className={`px-3 py-1.5 ${vista === 'comercial' ? 'bg-deep text-white' : 'text-slate-500'}`}>Comerciales</button>
          <button onClick={() => setVista('taller')} className={`px-3 py-1.5 ${vista === 'taller' ? 'bg-deep text-white' : 'text-slate-500'}`}>Taller ({pTaller.length})</button>
        </div>
      </div>

      {vista === 'taller' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper text-slate-400 text-xs">
              <tr>
                <th className="text-left font-medium px-4 py-3">Vehículo / Cliente</th>
                <th className="text-left font-medium px-2 py-3 hidden md:table-cell">Servicio</th>
                <th className="text-left font-medium px-2 py-3">Estado</th>
                <th className="text-right font-medium px-2 py-3">Monto</th>
                <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {pTaller.map((p) => (
                <tr key={p.id} onClick={() => setDetalle(p)} className="border-t border-slate-100 hover:bg-paper cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink uppercase text-[13px]">{p.trabajos_taller?.titulo || '—'}</div>
                    <div className="text-xs text-slate-400">{p.trabajos_taller?.clientes?.nombre}</div>
                  </td>
                  <td className="px-2 py-3 hidden md:table-cell text-slate-500 text-xs">{p.trabajos_taller?.servicio_solicitado || '—'}</td>
                  <td className="px-2 py-3"><Pill color={ESTADOS_PRESUP_TALLER[p.estado]?.color}>{ESTADOS_PRESUP_TALLER[p.estado]?.label || p.estado}</Pill></td>
                  <td className="px-2 py-3 text-right font-semibold text-ink">{fmtCLP(p.monto || 0)}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-slate-500 text-xs">{fmtFecha(p.creado_en)}</td>
                </tr>
              ))}
              {!pTaller.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">Aún no hay presupuestos solicitados desde el taller.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40" onClick={() => setDetalle(null)}>
          <div className="card w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-ink text-sm uppercase">{detalle.trabajos_taller?.titulo}</h3>
              <button onClick={() => setDetalle(null)} className="text-slate-400 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Pill color={ESTADOS_PRESUP_TALLER[detalle.estado]?.color}>{ESTADOS_PRESUP_TALLER[detalle.estado]?.label}</Pill>
                <span className="text-xs text-slate-400">{fmtFecha(detalle.creado_en)}</span>
                <span className="ml-auto font-bold text-ink">{fmtCLP(detalle.monto || 0)}</span>
              </div>
              {detalle.notas && <p className="text-sm text-slate-500">📝 {detalle.notas}</p>}
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Detalle de ítems</div>
                {(detalle.items || []).length ? (
                  <table className="w-full text-xs">
                    <thead><tr className="text-slate-400 border-b"><th className="text-left py-1">Cód.</th><th className="text-left">Descripción</th><th className="text-right">Cant.</th><th className="text-right">Monto</th><th className="text-right">Stock</th></tr></thead>
                    <tbody>
                      {detalle.items.map((x, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1.5 font-mono text-slate-500">{x.codigo || '—'}</td>
                          <td className="py-1.5"><span className="text-slate-400">{SECCIONES_PRESUP[seccionDe(x.tipo)]}:</span> {x.detalle || '—'}</td>
                          <td className="text-right">{x.cant}</td>
                          <td className="text-right">{x.en_stock ? '—' : fmtCLP((+x.precio || 0) * (+x.cant || 1))}</td>
                          <td className="text-right">{x.en_stock ? '✓ Bodega' : 'Cotizar'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="text-sm text-slate-400">Sin ítems detallados aún.</p>}
              </div>
              {detalle.resuelto_en && <p className="text-[11px] text-slate-400">Resuelto el {fmtFecha(detalle.resuelto_en)}</p>}
            </div>
          </div>
        </div>
      )}

      {vista === 'comercial' && (<>

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
                    <td className="px-4 py-3 font-medium text-ink">{[p.clientes?.nombre, p.clientes?.apellidos].filter(Boolean).join(' ')}</td>
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
      </>)}
    </div>
  )
}
