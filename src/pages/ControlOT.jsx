import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Pill } from '../components/UI'

const MOTIVOS = {
  en_taller: { label: 'Vehículo en taller', color: '#2f6fb0' },
  pendiente_ingreso: { label: 'Pendiente de ingreso', color: '#C98A1B' },
  otro: { label: 'Otro motivo', color: '#7A5C8E' }
}

/* Carga gviz por JSONP (hoja pública) */
function loadSheet(sheetId, gid) {
  return new Promise((resolve, reject) => {
    const cb = 'gviz_ctl_' + Math.floor(Math.random() * 1e9)
    let done = false, s
    const clean = () => { try { delete window[cb] } catch { } if (s?.parentNode) s.parentNode.removeChild(s) }
    const timer = setTimeout(() => { if (!done) { done = true; clean(); reject(new Error('timeout')) } }, 15000)
    window[cb] = (resp) => {
      if (done) return; done = true; clearTimeout(timer)
      try {
        const cols = resp.table.cols.map((c) => c.label || '')
        const rows = resp.table.rows.map((r) => { const o = {}; cols.forEach((l, i) => { if (l) o[l] = r.c[i] ? r.c[i].v : null }); return o })
        clean(); resolve({ cols: cols.filter(Boolean), rows })
      } catch (e) { clean(); reject(e) }
    }
    s = document.createElement('script')
    s.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?gid=${gid}&headers=1&tqx=out:json;responseHandler:${cb}`
    s.onerror = () => { if (!done) { done = true; clearTimeout(timer); clean(); reject(new Error('No se pudo cargar la hoja.')) } }
    document.body.appendChild(s)
  })
}

export default function ControlOT() {
  const { perfil } = useAuth()
  const [estado, setEstado] = useState('cargando')
  const [msg, setMsg] = useState('')
  const [ots, setOts] = useState([])          // números de OT faltantes de la hoja
  const [rev, setRev] = useState({})          // ot_numero -> revision
  const [filtro, setFiltro] = useState('pendientes')

  useEffect(() => { cargar() }, [perfil?.empresa_id])

  async function cargar() {
    if (!perfil?.empresa_id) return
    try {
      const { data: cfg } = await supabase.from('empresa_config').select('valor')
        .eq('empresa_id', perfil.empresa_id).eq('clave', 'control_ots').maybeSingle()
      const c = cfg?.valor || {}
      if (!c.sheet_id || !c.gid || String(c.gid).includes('GID')) {
        setEstado('sin_config'); return
      }
      const [{ rows }, { data: revs }] = await Promise.all([
        loadSheet(c.sheet_id, c.gid),
        supabase.from('control_ot_revision').select('*').eq('empresa_id', perfil.empresa_id)
      ])
      // La primera columna con datos numéricos se toma como N° de OT faltante
      const nums = []
      rows.forEach((r) => {
        const vals = Object.values(r).filter((v) => v !== null && v !== '')
        const n = vals.find((v) => /^\d{3,}$/.test(String(v).trim()))
        if (n) nums.push(String(n).trim())
      })
      setOts([...new Set(nums)])
      setRev(Object.fromEntries((revs || []).map((x) => [x.ot_numero, x])))
      setEstado('listo')
    } catch (e) { setMsg(e.message); setEstado('error') }
  }

  async function marcar(ot, motivo, nota) {
    await supabase.from('control_ot_revision').upsert({
      empresa_id: perfil.empresa_id, ot_numero: ot, motivo, nota: nota ?? rev[ot]?.nota ?? '',
      revisado_por: perfil.id, actualizado_en: new Date().toISOString()
    }, { onConflict: 'empresa_id,ot_numero' })
    cargar()
  }

  const vista = useMemo(() => {
    if (filtro === 'pendientes') return ots.filter((o) => !rev[o]?.motivo)
    if (filtro === 'revisadas') return ots.filter((o) => rev[o]?.motivo)
    return ots
  }, [ots, rev, filtro])

  const pendientes = ots.filter((o) => !rev[o]?.motivo).length

  if (estado === 'cargando') return <div className="text-slate-400 text-sm py-10 text-center">Cargando control de OT…</div>
  if (estado === 'sin_config') return (
    <div className="card p-6 max-w-lg">
      <h1 className="text-lg font-bold text-ink mb-2">Control de OT</h1>
      <p className="text-sm text-slate-600">Falta configurar la ubicación de la hoja <b>Control_OTs</b>. Ejecuta la migración v19 reemplazando <code>GID_CONTROL_OTS</code> por el gid real de la pestaña (visible en la URL del Sheet), compartida como "Cualquiera con el enlace · Lector".</p>
    </div>
  )
  if (estado === 'error') return (
    <div className="card p-6 max-w-lg">
      <h1 className="text-lg font-bold text-ink mb-2">Control de OT</h1>
      <p className="text-sm text-red-600">No se pudo cargar la hoja: {msg}</p>
      <button className="btn-primary mt-3" onClick={cargar}>Reintentar</button>
    </div>
  )

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Control de OT</h1>
          <p className="text-sm text-slate-500">OT faltantes en la base · {pendientes} por revisar de {ots.length}</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          {[['pendientes', `Pendientes (${pendientes})`], ['revisadas', 'Revisadas'], ['todas', 'Todas']].map(([v, l]) => (
            <button key={v} onClick={() => setFiltro(v)} className={`px-3 py-1.5 ${filtro === v ? 'bg-deep text-white' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper text-slate-400 text-xs">
            <tr>
              <th className="text-left font-medium px-4 py-3 w-24">N° OT</th>
              <th className="text-left font-medium px-2 py-3">Motivo</th>
              <th className="text-left font-medium px-2 py-3">Nota</th>
              <th className="text-left font-medium px-4 py-3 hidden sm:table-cell w-32">Revisado</th>
            </tr>
          </thead>
          <tbody>
            {vista.map((ot) => {
              const r = rev[ot]
              return (
                <tr key={ot} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-mono font-semibold text-ink">{ot}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      {Object.entries(MOTIVOS).map(([k, v]) => (
                        <button key={k} onClick={() => marcar(ot, r?.motivo === k ? null : k)}
                          className={`px-2 py-1 rounded text-[11px] border transition ${r?.motivo === k ? 'text-white border-transparent' : 'text-slate-500 border-slate-200 hover:border-deep'}`}
                          style={r?.motivo === k ? { background: v.color } : {}}>{v.label}</button>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <input className="input text-xs" defaultValue={r?.nota || ''} placeholder="Detalle…"
                           onBlur={(e) => { if ((e.target.value || '') !== (r?.nota || '')) marcar(ot, r?.motivo || null, e.target.value) }} />
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell text-xs text-slate-400">
                    {r?.actualizado_en ? new Date(r.actualizado_en).toLocaleDateString('es-CL') : '—'}
                  </td>
                </tr>
              )
            })}
            {!vista.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-sm">{filtro === 'pendientes' ? '¡Todo revisado! No hay OT pendientes de clasificar.' : 'Sin registros.'}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400">La lista de OT faltantes viene en vivo de la hoja Control_OTs. Clasifica cada una: si el vehículo está en taller, pendiente de ingreso u otro motivo con su detalle.</p>
    </div>
  )
}
