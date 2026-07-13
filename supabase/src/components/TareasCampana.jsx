import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, fetchAllRows } from '../lib/supabase'
import { Pill } from './UI'
import { segLabel, segColor, fmtFecha } from '../lib/helpers'

// v22 · Tareas de campaña asignadas a los vendedores (Clientes → Tareas).
// Reemplaza la carga de campañas al calendario: el asesor trabaja aquí su
// lista y SOLO al agendar se crea la actividad que aparece en el Calendario.
export const ESTADOS_TAREA = {
  pendiente:  { label: 'Pendiente',   color: '#C98A1B' },
  contactado: { label: 'Contactado',  color: '#2f6fb0' },
  agendado:   { label: 'Agendado',    color: '#7A5C8E' },
  venta:      { label: 'Venta',       color: '#1f9d57' },
  descartado: { label: 'Descartado',  color: '#8a94a0' }
}
const CANALES = { whatsapp: 'WhatsApp', llamada: 'Llamada', email: 'Email', sms: 'SMS' }

export default function TareasCampana({ perfil, esAdmin }) {
  const navigate = useNavigate()
  const [tareas, setTareas] = useState(null)
  const [vendedores, setVendedores] = useState([])
  const [fEstado, setFEstado] = useState('')
  const [fCampana, setFCampana] = useState('')
  const [fVendedor, setFVendedor] = useState(esAdmin ? '' : perfil?.id || '')
  const [busca, setBusca] = useState('')

  useEffect(() => { cargar() }, [perfil?.empresa_id])
  async function cargar() {
    const data = await fetchAllRows('tareas_campana',
      '*, clientes(nombre,apellidos,telefono,segmento,ultima_visita,marca_principal), campanas(nombre,canal), usuarios:vendedor_id(nombre)',
      (q) => q.order('creado_en', { ascending: false }))
    setTareas(data || [])
    if (esAdmin) {
      const { data: v } = await supabase.from('usuarios').select('id,nombre').eq('activo', true).order('nombre')
      setVendedores(v || [])
    }
  }

  const campanas = useMemo(() => {
    const m = {}
    ;(tareas || []).forEach((t) => { if (t.campanas?.nombre) m[t.campana_id] = t.campanas.nombre })
    return Object.entries(m)
  }, [tareas])

  const vista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return (tareas || []).filter((t) =>
      (!fEstado || t.estado === fEstado) &&
      (!fCampana || t.campana_id === fCampana) &&
      (esAdmin ? (!fVendedor || (fVendedor === 'sin' ? !t.vendedor_id : t.vendedor_id === fVendedor))
               : (perfil?.rol === 'asesor_multimarca'
                    // cartera multimarca compartida: ven todos los clientes NO Toyota
                    ? (t.clientes?.marca_principal || '').toUpperCase() !== 'TOYOTA'
                    : (t.vendedor_id === perfil?.id || !t.vendedor_id))) &&
      (!q || nomCli(t).toLowerCase().includes(q) || (t.clientes?.telefono || '').includes(q))
    )
  }, [tareas, fEstado, fCampana, fVendedor, busca, esAdmin, perfil?.id])

  const nomCli = (t) => [t.clientes?.nombre, t.clientes?.apellidos].filter(Boolean).join(' ') || '—'
  const diasSin = (t) => t.clientes?.ultima_visita
    ? Math.floor((Date.now() - new Date(t.clientes.ultima_visita)) / 864e5) + 'd' : '—'

  async function setCampo(t, campos) {
    await supabase.from('tareas_campana').update({
      ...campos, gestionado_en: new Date().toISOString(), gestionado_por: perfil.id
    }).eq('id', t.id)
    setTareas((xs) => xs.map((x) => x.id === t.id ? { ...x, ...campos, gestionado_en: new Date().toISOString() } : x))
  }

  // Al marcar "agendado" se crea la actividad: ESO es lo que entra al
  // Calendario (no la campaña).
  async function cambiarEstado(t, estado) {
    if (estado === 'agendado') {
      const sug = new Date(Date.now() + 864e5).toISOString().slice(0, 10)
      const fecha = window.prompt('Fecha del agendamiento (AAAA-MM-DD):', sug)
      if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return alert('Fecha inválida. No se agendó.')
      const { error } = await supabase.from('actividades').insert({
        empresa_id: perfil.empresa_id, cliente_id: t.cliente_id,
        vendedor_id: t.vendedor_id || perfil.id, tipo: 'agendamiento',
        resultado: 'pendiente', fecha, proxima_fecha: fecha,
        campana_id: t.campana_id, proxima_accion: `Agendado · ${t.campanas?.nombre || 'campaña'}`,
        descripcion: t.comentario || ''
      })
      if (error) return alert('Error al agendar: ' + error.message)
    }
    await setCampo(t, { estado })
  }

  function exportarCSV() {
    const enc = ['Cliente', 'Segmento', 'Campaña', 'Canal', 'Teléfono', 'Días s/visita', 'Estado', 'Últ. gestión', 'Vendedor', 'Comentarios']
    const filas = vista.map((t) => [
      nomCli(t), segLabel(t.clientes?.segmento), t.campanas?.nombre || '', CANALES[t.canal] || t.canal || '',
      t.clientes?.telefono || '', diasSin(t), ESTADOS_TAREA[t.estado]?.label || t.estado,
      t.gestionado_en ? fmtFecha(t.gestionado_en) : '', t.usuarios?.nombre || 'Sin asignar', t.comentario || ''
    ])
    const csv = [enc, ...filas].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `tareas_campana_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  if (tareas === null) return <div className="text-slate-400 text-sm py-10 text-center">Cargando tareas…</div>

  const pend = vista.filter((t) => t.estado === 'pendiente').length

  return (
    <div className="space-y-3">
      <div className="card p-3 flex items-center gap-2 flex-wrap">
        <input className="input flex-1 min-w-48" placeholder="🔎 Cliente o teléfono…"
               value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="input w-auto" value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
          <option value="">Estado: todos</option>
          {Object.entries(ESTADOS_TAREA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="input w-auto max-w-56" value={fCampana} onChange={(e) => setFCampana(e.target.value)}>
          <option value="">Campaña: todas</option>
          {campanas.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
        {esAdmin && (
          <select className="input w-auto" value={fVendedor} onChange={(e) => setFVendedor(e.target.value)}>
            <option value="">Vendedor: todos</option>
            <option value="sin">Sin asignar</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
        )}
        <span className="text-xs text-slate-500">{vista.length} tareas · {pend} pendientes</span>
        <button className="btn-soft text-xs ml-auto" onClick={exportarCSV}>⬇ Exportar CSV</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-paper text-slate-400 text-xs">
            <tr>
              <th className="text-left font-medium px-4 py-3">Cliente</th>
              <th className="text-left font-medium px-2 py-3">Segmento</th>
              <th className="text-left font-medium px-2 py-3">Campaña</th>
              <th className="text-left font-medium px-2 py-3">Canal</th>
              <th className="text-left font-medium px-2 py-3">Teléfono</th>
              <th className="text-left font-medium px-2 py-3">Días s/visita</th>
              <th className="text-left font-medium px-2 py-3">Últ. gestión</th>
              <th className="text-left font-medium px-2 py-3">Estado</th>
              {esAdmin && <th className="text-left font-medium px-2 py-3">Vendedor</th>}
              <th className="text-left font-medium px-2 py-3 min-w-52">Comentarios</th>
            </tr>
          </thead>
          <tbody>
            {vista.map((t) => (
              <tr key={t.id} className="border-t border-slate-100 hover:bg-mist/40">
                <td className="px-4 py-2">
                  <button className="font-medium text-ink hover:text-deep hover:underline text-left"
                          onClick={() => navigate(`/clientes/${t.cliente_id}`)}>{nomCli(t)}</button>
                </td>
                <td className="px-2 py-2"><Pill color={segColor(t.clientes?.segmento)}>{segLabel(t.clientes?.segmento)}</Pill></td>
                <td className="px-2 py-2"><span className="pill bg-mist text-deep">{t.campanas?.nombre || '—'}</span></td>
                <td className="px-2 py-2 text-slate-500 text-xs">{CANALES[t.canal] || t.canal || '—'}</td>
                <td className="px-2 py-2 text-slate-600 text-xs whitespace-nowrap">{t.clientes?.telefono || '—'}</td>
                <td className="px-2 py-2 text-slate-600 text-xs">{diasSin(t)}</td>
                <td className="px-2 py-2 text-slate-400 text-xs whitespace-nowrap">{t.gestionado_en ? fmtFecha(t.gestionado_en) : '—'}</td>
                <td className="px-2 py-2">
                  <select className="input text-xs py-1 w-auto"
                          style={{ color: ESTADOS_TAREA[t.estado]?.color, fontWeight: 600 }}
                          value={t.estado} onChange={(e) => cambiarEstado(t, e.target.value)}>
                    {Object.entries(ESTADOS_TAREA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </td>
                {esAdmin && <td className="px-2 py-2 text-xs text-slate-500">{t.usuarios?.nombre || <span className="text-didial-amber">Sin asignar</span>}</td>}
                <td className="px-2 py-2">
                  <input className="input text-xs" defaultValue={t.comentario || ''} placeholder="Comentario…"
                         onBlur={(e) => { if ((e.target.value || '') !== (t.comentario || '')) setCampo(t, { comentario: e.target.value }) }} />
                </td>
              </tr>
            ))}
            {!vista.length && (
              <tr><td colSpan={esAdmin ? 10 : 9} className="px-4 py-10 text-center text-slate-400 text-sm">
                Sin tareas. Se generan al usar "Cargar a asesores" en una campaña activa.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400">
        Al marcar una tarea como <b>Agendado</b> se crea el agendamiento en el Calendario (esa es la única vía:
        las campañas ya no cargan nada al calendario). Las gestiones registran solo lo que el asesor haga en la ficha del cliente.
      </p>
    </div>
  )
}
