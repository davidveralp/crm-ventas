import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Pill, Modal } from '../components/UI'
import { ROLES_USUARIO } from '../lib/helpers'

const ROLES = ROLES_USUARIO  // v27: catálogo único de roles (incluye asesores Toyota/Multimarca y asistentes)
const ROL_COLOR = { admin: '#1C4357', vendedor: '#185FA5', asesor_toyota: '#E0382B', asesor_multimarca: '#185FA5', supervisor: '#7A5C8E', postventa: '#1D7A5F', jefe_taller: '#b0603a', tecnico: '#2f6fb0', coordinador_adquisiciones: '#B07A2E', encargado_bodega: '#1aa88a', asistente_administrativo: '#6B7A8A', asistente_bodega: '#1aa88a' }
const NUEVO = { nombre: '', email: '', password: '', rol: 'vendedor', activo: true }

export default function Usuarios() {
  const { perfil } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [auditoria, setAuditoria] = useState([])
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null) // usuario en edición
  const [fEdit, setFEdit] = useState({ nombre: '', rol: 'vendedor', activo: true, password: '' })

  async function guardarEdicion(e) {
    e.preventDefault()
    setError('')
    const { data, error: err } = await supabase.functions.invoke('gestionar-usuario', {
      body: { action: 'actualizar', usuario_id: editando.id, nombre: fEdit.nombre.trim(),
              rol: fEdit.rol, activo: fEdit.activo, password: fEdit.password.trim() || null }
    })
    if (err || data?.error) { alert('Error: ' + (data?.error || err.message) + '\n(Si dice acción desconocida, re-despliega la Edge Function gestionar-usuario con la versión v27 del repo.)'); return }
    setEditando(null); cargar()
  }
  const [form, setForm] = useState(NUEVO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: u }, { data: a }] = await Promise.all([
      supabase.from('usuarios').select('*').order('rol'),
      supabase.from('auditoria').select('*, usuarios(nombre)')
        .order('ocurrido_en', { ascending: false }).limit(30)
    ])
    setUsuarios(u || []); setAuditoria(a || [])
  }

  async function toggleActivo(u) {
    await supabase.from('usuarios').update({ activo: !u.activo }).eq('id', u.id); cargar()
  }
  async function cambiarRol(u, rol) {
    await supabase.from('usuarios').update({ rol }).eq('id', u.id); cargar()
  }

  async function crear(e) {
    e.preventDefault()
    setGuardando(true); setError('')
    const { data, error: err } = await supabase.functions.invoke('gestionar-usuario', {
      body: { action: 'crear', ...form }
    })
    setGuardando(false)
    if (err || data?.error) {
      const m = data?.error || err.message
      setError(/Failed to send a request|FunctionsFetchError|not found/i.test(m)
        ? 'La Edge Function "gestionar-usuario" NO está desplegada en Supabase (por eso falla la creación). Despliégala así: Dashboard de Supabase → Edge Functions → Deploy new function → nombre exacto gestionar-usuario → pega el contenido de supabase/functions/gestionar-usuario/index.ts del repo → Deploy. Los secrets se configuran solos. Guía completa: DESPLEGAR_FUNCIONES.md. (Plan B manual: Authentication → Add user y luego insertar la fila en la tabla usuarios.)'
        : m)
      return
    }
    setModal(false); setForm(NUEVO); cargar()
  }

  async function eliminar(u) {
    if (!confirm(`¿Eliminar al usuario "${u.nombre}"? Perderá el acceso al CRM.`)) return
    const { data, error: err } = await supabase.functions.invoke('gestionar-usuario', {
      body: { action: 'eliminar', id: u.id }
    })
    if (err || data?.error) { alert(data?.error || err.message); return }
    cargar()
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Usuarios</h1>
          <p className="text-sm text-slate-500">Equipo comercial y registro de cambios</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(NUEVO); setError(''); setModal(true) }}>+ Nuevo usuario</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-paper text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left font-medium px-4 py-3">Nombre</th>
              <th className="text-left font-medium px-4 py-3">Correo</th>
              <th className="text-left font-medium px-4 py-3">Rol</th>
              <th className="text-center font-medium px-4 py-3">Estado</th>
              <th className="text-right font-medium px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium text-ink">{u.nombre}</td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3">
                  <select value={u.rol} onChange={(e) => cambiarRol(u, e.target.value)}
                          className="text-xs rounded-md border border-slate-200 px-2 py-1"
                          style={{ color: ROL_COLOR[u.rol] }}>
                    {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleActivo(u)}
                    className={`pill ${u.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </button>
                  <button className="text-xs text-deep hover:underline ml-2"
                          onClick={() => { setEditando(u); setFEdit({ nombre: u.nombre || '', rol: u.rol, activo: !!u.activo, password: '' }) }}>
                    Editar
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  {u.id !== perfil?.id && (
                    <button onClick={() => eliminar(u)} className="text-xs text-red-500 hover:underline">Eliminar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="font-semibold text-ink mb-3">Registro de cambios (auditoría)</h3>
        <div className="card divide-y divide-slate-100">
          {auditoria.length ? auditoria.map((a) => (
            <div key={a.id} className="px-4 py-2.5 text-sm flex items-center justify-between">
              <span className="text-slate-600">
                <span className="font-medium text-ink">{a.usuarios?.nombre || 'Sistema'}</span>
                {' '}cambió {a.campo} de un cliente
              </span>
              <span className="text-xs text-slate-400">{new Date(a.ocurrido_en).toLocaleString('es-CL')}</span>
            </div>
          )) : <div className="px-4 py-4 text-sm text-slate-400 text-center">Sin cambios registrados todavía.</div>}
        </div>
      </div>

      <Modal abierto={!!editando} onClose={() => setEditando(null)} titulo={`Editar usuario · ${editando?.email || ''}`}>
        <form onSubmit={guardarEdicion} className="space-y-3">
          <div>
            <label className="label">Nombre *</label>
            <input className="input" required value={fEdit.nombre} onChange={(e) => setFEdit({ ...fEdit, nombre: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Rol</label>
              <select className="input" value={fEdit.rol} onChange={(e) => setFEdit({ ...fEdit, rol: e.target.value })}>
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="input" value={fEdit.activo ? '1' : '0'} onChange={(e) => setFEdit({ ...fEdit, activo: e.target.value === '1' })}>
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Nueva contraseña (opcional)</label>
            <input className="input" type="text" value={fEdit.password} placeholder="Dejar vacío para no cambiarla"
                   onChange={(e) => setFEdit({ ...fEdit, password: e.target.value })} />
            <p className="text-[10px] text-slate-400 mt-0.5">Cada usuario también puede cambiar su propia clave desde "Mi perfil".</p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-soft" onClick={() => setEditando(null)}>Cancelar</button>
            <button className="btn-primary">Guardar cambios</button>
          </div>
        </form>
      </Modal>

      <Modal abierto={modal} onClose={() => setModal(false)} titulo="Nuevo usuario">
        <form onSubmit={crear} className="space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input className="input" required value={form.nombre}
                   onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Correo *</label>
              <input className="input" type="email" required value={form.email}
                     onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Contraseña temporal *</label>
              <input className="input" required minLength={6} value={form.password}
                     onChange={(e) => setForm({ ...form, password: e.target.value })}
                     placeholder="mín. 6 caracteres" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Rol</label>
              <select className="input" value={form.rol}
                      onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="input" value={form.activo ? '1' : '0'}
                      onChange={(e) => setForm({ ...form, activo: e.target.value === '1' })}>
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </div>
          </div>
          {error && <div className="rounded-lg bg-red-50 text-red-600 text-sm px-3 py-2">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-soft" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary" disabled={guardando}>{guardando ? 'Creando…' : 'Crear usuario'}</button>
          </div>
          <p className="text-[11px] text-slate-400">
            Solo un administrador puede crear usuarios. El acceso se crea de inmediato; comparte la contraseña temporal con la persona.
          </p>
        </form>
      </Modal>
    </div>
  )
}
