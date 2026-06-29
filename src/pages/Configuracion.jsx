import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useConfig, aplicarColores } from '../context/ConfigContext'

const COLS = [
  { k: 'deep', label: 'Primario' },
  { k: 'red',  label: 'Acento' },
  { k: 'sky',  label: 'Secundario' },
  { k: 'ink',  label: 'Tinta' }
]
const CATALOGOS = [
  { id: 'cat_segmentos',       nombre: 'Segmentos',           color: true },
  { id: 'cat_tipos_servicio',  nombre: 'Tipos de servicio',   color: false },
  { id: 'cat_estados_gestion', nombre: 'Estados de gestión',  color: true },
  { id: 'cat_tipos_agenda',    nombre: 'Tipos de agendamiento', color: true }
]

export default function Configuracion() {
  const { perfil } = useAuth()
  const { recargar } = useConfig()
  const [tab, setTab] = useState('marca')
  const [plan, setPlan] = useState(null)
  const [feats, setFeats] = useState([])

  useEffect(() => { cargarPlan() }, [])
  async function cargarPlan() {
    const [{ data: emp }, { data: f }] = await Promise.all([
      supabase.from('empresas').select('plan_id, planes(nombre)').eq('id', perfil.empresa_id).maybeSingle(),
      supabase.rpc('features_empresa')
    ])
    setPlan(emp?.planes?.nombre || 'Sin plan (todo activo)')
    setFeats(Array.isArray(f) ? f : [])
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-ink">Configuración</h1>
        <p className="text-sm text-slate-500">Marca, catálogos y plan de tu empresa</p>
      </div>

      <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm flex-wrap">
        {['marca', 'catalogos', 'plan'].map((t) => (
          <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1.5 capitalize ${tab === t ? 'bg-deep text-white' : 'text-slate-500'}`}>
            {t === 'marca' ? 'Marca' : t === 'catalogos' ? 'Catálogos' : 'Plan'}
          </button>
        ))}
      </div>

      {tab === 'marca' && <Marca perfil={perfil} recargar={recargar} />}
      {tab === 'catalogos' && <Catalogos perfil={perfil} />}
      {tab === 'plan' && (
        <div className="card p-5 space-y-3">
          <div>
            <div className="text-xs text-slate-500">Plan actual</div>
            <div className="text-lg font-semibold text-ink">{plan || '…'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Módulos activos</div>
            <div className="flex flex-wrap gap-2">
              {feats.length ? feats.map((f) => (
                <span key={f} className="pill bg-mist text-deep capitalize">{f}</span>
              )) : <span className="text-sm text-slate-400">Todos</span>}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">El plan y los módulos se gestionan desde la administración de la plataforma (VPAI).</p>
        </div>
      )}
    </div>
  )
}

function Marca({ perfil, recargar }) {
  const [b, setB] = useState({ nombre_comercial: '', login_titulo: '', colores: {} })
  const [msg, setMsg] = useState('')

  useEffect(() => { (async () => {
    const { data } = await supabase.from('empresa_branding').select('*').eq('empresa_id', perfil.empresa_id).maybeSingle()
    if (data) setB({ nombre_comercial: data.nombre_comercial || '', login_titulo: data.login_titulo || '', colores: data.colores || {} })
  })() }, [])

  function setColor(k, v) {
    const colores = { ...b.colores, [k]: v }
    setB({ ...b, colores })
    aplicarColores({ [k]: v }) // vista previa en vivo
  }

  async function guardar() {
    setMsg('')
    const { error } = await supabase.from('empresa_branding')
      .upsert({ empresa_id: perfil.empresa_id, ...b }, { onConflict: 'empresa_id' })
    if (error) { setMsg('Error: ' + error.message); return }
    await recargar()
    setMsg('Marca actualizada.')
  }

  return (
    <div className="card p-5 space-y-4">
      <div>
        <label className="label">Nombre comercial</label>
        <input className="input" value={b.nombre_comercial}
               onChange={(e) => setB({ ...b, nombre_comercial: e.target.value })} />
      </div>
      <div>
        <label className="label">Título del login</label>
        <input className="input" value={b.login_titulo}
               onChange={(e) => setB({ ...b, login_titulo: e.target.value })} />
      </div>
      <div>
        <label className="label">Colores de marca</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {COLS.map(({ k, label }) => (
            <div key={k} className="flex items-center gap-2">
              <input type="color" value={b.colores[k] || '#1C4357'}
                     onChange={(e) => setColor(k, e.target.value)}
                     className="w-9 h-9 rounded border border-slate-200" />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-1">Los colores se aplican al instante como vista previa. Guarda para fijarlos.</p>
      </div>
      {msg && <div className="rounded-lg bg-sky/10 px-3 py-2 text-sm text-deep">{msg}</div>}
      <div className="flex justify-end">
        <button className="btn-primary" onClick={guardar}>Guardar marca</button>
      </div>
    </div>
  )
}

function Catalogos({ perfil }) {
  const [sel, setSel] = useState(CATALOGOS[0])
  const [rows, setRows] = useState([])
  const [msg, setMsg] = useState('')

  useEffect(() => { cargar() }, [sel])
  async function cargar() {
    const { data } = await supabase.from(sel.id).select('*')
      .eq('empresa_id', perfil.empresa_id).order('orden')
    setRows(data || [])
  }

  const set = (i, campo, v) => setRows(rows.map((r, j) => j === i ? { ...r, [campo]: v } : r))
  const agregar = () => setRows([...rows, { clave: '', nombre: '', color: '#64748b', orden: rows.length + 1 }])

  async function eliminar(i) {
    const r = rows[i]
    if (r.id) await supabase.from(sel.id).delete().eq('id', r.id)
    setRows(rows.filter((_, j) => j !== i))
  }

  async function guardar() {
    setMsg('')
    const validos = rows.filter((r) => r.clave && r.nombre).map((r) => ({
      empresa_id: perfil.empresa_id, clave: r.clave.trim(), nombre: r.nombre.trim(),
      ...(sel.color ? { color: r.color } : {}), orden: Number(r.orden) || 0
    }))
    const { error } = await supabase.from(sel.id).upsert(validos, { onConflict: 'empresa_id,clave' })
    if (error) { setMsg('Error: ' + error.message); return }
    cargar(); setMsg('Catálogo guardado.')
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex flex-wrap gap-2">
        {CATALOGOS.map((c) => (
          <button key={c.id} onClick={() => setSel(c)}
                  className={`pill ${sel.id === c.id ? 'bg-deep text-white' : 'bg-mist text-deep'}`}>{c.nombre}</button>
        ))}
      </div>

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className="input flex-1" value={r.nombre || ''} placeholder="Nombre"
                   onChange={(e) => set(i, 'nombre', e.target.value)} />
            <input className="input w-32" value={r.clave || ''} placeholder="clave"
                   onChange={(e) => set(i, 'clave', e.target.value)} disabled={!!r.id} />
            {sel.color && (
              <input type="color" value={r.color || '#64748b'} onChange={(e) => set(i, 'color', e.target.value)}
                     className="w-9 h-9 rounded border border-slate-200 shrink-0" />
            )}
            <input className="input w-16" type="number" value={r.orden ?? 0} onChange={(e) => set(i, 'orden', e.target.value)} />
            <button onClick={() => eliminar(i)} className="text-red-500 text-sm shrink-0">✕</button>
          </div>
        ))}
      </div>

      {msg && <div className="rounded-lg bg-sky/10 px-3 py-2 text-sm text-deep">{msg}</div>}
      <div className="flex justify-between">
        <button className="btn-soft" onClick={agregar}>+ Agregar</button>
        <button className="btn-primary" onClick={guardar}>Guardar catálogo</button>
      </div>
      <p className="text-[11px] text-slate-400">La "clave" identifica el valor internamente y no se puede cambiar una vez creada. Estos catálogos alimentarán los formularios del CRM.</p>
    </div>
  )
}
