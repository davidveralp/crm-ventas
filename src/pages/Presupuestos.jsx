import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Pill, StatCard, EmptyState } from '../components/UI'
import { fmtCLP, fmtFecha, ESTADOS_PRESUPUESTO, ESTADOS_PRESUP_TALLER, SECCIONES_PRESUP, seccionDe } from '../lib/helpers'
import { useAuth } from '../context/AuthContext'
import { notificar } from '../lib/notificar'
import PresupuestoTallerCard from '../components/PresupuestoTallerCard'

const SEV = {
  critico:    { label: 'Crítico',    color: '#E0382B' },
  pronto:     { label: 'Pronto',     color: '#C98A1B' },
  preventivo: { label: 'Preventivo', color: '#2f6fb0' },
  ok:         { label: 'OK',         color: '#1f9d57' }
}

function PresupuestosInterno() {

  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [lista, setLista] = useState([])
  const [filtro, setFiltro] = useState('')
  const [filtroT, setFiltroT] = useState('')
  const [vista, setVista] = useState('comercial') // comercial | taller
  const [pTaller, setPTaller] = useState([])
  const [diags, setDiags] = useState([])
  const [tareas, setTareas] = useState([])
  const [detalle, setDetalle] = useState(null)
  // v23: el presupuesto de taller lo ELABORA el encargado de presupuestos
  // desde este módulo (no desde el taller).
  const esCompras = ['coordinador_adquisiciones', 'admin'].includes(perfil?.rol)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data }, { data: pt }] = await Promise.all([
      supabase.from('presupuestos')
        .select('*, clientes(nombre,apellidos)')
        .order('proxima_gestion', { ascending: true, nullsFirst: false }),
      supabase.from('presupuestos_taller')
        .select('*, trabajos_taller(id, titulo, servicio_solicitado, observaciones_cliente, estado, vehiculo_id, asesor_id, respaldo_ot_firmada, respaldo_video, historial, vehiculos(patente,marca,modelo,tipo_vehiculo), clientes(nombre,apellidos))')
        .order('creado_en', { ascending: false })
    ])
    // v24: vehículo de las cotizaciones rápidas (sin trabajo de taller)
    const vidsRap = [...new Set((pt || []).filter((p) => !p.trabajo_id && p.vehiculo_id).map((p) => p.vehiculo_id))]
    let vehMap = {}
    if (vidsRap.length) {
      const { data: vs } = await supabase.from('vehiculos').select('id,patente,marca,modelo,tipo_vehiculo').in('id', vidsRap)
      vehMap = Object.fromEntries((vs || []).map((v) => [v.id, v]))
    }
    setLista(data || []); setPTaller((pt || []).map((p) => ({ ...p, veh: vehMap[p.vehiculo_id] || null })))
    const tids = [...new Set((pt || []).map((p) => p.trabajo_id).filter(Boolean))]
    if (tids.length) {
      const [{ data: dg }, { data: ts }] = await Promise.all([
        supabase.from('diagnosticos_taller').select('*').in('trabajo_id', tids),
        supabase.from('tareas_taller').select('trabajo_id,titulo,estado,observacion').in('trabajo_id', tids)
      ])
      setDiags(dg || []); setTareas(ts || [])
    } else { setDiags([]); setTareas([]) }
  }

  async function guardarPresup(p, campos, aviso) {
    await supabase.from('presupuestos_taller').update(campos).eq('id', p.id)
    if (aviso) notificar({ empresa_id: perfil.empresa_id, ...aviso })
    cargar()
  }
  const tituloDe = (t) => t?.titulo || [t?.vehiculos?.patente, t?.vehiculos?.marca, t?.vehiculos?.modelo].filter(Boolean).join(' ') || 'Trabajo de taller'

  // Aprobado → el encargado gestiona la compra: el vehículo queda en el
  // taller "a la espera de repuestos" y se informa a los responsables.
  async function gestionarCompra(p) {
    if (!confirm('¿Marcar la compra como gestionada? El trabajo pasará a "Compra de repuestos" (a la espera de repuestos) y se notificará al taller y al asesor.')) return
    await supabase.from('presupuestos_taller').update({
      compra_gestionada_en: new Date().toISOString(), compra_por: perfil.id
    }).eq('id', p.id)
    const t = p.trabajos_taller
    if (t?.id) {
      const historial = [...(t.historial || []), { estado: 'compra_repuestos', fecha: new Date().toISOString(), por: perfil?.nombre }]
      await supabase.from('trabajos_taller').update({ estado: 'compra_repuestos', historial }).eq('id', t.id)
      notificar({ empresa_id: perfil.empresa_id, rol: 'jefe_taller', titulo: 'Compra gestionada · vehículo a la espera de repuestos', cuerpo: tituloDe(t), url: '/taller' })
      if (t.asesor_id) notificar({ empresa_id: perfil.empresa_id, usuario_id: t.asesor_id, titulo: 'Compra de repuestos gestionada', cuerpo: tituloDe(t), url: '/taller' })
    }
    cargar()
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
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <button className={`pill border ${!filtroT ? 'bg-deep text-white' : 'text-slate-600'}`}
                    style={{ borderColor: '#e2e8f0' }} onClick={() => setFiltroT('')}>Todos</button>
            {Object.entries(ESTADOS_PRESUP_TALLER).map(([k, v]) => (
              <button key={k} className="pill border" onClick={() => setFiltroT(k)}
                      style={filtroT === k ? { background: v.color, borderColor: v.color, color: '#fff' }
                                           : { borderColor: '#e2e8f0', color: '#475569' }}>{v.label}</button>
            ))}
          </div>
          {!esCompras && <p className="text-[11px] text-slate-400">Vista de consulta: la elaboración de presupuestos corresponde al encargado de presupuestos (coordinador de adquisiciones) o administración.</p>}
          {pTaller.filter((p) => !filtroT || p.estado === filtroT).map((p) => {
            const t = p.trabajos_taller
            const dg = diags.filter((d) => d.trabajo_id === p.trabajo_id)
            const ts = tareas.filter((x) => x.trabajo_id === p.trabajo_id)
            return (
              <div key={p.id} className="card p-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-ink uppercase text-sm">{t ? tituloDe(t) : [p.veh?.patente, p.veh?.marca, p.veh?.modelo].filter(Boolean).join(' ') || 'Cotización'}</span>
                  <span className="text-xs text-slate-400">{[t?.clientes?.nombre, t?.clientes?.apellidos].filter(Boolean).join(' ')}</span>
                  {p.origen === 'rapida' && <Pill color="#7A5C8E">Cotización rápida</Pill>}
                  {(t?.vehiculos?.tipo_vehiculo || p.veh?.tipo_vehiculo) && <span className="text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">{t?.vehiculos?.tipo_vehiculo || p.veh?.tipo_vehiculo}</span>}
                  <span className="ml-auto" />
                  {['aprobado', 'parcial'].includes(p.estado) && !p.compra_gestionada_en && esCompras && (
                    <button className="btn-primary text-xs" onClick={() => gestionarCompra(p)}>🛒 Compra gestionada → espera de repuestos</button>
                  )}
                  {p.compra_gestionada_en && <span className="text-[11px] text-green-600">✓ Compra gestionada el {fmtFecha(p.compra_gestionada_en)}</span>}
                </div>
                {t && (
                  <div className="rounded-lg bg-paper p-3 text-xs text-slate-600 space-y-1.5">
                    {t.servicio_solicitado && <div><b>Servicio solicitado:</b> {t.servicio_solicitado}</div>}
                    {t.observaciones_cliente && <div><b>Observaciones del cliente:</b> {t.observaciones_cliente}</div>}
                    {dg.length > 0 && (
                      <div><b>Diagnóstico técnico:</b>
                        <ul className="mt-1 space-y-0.5">
                          {dg.map((d) => (
                            <li key={d.id} className="flex items-start gap-1.5">
                              <Pill color={SEV[d.severidad]?.color}>{SEV[d.severidad]?.label || d.severidad}</Pill>
                              <span>{d.hallazgo}{d.recomendacion ? ` — ${d.recomendacion}` : ''}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {ts.length > 0 && <div><b>Tareas ({ts.length}):</b> {ts.map((x) => x.titulo).join(' · ')}</div>}
                  </div>
                )}
                <PresupuestoTallerCard p={p} t={t ? { ...t, vehiculos: t.vehiculos } : null}
                  esJefe={false} esCompras={esCompras} perfil={perfil}
                  guardar={guardarPresup} tituloDe={tituloDe} margenes={{}} editable={esCompras} />
              </div>
            )
          })}
          {!pTaller.filter((p) => !filtroT || p.estado === filtroT).length &&
            <div className="card p-8 text-center text-sm text-slate-400">Sin presupuestos {filtroT ? 'en este estado' : 'de taller aún'}.</div>}
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


// v25: módulo en fase preliminar — no disponible para asesores (vendedor).
// Wrapper para respetar las reglas de hooks (sin retornos tempranos dentro
// del componente principal).
export default function Presupuestos() {
  const { perfil } = useAuth()
  if (['vendedor', 'asesor_toyota', 'asesor_multimarca'].includes(perfil?.rol)) return (
    <div className="card p-8 max-w-lg text-sm text-slate-500">
      El módulo Presupuestos está en fase preliminar y aún no está disponible para asesores.
      Los presupuestos que te correspondan llegan directo a la ficha de cada cliente.
    </div>
  )
  return <PresupuestosInterno />
}
