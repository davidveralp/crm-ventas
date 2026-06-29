import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SEGMENTOS, fmtFecha, ESTADOS_EMAIL } from '../lib/helpers'

const pct = (n, d) => d ? Math.round((n / d) * 100) : 0

export default function Email() {
  const [tab, setTab] = useState('enviar')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-ink">Email marketing</h1>
          <p className="text-sm text-slate-500">Envía campañas por correo y mide su resultado</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          <button onClick={() => setTab('enviar')}
                  className={`px-3 py-1.5 ${tab === 'enviar' ? 'bg-deep text-white' : 'text-slate-500'}`}>Enviar</button>
          <button onClick={() => setTab('reportes')}
                  className={`px-3 py-1.5 ${tab === 'reportes' ? 'bg-deep text-white' : 'text-slate-500'}`}>Reportes</button>
        </div>
      </div>
      {tab === 'enviar' ? <Enviar /> : <Reportes />}
    </div>
  )
}

function Enviar() {
  const [asunto, setAsunto] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [segmento, setSegmento] = useState('')
  const [conteo, setConteo] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { contar() }, [segmento])

  async function contar() {
    let q = supabase.from('clientes').select('id', { count: 'exact', head: true }).not('email', 'is', null)
    if (segmento) q = q.eq('segmento', segmento)
    const { count } = await q
    setConteo(count || 0)
  }

  async function enviar() {
    if (!asunto.trim() || !cuerpo.trim()) { setMsg('Completa asunto y cuerpo.'); return }
    if (!confirm(`Se enviará a ${conteo} cliente(s) con email. ¿Continuar?`)) return
    setEnviando(true); setMsg('')
    const { data, error } = await supabase.functions.invoke('enviar-email', {
      body: { asunto, cuerpo, segmento: segmento || null }
    })
    setEnviando(false)
    if (error || data?.error) { setMsg('Error: ' + (data?.error || error.message)); return }
    setMsg(`Enviados: ${data.enviados} de ${data.total}. Revisa la pestaña Reportes para ver su evolución.`)
    setAsunto(''); setCuerpo('')
  }

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 card p-5 space-y-4">
        <div>
          <label className="label">Asunto</label>
          <input className="input" value={asunto} onChange={(e) => setAsunto(e.target.value)}
                 placeholder="Ej: Es momento de la mantención de tu vehículo" />
        </div>
        <div>
          <label className="label">Mensaje</label>
          <textarea className="input" rows="10" value={cuerpo} onChange={(e) => setCuerpo(e.target.value)}
                    placeholder={'Hola {nombre},\n\nQueremos recordarte que...'} />
          <p className="text-[11px] text-slate-400 mt-1">Usa <code>{'{nombre}'}</code> para personalizar con el nombre del cliente. Puedes usar saltos de línea.</p>
        </div>
      </div>
      <div className="card p-5 space-y-4 h-fit">
        <div>
          <label className="label">Audiencia</label>
          <select className="input" value={segmento} onChange={(e) => setSegmento(e.target.value)}>
            <option value="">Todos los clientes con email</option>
            {Object.entries(SEGMENTOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="rounded-lg bg-paper p-4 text-center">
          <div className="text-3xl font-bold text-deep">{conteo === null ? '…' : conteo}</div>
          <div className="text-xs text-slate-500">destinatarios con email</div>
        </div>
        <button className="btn-primary w-full" onClick={enviar} disabled={enviando || !conteo}>
          {enviando ? 'Enviando…' : 'Enviar ahora'}
        </button>
        {msg && <div className="rounded-lg bg-sky/10 px-3 py-2 text-sm text-deep">{msg}</div>}
        <p className="text-[11px] text-slate-400">El remitente y la clave de Brevo se configuran en el servidor. Los resultados (aperturas, clics) llegan por el webhook de Brevo.</p>
      </div>
    </div>
  )
}

function Reportes() {
  const [blasts, setBlasts] = useState([])
  const [envios, setEnvios] = useState([])

  useEffect(() => { cargar() }, [])
  async function cargar() {
    const [{ data: b }, { data: e }] = await Promise.all([
      supabase.from('email_blasts').select('*').order('creado_en', { ascending: false }).limit(200),
      supabase.from('email_envios').select('blast_id,estado').limit(20000)
    ])
    setBlasts(b || []); setEnvios(e || [])
  }

  const filas = useMemo(() => blasts.map((b) => {
    const evs = envios.filter((x) => x.blast_id === b.id)
    const enviados = evs.length || b.enviados || 0
    const entregados = evs.filter((x) => ['entregado', 'abierto', 'click'].includes(x.estado)).length
    const abiertos = evs.filter((x) => ['abierto', 'click'].includes(x.estado)).length
    const clics = evs.filter((x) => x.estado === 'click').length
    const rebotes = evs.filter((x) => x.estado === 'rebote').length
    const noSusc = evs.filter((x) => x.estado === 'no_suscrito').length
    return { ...b, enviados, entregados, abiertos, clics, rebotes, noSusc,
             aperturaPct: pct(abiertos, entregados), clicPct: pct(clics, entregados) }
  }), [blasts, envios])

  if (!blasts.length) return <div className="card p-6 text-center text-sm text-slate-400">Aún no has enviado campañas por email.</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        {Object.entries(ESTADOS_EMAIL).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: v.color }} />{v.label}
          </span>
        ))}
      </div>
      {filas.map((f) => (
        <div key={f.id} className="card p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div>
              <div className="font-medium text-ink">{f.asunto}</div>
              <div className="text-xs text-slate-400">{fmtFecha(f.creado_en?.slice(0,10))} · {f.segmento ? SEGMENTOS[f.segmento]?.label : 'Todos'} · {f.enviados} enviados</div>
            </div>
            <div className="flex gap-4 text-center">
              <div><div className="text-lg font-bold text-[#185FA5]">{f.aperturaPct}%</div><div className="text-[10px] text-slate-400">Apertura</div></div>
              <div><div className="text-lg font-bold text-[#1D9E75]">{f.clicPct}%</div><div className="text-[10px] text-slate-400">Clics</div></div>
            </div>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
            <Celda n={f.enviados}   label="Enviados"   c="#94a3b8" />
            <Celda n={f.entregados} label="Entregados" c="#5B9BB5" />
            <Celda n={f.abiertos}   label="Abiertos"   c="#185FA5" />
            <Celda n={f.clics}      label="Clics"      c="#1D9E75" />
            <Celda n={f.rebotes}    label="Rebotes"    c="#A32D2D" />
            <Celda n={f.noSusc}     label="No suscr."  c="#C98A1B" />
          </div>
        </div>
      ))}
    </div>
  )
}

function Celda({ n, label, c }) {
  return (
    <div className="rounded-lg bg-paper py-2">
      <div className="text-base font-bold" style={{ color: c }}>{n}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  )
}
