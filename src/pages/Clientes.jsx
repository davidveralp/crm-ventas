import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Pill, Modal, EmptyState } from '../components/UI'
import { SEGMENTOS, segLabel, segColor, fmtCLP, fmtFecha } from '../lib/helpers'

const VACIO = {
  nombre: '', email: '', telefono: '', ciudad: 'La Serena',
  tipo: 'PARTICULAR', segmento: 'prometedor', marca_principal: '', vendedor_id: ''
}

export default function Clientes() {
  const { esAdmin, perfil } = useAuth()
  const navigate = useNavigate()
  const [lista, setLista]   = useState([])
  const [vendedores, setVendedores] = useState([])
  const [busca, setBusca]   = useState('')
  const [segFiltro, setSegFiltro] = useState('')
  const [marcaFiltro, setMarcaFiltro] = useState('')
  const [vendFiltro, setVendFiltro] = useState('')
  const [modal, setModal]   = useState(false)
  const [form, setForm]     = useState(VACIO)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data } = await supabase
      .from('clientes')
      .select('*, usuarios(nombre)')
      .order('facturacion_total', { ascending: false })
    setLista(data || [])
    const { data: v } = await supabase.from('usuarios')
      .select('id,nombre').eq('rol', 'vendedor').eq('activo', true)
    setVendedores(v || [])
  }

  const marcas = useMemo(() => {
    const set = new Set(lista.map((c) => c.marca_principal).filter(Boolean))
    return [...set].sort()
  }, [lista])

  const filtrada = useMemo(() => {
    const q = busca.toLowerCase()
    return lista.filter((c) =>
      (!segFiltro || c.segmento === segFiltro) &&
      (!marcaFiltro || c.marca_principal === marcaFiltro) &&
      (!vendFiltro || c.vendedor_id === vendFiltro) &&
      (!q || c.nombre?.toLowerCase().includes(q) ||
             c.telefono?.includes(q) ||
             c.email?.toLowerCase().includes(q))
    )
  }, [lista, busca, segFiltro, marcaFiltro, vendFiltro])

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    const payload = {
      ...form, empresa_id: perfil.empresa_id,
      vendedor_id: form.vendedor_id || (esAdmin ? null : perfil.id)
    }
    const { error } = await supabase.from('clientes').insert(payload)
    setGuardando(false)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setModal(false); setForm(VACIO); cargar()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Clientes</h1>
          <p className="text-sm text-slate-500">{filtrada.length} de {lista.length}</p>
        </div>
        <button className="btn-primary" onClick={() => setModal(true)}>+ Nuevo cliente</button>
      </div>

      <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3">
        <input className="input md:max-w-xs col-span-2" placeholder="Buscar por nombre, teléfono o correo…"
               value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="input md:max-w-[180px]" value={segFiltro} onChange={(e) => setSegFiltro(e.target.value)}>
          <option value="">Todos los segmentos</option>
          {Object.entries(SEGMENTOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="input md:max-w-[160px]" value={marcaFiltro} onChange={(e) => setMarcaFiltro(e.target.value)}>
          <option value="">Todas las marcas</option>
          {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        {esAdmin && (
          <select className="input md:max-w-[180px]" value={vendFiltro} onChange={(e) => setVendFiltro(e.target.value)}>
            <option value="">Todos los vendedores</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
        )}
      </div>

      {filtrada.length === 0 ? (
        <EmptyState titulo="Sin clientes que coincidan"
                    mensaje="Ajusta la búsqueda o los filtros." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left font-medium px-4 py-3">Cliente</th>
                <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Marca</th>
                <th className="text-left font-medium px-4 py-3">Segmento</th>
                <th className="text-right font-medium px-4 py-3">Facturación</th>
                <th className="text-center font-medium px-4 py-3 hidden md:table-cell">Visitas</th>
                <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Vendedor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrada.map((c) => (
                <tr key={c.id} className="hover:bg-paper cursor-pointer"
                    onClick={() => navigate(`/clientes/${c.id}`)}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{c.nombre}</div>
                    <div className="text-xs text-slate-400">{c.telefono || c.email || '—'}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-slate-600">{c.marca_principal || '—'}</td>
                  <td className="px-4 py-3">
                    {c.segmento && <Pill color={segColor(c.segmento)}>{segLabel(c.segmento)}</Pill>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{fmtCLP(c.facturacion_total)}</td>
                  <td className="px-4 py-3 text-center hidden md:table-cell text-slate-500">{c.num_ot || 0}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-500">{c.usuarios?.nombre || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal abierto={modal} onClose={() => setModal(false)} titulo="Nuevo cliente">
        <form onSubmit={guardar} className="space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input className="input" required value={form.nombre}
                   onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Teléfono</label>
              <input className="input" value={form.telefono}
                     onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div>
              <label className="label">Correo</label>
              <input className="input" type="email" value={form.email}
                     onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={form.tipo}
                      onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="PARTICULAR">Particular</option>
                <option value="EMPRESA">Empresa</option>
              </select>
            </div>
            <div>
              <label className="label">Marca principal</label>
              <input className="input" value={form.marca_principal}
                     onChange={(e) => setForm({ ...form, marca_principal: e.target.value })}
                     placeholder="Ej: TOYOTA" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Segmento</label>
              <select className="input" value={form.segmento}
                      onChange={(e) => setForm({ ...form, segmento: e.target.value })}>
                {Object.entries(SEGMENTOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            {esAdmin && (
              <div>
                <label className="label">Vendedor</label>
                <select className="input" value={form.vendedor_id}
                        onChange={(e) => setForm({ ...form, vendedor_id: e.target.value })}>
                  <option value="">Sin asignar</option>
                  {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-soft" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar cliente'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
