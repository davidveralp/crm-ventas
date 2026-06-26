import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, fetchAllRows } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Pill, Modal, EmptyState, SelectMarca } from '../components/UI'
import { SEGMENTOS, TIPOS_CLIENTE, segLabel, segColor, fmtCLP, formatRut, formatTelefono, formatPatente } from '../lib/helpers'

const VACIO = {
  nombre: '', rut: '', email: '', telefono: '', ciudad: 'La Serena',
  tipo: 'PERSONA', segmento: 'prometedor', marca_principal: '', vendedor_id: '',
  // datos del primer vehículo (opcionales)
  v_marca: '', v_modelo: '', v_anio: '', v_patente: '', v_km: ''
}

export default function Clientes() {
  const { esAdmin, perfil } = useAuth()
  const navigate = useNavigate()
  const [lista, setLista]   = useState([])
  const [vendedores, setVendedores] = useState([])
  const [estados, setEstados] = useState([])
  const [busca, setBusca]   = useState('')
  const [segFiltro, setSegFiltro] = useState('')
  const [marcaFiltro, setMarcaFiltro] = useState('')
  const [vendFiltro, setVendFiltro] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [modal, setModal]   = useState(false)
  const [form, setForm]     = useState(VACIO)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const data = await fetchAllRows('clientes', '*, usuarios(nombre)',
      (q) => q.order('facturacion_total', { ascending: false }))
    setLista(data || [])
    const { data: v } = await supabase.from('usuarios')
      .select('id,nombre').eq('rol', 'vendedor').eq('activo', true)
    setVendedores(v || [])
    const { data: e } = await supabase.from('pipeline_estados')
      .select('id,nombre,color,orden,es_final').order('orden')
    setEstados(e || [])
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
      (!estadoFiltro ||
        (estadoFiltro === 'sin' ? !c.estado_id : c.estado_id === estadoFiltro)) &&
      (!q || c.nombre?.toLowerCase().includes(q) ||
             c.telefono?.includes(q) ||
             c.email?.toLowerCase().includes(q))
    )
  }, [lista, busca, segFiltro, marcaFiltro, vendFiltro, estadoFiltro])

  const estadoDe = (id) => estados.find((e) => e.id === id)

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    const asignado = estados.find((e) => e.clave === 'asignado' || e.nombre === 'Asignado')
    const payload = {
      nombre: form.nombre, email: form.email,
      telefono: form.telefono ? formatTelefono(form.telefono) : null,
      ciudad: form.ciudad, tipo: form.tipo, segmento: form.segmento,
      rut: form.rut ? formatRut(form.rut) : null,
      marca_principal: form.marca_principal || form.v_marca || null,
      estado_id: asignado ? asignado.id : null,
      empresa_id: perfil.empresa_id,
      vendedor_id: form.vendedor_id || (esAdmin ? null : perfil.id)
    }
    const { data: nuevo, error } = await supabase.from('clientes')
      .insert(payload).select('id').single()
    if (error) { setGuardando(false); alert('No se pudo guardar: ' + error.message); return }

    // Vehículo inicial (si se ingresó al menos patente o marca)
    if (form.v_patente || form.v_marca) {
      const km = Number(form.v_km) || null
      await supabase.from('vehiculos').insert({
        cliente_id: nuevo.id, empresa_id: perfil.empresa_id,
        patente: form.v_patente ? formatPatente(form.v_patente) : null,
        marca: form.v_marca || null,
        modelo: form.v_modelo || null, anio: Number(form.v_anio) || null,
        km_ultimo: km, km_actual_estimado: km
      })
    }
    setGuardando(false)
    setModal(false); setForm(VACIO)
    // Redirige a la ficha del nuevo cliente para gestionarlo de inmediato
    navigate(`/clientes/${nuevo.id}`)
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
        <select className="input md:max-w-[180px]" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="sin">Sin estado</option>
          {estados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
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
                <th className="text-left font-medium px-4 py-3">Estado</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Segmento</th>
                <th className="text-right font-medium px-4 py-3">Facturación</th>
                <th className="text-center font-medium px-4 py-3 hidden md:table-cell">Visitas</th>
                <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Vendedor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrada.map((c) => {
                const est = estadoDe(c.estado_id)
                return (
                  <tr key={c.id} className="hover:bg-paper cursor-pointer"
                      onClick={() => navigate(`/clientes/${c.id}`)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{c.nombre}</div>
                      <div className="text-xs text-slate-400">{c.telefono ? formatTelefono(c.telefono) : (c.email || '—')}</div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-slate-600">{c.marca_principal || '—'}</td>
                    <td className="px-4 py-3">
                      {est
                        ? <Pill color={est.color}>{est.nombre}</Pill>
                        : <span className="text-xs text-slate-300">Sin estado</span>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {c.segmento && <Pill color={segColor(c.segmento)}>{segLabel(c.segmento)}</Pill>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{fmtCLP(c.facturacion_total)}</td>
                    <td className="px-4 py-3 text-center hidden md:table-cell text-slate-500">{c.num_ot || 0}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-500">{c.usuarios?.nombre || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal abierto={modal} onClose={() => setModal(false)} titulo="Nuevo cliente" ancho="max-w-xl">
        <form onSubmit={guardar} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre *</label>
              <input className="input" required value={form.nombre}
                     onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div>
              <label className="label">RUT</label>
              <input className="input" value={form.rut}
                     onChange={(e) => setForm({ ...form, rut: e.target.value })}
                     onBlur={(e) => setForm({ ...form, rut: formatRut(e.target.value) })}
                     placeholder="12.345.678-9" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Teléfono</label>
              <input className="input" value={form.telefono}
                     onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                     onBlur={(e) => setForm({ ...form, telefono: formatTelefono(e.target.value) })}
                     placeholder="+56 9 XXXX XXXX" />
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
                {Object.entries(TIPOS_CLIENTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Segmento</label>
              <select className="input" value={form.segmento}
                      onChange={(e) => setForm({ ...form, segmento: e.target.value })}>
                {Object.entries(SEGMENTOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
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

          {/* Vehículo inicial */}
          <div className="border-t border-slate-100 pt-3">
            <div className="text-xs font-semibold text-slate-500 mb-2">Vehículo (opcional)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Marca</label>
                <SelectMarca value={form.v_marca} onChange={(v) => setForm({ ...form, v_marca: v })} />
              </div>
              <div>
                <label className="label">Modelo</label>
                <input className="input" value={form.v_modelo}
                       onChange={(e) => setForm({ ...form, v_modelo: e.target.value })} />
              </div>
              <div>
                <label className="label">Año</label>
                <input className="input" type="number" value={form.v_anio}
                       onChange={(e) => setForm({ ...form, v_anio: e.target.value })} />
              </div>
              <div>
                <label className="label">Patente</label>
                <input className="input" value={form.v_patente}
                       onChange={(e) => setForm({ ...form, v_patente: e.target.value.toUpperCase() })}
                       onBlur={(e) => setForm({ ...form, v_patente: formatPatente(e.target.value) })}
                       placeholder="XX XX XX" />
              </div>
              <div className="col-span-2">
                <label className="label">Kilometraje</label>
                <input className="input" type="number" value={form.v_km}
                       onChange={(e) => setForm({ ...form, v_km: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-soft" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Crear y gestionar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
